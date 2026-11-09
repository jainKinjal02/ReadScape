import { createClient } from "npm:@supabase/supabase-js@2";

// Turns a reader's spoken reflection into something the app can file away.
//
//   1. The app uploads the recording to the private `voice-notes` bucket and
//      sends us its path.
//   2. OpenAI transcribes it.
//   3. An OpenAI text model sorts the transcript into a mood, a quote read
//      aloud, and the reader's own thought, rewritten as clean English.
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

// gpt-4o-transcribe hears accents, mixed languages and quiet stretches far
// better than whisper-1, which skips whole passages it can't place. whisper-1
// stays as the fallback if the newer model is unavailable on the account.
const TRANSCRIBE_MODELS = ["gpt-4o-transcribe", "whisper-1"];

// Natural speech runs 110 to 160 words a minute. Far fewer than this over a
// long recording means the transcriber dropped part of it.
const MIN_WORDS_PER_MINUTE = 45;

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

async function transcribe(
  openaiKey: string,
  audio: Blob,
  model: string,
  book: { title?: string; author?: string } | undefined
): Promise<string | null> {
  const form = new FormData();
  form.append("file", new File([audio], "note.m4a", { type: "audio/mp4" }));
  form.append("model", model);
  // A spelling and context hint, not an instruction. Book titles and
  // character names are exactly what transcription tends to mangle.
  const about = book?.title ? ` about "${book.title}"${book.author ? ` by ${book.author}` : ""}` : "";
  form.append(
    "prompt",
    `A reader's spoken note${about}. They may mix English with Hindi or another language, pause to think, or read a passage aloud.`
  );

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form,
  });
  if (!res.ok) {
    console.error(`Transcription error (${model}):`, res.status, await res.text());
    return null;
  }
  return String((await res.json()).text ?? "").trim();
}

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

    // durationMs is sent by app versions from 1.0.1 on; older ones omit it.
    const { audioPath, book, durationMs } = await req.json();

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

    // Try each model in turn until one gives a transcript long enough for the
    // recording. If none does, keep the longest: some words beat none.
    const minutes = typeof durationMs === "number" && durationMs > 0 ? durationMs / 60000 : null;
    let transcript: string | null = null;
    for (const model of TRANSCRIBE_MODELS) {
      const heard = await transcribe(openaiKey, audio, model, book);
      if (heard === null) continue;
      if (transcript === null || wordCount(heard) > wordCount(transcript)) transcript = heard;
      if (minutes === null || minutes < 0.75 || wordCount(heard) / minutes >= MIN_WORDS_PER_MINUTE) break;
      console.warn(`${model} heard ${wordCount(heard)} words in ${minutes.toFixed(1)} min; trying the next model`);
    }
    if (transcript === null) {
      return json({ error: "Couldn't transcribe that recording. Please try again." }, 502);
    }

    if (!transcript) {
      return json({ transcript: "", mood: null, quote: null, page: null, thought: null });
    }

    // ── Sort it ───────────────────────────────────────────────────────────
    const moodList = Object.entries(MOODS)
      .map(([value, meaning]) => `- ${value}: ${meaning}`)
      .join("\n");

    const system = `You turn a reader's spoken note about a book into an entry in their reading journal, the way a good dictation app turns speech into clean writing.

The note is a transcript of speech. It may ramble, repeat itself, contain filler words and false starts, mishear words, and mix English with Hindi or another language, in any script. From it, write:

mood: which of these best matches how the reader says the book is making them feel. Use null if they do not express a feeling about the book.
${moodList}

quote: a passage the reader read aloud from the book, without surrounding quotation marks. Readers often introduce one with "there's this line", "it says", or "quote". Keep the passage's own words and language; only fix punctuation and obvious mishearings. Use null if they did not read one. Never compose or recall a quote yourself.

page: the page number of that quote if the reader said it, otherwise null.

thought: everything else the reader said, written up as clear, natural, grammatical English in their own first-person voice.
- Keep every point, detail, example and feeling they mention, in the order they said it. This is a rewrite for readability, never a summary: a two-minute note should still read as several full sentences or short paragraphs, not one line.
- Translate anything said in Hindi or another language into English, and write it all in the Latin alphabet.
- Remove filler words ("um", "like", "you know"), false starts, repetition, and spoken signposts such as "point one" or "okay so".
- Fix grammar and obvious transcription mistakes, and spell names from the book correctly.
- Do not add opinions, interpretation or anything they did not say, and do not include the quote.
- Separate distinct points into paragraphs with a blank line between them when the note is long.
Use null only if the note is nothing but a quote.`;

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
          // A three-minute note rewritten in full, plus room for reasoning.
          max_output_tokens: 6000,
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
