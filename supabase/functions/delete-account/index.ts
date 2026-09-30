import { createClient } from "npm:@supabase/supabase-js@2";

// Permanently deletes the calling reader's account and everything in it.
//
// App Store Review Guideline 5.1.1(v): an app that lets people create an
// account must let them delete it from inside the app.
//
// Deleting the auth user cascades to every table (each references auth.users
// with `on delete cascade`). Storage objects do not cascade, so photos and
// voice recordings are removed first, found through the rows that point at
// them. Files go before the account: if the account deletion then fails the
// reader can simply try again, whereas the reverse order could leave their
// photos and voice behind with nothing left to find them by.

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const {
      data: { user },
      error: authError,
    } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    }).auth.getUser();

    // The only account this can ever delete is the caller's own.
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Files ─────────────────────────────────────────────────────────────
    const [photos, notes] = await Promise.all([
      admin.from("photos").select("storage_path").eq("user_id", user.id),
      admin.from("notes").select("audio_path").eq("user_id", user.id).not("audio_path", "is", null),
    ]);
    if (photos.error || notes.error) {
      console.error("Listing files failed:", photos.error?.message ?? notes.error?.message);
      return json({ error: "Couldn't delete your account. Please try again." }, 500);
    }

    const removeAll = async (bucket: string, paths: string[]) => {
      // Storage removes up to 1000 paths per call.
      for (let i = 0; i < paths.length; i += 1000) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 1000));
        if (error) throw error;
      }
    };

    await removeAll("book-photos", photos.data.map((p) => p.storage_path));
    await removeAll("voice-notes", notes.data.map((n) => n.audio_path as string));

    // ── Account and all rows ─────────────────────────────────────────────
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Deleting user failed:", deleteError.message);
      return json({ error: "Couldn't delete your account. Please try again." }, 500);
    }

    return json({ deleted: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return json({ error: "Couldn't delete your account. Please try again." }, 500);
  }
});
