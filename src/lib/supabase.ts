import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

// These are inlined into the bundle at build time, so changing .env.local
// requires a Metro restart (`npx expo start --clear`), not just a reload.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Without this, a missing env var surfaces much later as a confusing wall of
  // "Network request failed" from every screen at once.
  throw new Error(
    "Supabase is not configured. Copy .env.example to .env.local, fill in " +
      "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart " +
      "Metro with `npx expo start --clear`."
  );
}

/**
 * Auth session storage.
 *
 * Native: SecureStore (iOS Keychain / Android Keystore) — encrypted and
 * access-controlled by the OS. AsyncStorage is plaintext and would leave the
 * refresh token readable to anyone with the device.
 *
 * Web: SecureStore does not exist. localStorage is the standard equivalent
 * and is what supabase-js uses by default in a browser.
 */

// SecureStore warns (and on some Android devices fails) above 2048 bytes per
// value. A Supabase session carrying OAuth provider tokens — which is exactly
// what Google sign-in adds — can exceed that, and the failure mode is a silent
// logout on next launch. So split large values across numbered keys.
const CHUNK_SIZE = 1800;
const CHUNK_MARKER = "__chunks__:";

const NativeSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const head = await SecureStore.getItemAsync(key);
    if (head === null) return null;
    if (!head.startsWith(CHUNK_MARKER)) return head;

    const count = Number(head.slice(CHUNK_MARKER.length));
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      // A partially-written value is unusable; report absent so supabase-js
      // re-authenticates cleanly instead of parsing a truncated session.
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        `${key}.${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      );
    }
    await SecureStore.setItemAsync(key, `${CHUNK_MARKER}${count}`);
  },

  async removeItem(key: string): Promise<void> {
    const head = await SecureStore.getItemAsync(key);
    if (head?.startsWith(CHUNK_MARKER)) {
      const count = Number(head.slice(CHUNK_MARKER.length));
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}.${i}`);
      }
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const WebLocalStorage = {
  getItem: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: async (key: string, value: string) => {
    globalThis.localStorage?.setItem(key, value);
  },
  removeItem: async (key: string) => {
    globalThis.localStorage?.removeItem(key);
  },
};

const storage = Platform.OS === "web" ? WebLocalStorage : NativeSecureStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    // On web the OAuth redirect returns tokens in the URL fragment and
    // supabase-js must consume them. On native the redirect arrives as a deep
    // link into the `readscape://` scheme, which the app handles explicitly.
    detectSessionInUrl: Platform.OS === "web",
  },
});
