import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fonts } from "../../src/design/tokens";
import { supabase } from "../../src/lib/supabase";
import { useAppStore } from "../../src/store";

/**
 * Where the sign-up confirmation email lands: readscape://auth/callback.
 *
 * Confirming on the same phone that signed up finishes the sign-in here (the
 * PKCE verifier from sign-up is still in this phone's keychain), and the
 * reader goes straight on to onboarding. Confirming anywhere else, say a
 * laptop's mail app opening the link on the phone, still confirms the email
 * but cannot sign in, so the reader is sent to Sign In instead.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  // The router has already parsed the link. Reading it from Linking.useURL()
  // instead can return the app's launch URL rather than this link, and then
  // the code is never seen.
  const { code, error_description } = useLocalSearchParams<{
    code?: string;
    error_description?: string;
  }>();
  const setUserId = useAppStore((s) => s.setUserId);
  const setUserName = useAppStore((s) => s.setUserName);
  const [failed, setFailed] = useState(false);
  // The code last acted on; a newer link arriving while this screen is open
  // is handled too.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const key = code ?? error_description ?? "";
    if (handled.current === key) return;
    handled.current = key;
    setFailed(false);

    (async () => {
      try {
        if (!code) throw new Error(error_description ?? "No code in the link");
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("No session");

        const meta = session.user.user_metadata ?? {};
        setUserId(session.user.id);
        setUserName(meta.name ?? meta.full_name ?? "Reader");
        const onboarded = Number(meta.reading_goal) > 0;
        router.replace(onboarded ? "/(tabs)/home" : "/onboarding");
      } catch {
        setFailed(true);
      }
    })();
  }, [code, error_description]);

  if (!failed) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator color={colors.ink} />
        <Text style={styles.sub}>Signing you in…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>You're confirmed</Text>
      <Text style={styles.sub}>Sign in with your email and password to start reading.</Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.replace("/auth?mode=signin")}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>Sign in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1, backgroundColor: colors.paper,
    alignItems: "center", justifyContent: "center", padding: 32, gap: 14,
  },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.pencil, textAlign: "center", lineHeight: 20 },
  btn: {
    marginTop: 10, backgroundColor: colors.ink, borderRadius: 3,
    paddingVertical: 14, paddingHorizontal: 48,
  },
  btnText: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.paper },
});
