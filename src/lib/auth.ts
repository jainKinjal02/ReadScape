import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

// Dismisses the auth popup once the provider redirects back (web) and settles
// any pending session on native. Safe to call at module scope.
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = "google";

/** Thrown when the user closes the provider sheet themselves. Not an error to surface. */
export class OAuthCancelledError extends Error {
  constructor() {
    super("Sign-in was cancelled.");
    this.name = "OAuthCancelledError";
  }
}

/**
 * Pull tokens out of the URL the provider redirects back to.
 *
 * Supabase can return either shape depending on the configured flow, so handle
 * both rather than betting on one:
 *   PKCE     → ?code=...            (exchanged server-side for a session)
 *   Implicit → #access_token=...&refresh_token=...
 */
async function completeSessionFromUrl(url: string): Promise<void> {
  const parsed = new URL(url);

  const code = parsed.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  // The fragment is not parsed by URL(), so read it manually.
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const access_token = fragment.get("access_token");
  const refresh_token = fragment.get("refresh_token");

  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return;
  }

  // Providers report failures as query params rather than HTTP errors.
  const providerError =
    parsed.searchParams.get("error_description") ??
    parsed.searchParams.get("error") ??
    fragment.get("error_description") ??
    fragment.get("error");

  throw new Error(providerError ?? "Sign-in did not return a session.");
}

/**
 * Sign in with a third-party provider.
 *
 * Web: hand off to the browser and let it navigate. supabase-js consumes the
 * tokens on return via `detectSessionInUrl`, so this function does not resolve
 * with a session — the page reloads.
 *
 * Native: open a system auth session and catch the `readscape://` deep link
 * back. A system browser (rather than a webview) is what lets the provider
 * reuse an existing Google session, and is what Google requires.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<void> {
  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: globalThis.location?.origin },
    });
    if (error) throw error;
    return;
  }

  // Resolves to readscape://auth/callback in a build, exp://.../--/auth/callback
  // in Expo Go. Both must be listed as Supabase redirect URLs.
  const redirectTo = Linking.createURL("auth/callback");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      // We present the browser ourselves so we can await the redirect.
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Could not start sign-in.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === "cancel" || result.type === "dismiss") {
    throw new OAuthCancelledError();
  }
  if (result.type !== "success") {
    throw new Error("Sign-in did not complete.");
  }

  await completeSessionFromUrl(result.url);
}

export const signInWithGoogle = () => signInWithProvider("google");
