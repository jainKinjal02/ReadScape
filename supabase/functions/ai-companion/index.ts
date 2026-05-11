import Anthropic from "npm:@anthropic-ai/sdk";

// This Edge Function runs on Supabase's servers (Deno runtime).
// The ANTHROPIC_API_KEY environment variable is set in the Supabase dashboard
// (Project Settings → Edge Functions → Environment Variables).
// It NEVER gets sent to the mobile app — this is the key security benefit.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, mode, bookContext } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = new Anthropic();
    // ANTHROPIC_API_KEY is automatically read from the environment

    // Build a context-aware system prompt based on what the user is reading
    let systemPrompt = `You are a focused literary companion inside ReadScape, a personal reading tracker app.

Your expertise is strictly limited to:
- Books: plots, characters, themes, symbolism, narrative structure, literary devices
- Authors: biography, writing style, other works, historical context
- Word definitions and translations: explain English words, literary terms, and phrases clearly — include etymology when it adds insight
- Reading recommendations: suggest books based on what the user enjoys

You do NOT answer questions outside this scope (news, coding, general knowledge, etc.).
If asked something unrelated, gently redirect: "I'm your reading companion — ask me about books, authors, or words!"

Tone: warm, bookish, concise. Never exceed 3 paragraphs. No bullet-point walls — write like a thoughtful friend who loves books.`;

    if (bookContext) {
      systemPrompt += `\n\n--- Reader context ---`;
      systemPrompt += `\nCurrently reading: "${bookContext.title}" by ${bookContext.author}.`;
      if (bookContext.currentPage && bookContext.totalPages) {
        systemPrompt += ` On page ${bookContext.currentPage} of ${bookContext.totalPages} (${Math.round((bookContext.currentPage / bookContext.totalPages) * 100)}% through).`;
      }
      if (bookContext.lastMood) {
        systemPrompt += ` Current reading mood: ${bookContext.lastMood.replace(/_/g, " ")}.`;
      }
      systemPrompt += `\nTailor answers to where they are in the book — avoid spoilers for events beyond their current page unless they explicitly ask.`;
    } else {
      systemPrompt += `\n\nThe user hasn't added a book yet. Encourage them to add one, and answer general book/author/word questions in the meantime.`;
    }

    // Mode-specific instructions
    if (mode === "define") {
      systemPrompt += `\n\n--- Mode: Define ---\nThe user wants a word or literary term explained. Give: (1) a clear definition, (2) etymology or origin if interesting, (3) an example of how it appears in literature. Keep it under 150 words.`;
    } else if (mode === "recommend") {
      systemPrompt += `\n\n--- Mode: Recommend ---\nSuggest exactly 3 books. For each: title, author, and one compelling sentence on why it fits. Base recommendations on the user's current book, mood, and reading taste. No lengthy descriptions.`;
    } else if (mode === "themes") {
      systemPrompt += `\n\n--- Mode: Themes ---\nFocus on literary analysis: themes, symbols, motifs, narrative structure, and authorial intent. Be specific to the book the user is reading. Avoid generic observations.`;
    } else {
      systemPrompt += `\n\n--- Mode: Chat ---\nAnswer the user's question about their book, the author, or a word/phrase. Be specific, not generic. If the question is about the current book, use your knowledge of it to give a meaningful answer.`;
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";

    return new Response(
      JSON.stringify({ reply }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("AI Companion error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
