import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";

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
//
// Sign in with Apple accounts are also revoked with Apple (guideline
// 5.1.1(v)), so Readscape leaves the reader's Apple ID settings. The app
// sends a fresh authorization code; this trades it for a refresh token and
// revokes that. It needs a Sign in with Apple key from the Apple developer
// account, set as secrets: APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
// (the .p8 file's contents) and optionally APPLE_CLIENT_ID (defaults to the
// bundle id). Without them, or if Apple fails, the account is still
// deleted: a reader must never be left unable to delete their account.

const APPLE = "https://appleid.apple.com";

async function appleClientSecret(clientId: string): Promise<string | null> {
  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const pem = Deno.env.get("APPLE_PRIVATE_KEY");
  if (!teamId || !keyId || !pem) return null;
  // Secrets pasted into the dashboard sometimes arrive with literal "\n".
  const key = await importPKCS8(pem.replace(/\\n/g, "\n").trim(), "ES256");
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience(APPLE)
    .setSubject(clientId)
    .sign(key);
}

/** Revoke the reader's Sign in with Apple authorization. Never throws. */
async function revokeApple(authorizationCode: string): Promise<void> {
  try {
    const clientId = Deno.env.get("APPLE_CLIENT_ID") ?? "com.readscape.app";
    const secret = await appleClientSecret(clientId);
    if (!secret) {
      console.warn("Apple revoke skipped: APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY not set");
      return;
    }
    const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };

    const tokenRes = await fetch(`${APPLE}/auth/token`, {
      method: "POST",
      headers,
      body: form({ client_id: clientId, client_secret: secret, code: authorizationCode, grant_type: "authorization_code" }),
    });
    const tokens = await tokenRes.json().catch(() => ({}));
    const token: string | undefined = tokens.refresh_token ?? tokens.access_token;
    if (!tokenRes.ok || !token) {
      console.error("Apple token exchange failed:", tokenRes.status, JSON.stringify(tokens));
      return;
    }

    const revokeRes = await fetch(`${APPLE}/auth/revoke`, {
      method: "POST",
      headers,
      body: form({
        client_id: clientId,
        client_secret: secret,
        token,
        token_type_hint: tokens.refresh_token ? "refresh_token" : "access_token",
      }),
    });
    if (!revokeRes.ok) console.error("Apple revoke failed:", revokeRes.status, await revokeRes.text());
  } catch (e) {
    console.error("Apple revoke error:", e);
  }
}

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

    // ── Sign in with Apple ───────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    if (typeof body?.appleAuthorizationCode === "string" && body.appleAuthorizationCode) {
      await revokeApple(body.appleAuthorizationCode);
    }

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
