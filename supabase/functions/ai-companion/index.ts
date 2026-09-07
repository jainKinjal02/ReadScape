import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

// This Edge Function runs on Supabase's servers (Deno runtime).
// ANTHROPIC_API_KEY is set with `supabase secrets set` and is never bundled
// into the mobile app — that is the whole point of routing through here.

// CORS: native apps send no Origin header and are unaffected by this. It only
// constrains browsers, i.e. the web build. Set ALLOWED_WEB_ORIGINS to a
// comma-separated list once the web build has a domain.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_WEB_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? "");
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
}

const DAILY_MESSAGE_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "20");

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Authentication ────────────────────────────────────────────────────
    // The Supabase gateway accepts the *anon* key, which ships inside the app
    // bundle and can be extracted by anyone. It is therefore NOT proof of a
    // signed-in user. Verify the caller's JWT explicitly, or this function is
    // an open endpoint billed to our Anthropic account.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const {
      data: { user },
      error: authError,
    } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    }).auth.getUser();

    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Fail loudly rather than with an opaque 500 when the secret is missing.
    if (!Deno.env.get("ANTHROPIC_API_KEY")) {
      console.error("ANTHROPIC_API_KEY is not set");
      return json({ error: "The AI companion is not configured yet." }, 503);
    }

    const { message, mode, bookContext } = await req.json();

    if (!message) {
      return json({ error: "message is required" }, 400);
    }

    // ── Rate limit ────────────────────────────────────────────────────────
    // Atomic per-user daily counter. Uses the service role because ai_usage is
    // deliberately closed to end users (RLS on, no policies).
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: withinLimit, error: rateError } = await admin.rpc("increment_ai_usage", {
      p_user_id: user.id,
      p_limit: DAILY_MESSAGE_LIMIT,
    });

    if (rateError) {
      // Fail closed: if we cannot count it, we do not spend on it.
      console.error("Rate limit check failed:", rateError.message);
      return json({ error: "Could not verify your usage allowance. Please try again." }, 503);
    }
    if (withinLimit === false) {
      return json(
        { error: `You have reached today's limit of ${DAILY_MESSAGE_LIMIT} messages. See you tomorrow!` },
        429
      );
    }

    const client = new Anthropic();
    // ANTHROPIC_API_KEY is automatically read from the environment

    // Build a context-aware system prompt based on what the user is reading
    let systemPrompt = `You are a literary companion inside ReadScape, a personal reading tracker app. You help readers think more deeply about what they're reading.

Your expertise covers:
- Books: characters, plot, themes, symbolism, narrative structure, literary devices, author intent
- Authors: biography, writing style, body of work, historical and cultural context
- Word and phrase definitions: clear explanations of English words, idioms, and literary terms — include etymology when it adds genuine insight
- Reading recommendations: suggest books based on what the user enjoys, their current read, and their mood

You do NOT answer questions outside this scope (news, coding, general trivia, etc.).
If asked something unrelated, gently redirect: "I'm your reading companion — ask me about books, authors, or words!"

## CRITICAL RULES — follow these without exception:

1. NEVER invent or hallucinate specific book details.
   - Character names, plot events, and quotes you are not certain about must NOT be fabricated.
   - If the user names a character (e.g. "Nikki"), ALWAYS use that exact name. Never substitute a different name.
   - If you are not confident about a specific detail in a book, say so clearly: "I'm not certain about that detail — could you share a bit more context from the book?"

2. The reader is the authority on their own book.
   - Treat every detail the user shares (character names, plot points, page they're on) as ground truth.
   - Build your answer on what they tell you, not on assumptions.

3. Admit knowledge gaps honestly.
   - Some books — especially recent releases — may not be in your training data.
   - If that's the case, say so: "I may not have detailed knowledge of this book, but based on what you've shared, here's my take…"
   - Never guess character names, chapter events, or quotes. A confident wrong answer is worse than an honest "I'm not sure."

4. Be specific, not generic.
   - If you know the book well, give concrete details — specific chapters, named characters, actual themes from that work.
   - If you don't know it well, ask the user for context and reason from what they provide.

Tone: warm, bookish, and honest. Write like a thoughtful friend who loves books and is never afraid to say "I'm not sure — tell me more." Never exceed 3 short paragraphs. No bullet-point walls.`;

    if (bookContext) {
      systemPrompt += `\n\n--- Reader context ---`;
      systemPrompt += `\nCurrently reading: "${bookContext.title}" by ${bookContext.author}.`;
      if (bookContext.currentPage && bookContext.totalPages) {
        systemPrompt += ` On page ${bookContext.currentPage} of ${bookContext.totalPages} (${Math.round((bookContext.currentPage / bookContext.totalPages) * 100)}% through).`;
      }
      if (bookContext.lastMood) {
        systemPrompt += ` Current reading mood: ${bookContext.lastMood.replace(/_/g, " ")}.`;
      }
      systemPrompt += `\nTailor your answer to where they are in the book. Do NOT reveal plot events beyond their current page unless they explicitly ask for spoilers.`;
      systemPrompt += `\nIf the user mentions a character by name, use that exact name throughout your response — never substitute or "correct" it.`;
    } else {
      systemPrompt += `\n\nThe user hasn't added a book yet. Encourage them to add one so you can give personalised answers, but answer general book/author/word questions in the meantime.`;
    }

    // Mode-specific instructions
    if (mode === "define") {
      systemPrompt += `\n\n--- Mode: Define ---
The user wants a word, phrase, or literary term explained.
Structure your answer as:
1. Clear, plain-English definition (1–2 sentences)
2. Etymology or origin — only if it genuinely adds insight
3. An example of how it's used in literature (quote or description)
Keep the whole response under 150 words. Do not pad.`;
    } else if (mode === "recommend") {
      systemPrompt += `\n\n--- Mode: Recommend ---
Suggest exactly 3 books the user would likely enjoy.
For each: title, author, and one specific sentence explaining why it fits this reader right now.
Base recommendations on: their current book's genre/themes/tone, their mood, and any preferences they've mentioned.
Only recommend books you are confident exist — never fabricate titles or authors.`;
    } else if (mode === "themes") {
      systemPrompt += `\n\n--- Mode: Themes ---
Focus on literary analysis: themes, symbols, motifs, narrative structure, authorial intent, and historical context.
Be specific to the book the user is reading — use character names and plot elements you are certain about.
If you're uncertain about details in this specific book, say so and ask the user to share the passage or context, then analyse from there.`;
    } else {
      systemPrompt += `\n\n--- Mode: Chat ---
Answer the user's question about their book, the author, or a word/phrase.
If they mention a character by name, use that name exactly as they wrote it.
If you don't have confident knowledge of this specific book, acknowledge it and ask a clarifying question — then give the best answer you can based on what the user tells you.
Never guess at names, quotes, or plot details you're not sure about.`;
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";

    return json({ reply });
  } catch (error) {
    console.error("AI Companion error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
