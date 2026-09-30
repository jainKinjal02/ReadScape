import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
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

/** Apple sign-in only exists on iOS devices, and not on every one. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/**
 * Sign in with Apple through the native sheet, then hand Apple's identity
 * token to Supabase.
 *
 * App Store Review Guideline 4.8: an app that offers Google sign-in must offer
 * this too.
 *
 * The nonce ties the token to this attempt so a captured token cannot be
 * replayed. Apple receives the SHA-256 hash; Supabase gets the raw value and
 * checks that it hashes to what is inside the token.
 *
 * Apple shares the reader's name only on the very first sign-in, ever, and
 * never again, so it is saved to their profile straight away.
 */
export async function signInWithApple(): Promise<void> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e: any) {
    if (e?.code === "ERR_REQUEST_CANCELED") throw new OAuthCancelledError();
    throw e;
  }

  if (!credential.identityToken) throw new Error("Apple did not return a sign-in token.");

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  const name = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(" ");
  if (name) {
    await supabase.auth.updateUser({ data: { name, full_name: name } }).catch(() => {});
  }
}

/**
 * Permanently delete the signed-in reader's account, their library, notes,
 * photos and voice recordings, then sign out on this device.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  // The account no longer exists, so the server has nothing to revoke; only
  // this device's copy of the session needs clearing.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
}
