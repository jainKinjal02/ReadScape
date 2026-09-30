import { createClient } from "npm:@supabase/supabase-js@2";

// Turns a reader's spoken reflection into something the app can file away.
//
//   1. The app uploads the recording to the private `voice-notes` bucket and
//      sends us its path.
//   2. Whisper transcribes it.
//   3. An OpenAI text model sorts the transcript into a mood, a quote read
//      aloud, and the reader's own thought.
//
// Nothing is saved here. The app shows the result for review first, because
// a transcription will sometimes mishear a quote and the reader should get
// the chance to fix it before it lands in their notes.
//
// Secret (set with `supabase secrets set` or the dashboard): OPENAI_API_KEY.

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

// Shares the ai-companion counter: both spend on the same accounts.
const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "20");
const BUCKET = "voice-notes";

// Database values on the left, what the app shows on the right. The values are
// historical and misleading ("finished" is shown as "Moved"), so the model is
// told what each one means to the reader rather than left to guess.
const MOODS = {
  loving_it: "Loving it: delighted, enjoying it, warm about the book",
  getting_into_it: "Hooked: gripped, can't put it down, eager to keep going",
  struggling: "Slow read: a slog, bored, finding it hard going",
  taking_a_break: "Tense: anxious, unsettled, on edge about what happens",
  finished: "Moved: emotionally affected, touched, heartbroken, wrecked",
} as const;

// OpenAI strict mode: every field required, nothing extra, and "no value"
// written as a null type rather than with anyOf.
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    mood: { type: ["string", "null"], enum: [...Object.keys(MOODS), null] },
    quote: { type: ["string", "null"] },
    page: { type: ["integer", "null"] },
    thought: { type: ["string", "null"] },
  },
  required: ["mood", "quote", "page", "thought"],
  additionalProperties: false,
};

const SORTING_MODEL = "gpt-6-luna";

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Authentication ────────────────────────────────────────────────────
    // Same reasoning as ai-companion: the anon key ships in the app bundle,
    // so verify the caller's JWT or this is an open, metered endpoint.
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

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("OPENAI_API_KEY is not set");
      return json({ error: "Voice notes are not configured yet." }, 503);
    }

    const { audioPath, book } = await req.json();

    // The service role below can read any object, so the path must be proven
    // to belong to the caller before it is used.
    if (typeof audioPath !== "string" || !audioPath.startsWith(`${user.id}/`) || audioPath.includes("..")) {
      return json({ error: "audioPath is invalid" }, 400);
    }

    // ── Rate limit ────────────────────────────────────────────────────────
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: withinLimit, error: rateError } = await admin.rpc("increment_ai_usage", {
      p_user_id: user.id,
      p_limit: DAILY_LIMIT,
    });

    if (rateError) {
      console.error("Rate limit check failed:", rateError.message);
      return json({ error: "Could not verify your usage allowance. Please try again." }, 503);
    }
    if (withinLimit === false) {
      return json({ error: `You have reached today's limit of ${DAILY_LIMIT}. See you tomorrow!` }, 429);
    }

    // ── Transcribe ────────────────────────────────────────────────────────
    const { data: audio, error: downloadError } = await admin.storage.from(BUCKET).download(audioPath);
    if (downloadError || !audio) {
      console.error("Download failed:", downloadError?.message);
      return json({ error: "Couldn't find that recording." }, 404);
    }

    const form = new FormData();
    form.append("file", new File([audio], "note.m4a", { type: "audio/mp4" }));
    form.append("model", "whisper-1");
    // Whisper's prompt is a spelling hint, not an instruction. Book titles and
    // character names are exactly what it tends to mangle.
    if (book?.title) {
      form.append("prompt", `A reader's note about "${book.title}"${book.author ? ` by ${book.author}` : ""}.`);
    }

    const whisper = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });
    if (!whisper.ok) {
      console.error("Whisper error:", whisper.status, await whisper.text());
      return json({ error: "Couldn't transcribe that recording. Please try again." }, 502);
    }
    const transcript = String((await whisper.json()).text ?? "").trim();

    if (!transcript) {
      return json({ transcript: "", mood: null, quote: null, page: null, thought: null });
    }

    // ── Sort it ───────────────────────────────────────────────────────────
    const moodList = Object.entries(MOODS)
      .map(([value, meaning]) => `- ${value}: ${meaning}`)
      .join("\n");

    const system = `You file a reader's spoken note about a book into their reading journal.

The note is a transcript of speech, so it may ramble, repeat itself, or contain filler words. From it, extract:

mood: which of these best matches how the reader says the book is making them feel. Use null if they do not express a feeling about the book.
${moodList}

quote: a passage the reader read aloud from the book, word for word as transcribed, without surrounding quotation marks. Readers often introduce one with "there's this line", "it says", or "quote". Use null if they did not read one. Never compose or recall a quote yourself.

page: the page number of that quote if the reader said it, otherwise null.

thought: the reader's own reflection, in their own voice and first person, with filler words and false starts removed. Keep their wording; do not summarise it into your own words, add interpretation, or include the quote. Use null if the note is only a quote.`;

    const context = book?.title
      ? `Book: "${book.title}"${book.author ? ` by ${book.author}` : ""}.\n\n`
      : "";

    // If it cannot be sorted, the reader still gets their words back as the
    // thought, rather than losing the recording to an error. The transcript
    // has already been paid for; an outage or an empty credit balance should
    // cost the reader the sorting, not the note.
    const fallback = { transcript, mood: null, quote: null, page: null, thought: transcript };

    let text: string | undefined;
    try {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: SORTING_MODEL,
          input: [
            { role: "system", content: system },
            { role: "user", content: `${context}Transcript:\n${transcript}` },
          ],
          text: {
            format: { type: "json_schema", name: "voice_note", strict: true, schema: RESULT_SCHEMA },
          },
          max_output_tokens: 2000,
        }),
      });
      if (!res.ok) {
        console.error("Sorting failed:", res.status, await res.text());
        return json(fallback);
      }

      // The answer is a message item whose content is either the JSON text
      // or, if the model declined, a refusal.
      const body = await res.json();
      const message = (body.output ?? []).find((item: { type: string }) => item.type === "message");
      const part = (message?.content ?? [])[0];
      if (body.status !== "completed" || part?.type !== "output_text") {
        console.error("Sorting incomplete or refused:", body.status, JSON.stringify(part ?? null));
        return json(fallback);
      }
      text = part.text;
    } catch (error) {
      console.error("Sorting failed:", error);
      return json(fallback);
    }

    try {
      const parsed = JSON.parse(text ?? "");
      return json({ transcript, ...parsed });
    } catch {
      console.error("Unparseable result:", text);
      return json(fallback);
    }
  } catch (error) {
    console.error("Voice note error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
