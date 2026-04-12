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
    let systemPrompt = `You are a warm, knowledgeable literary companion inside ReadScape, a personal reading tracker app.
You are conversational, insightful, and passionate about books. Keep responses concise — 2-4 paragraphs max.`;

    if (bookContext) {
      systemPrompt += `\n\nThe user is currently reading: "${bookContext.title}" by ${bookContext.author}.`;
      if (bookContext.currentPage && bookContext.totalPages) {
        systemPrompt += ` They are on page ${bookContext.currentPage} of ${bookContext.totalPages}.`;
      }
      if (bookContext.lastMood) {
        systemPrompt += ` Their last logged mood was: ${bookContext.lastMood.replace(/_/g, " ")}.`;
      }
    }

    // Tailor the AI's behaviour based on the selected mode
    if (mode === "define") {
      systemPrompt += `\n\nThe user wants word or concept definitions. Provide the definition, etymology if interesting, and how it might appear in literary contexts. Be concise.`;
    } else if (mode === "recommend") {
      systemPrompt += `\n\nThe user wants book recommendations. Suggest 3-4 specific books with brief reasons why they'd enjoy each, based on what they're currently reading and their mood.`;
    } else {
      systemPrompt += `\n\nThe user wants to chat about their reading. Answer questions about the book, characters, themes, author, or anything literary. Avoid spoilers unless asked.`;
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
