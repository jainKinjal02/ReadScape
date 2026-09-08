import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { colors, fonts } from "../src/design/tokens";
import { supabase } from "../src/lib/supabase";
import { signInWithGoogle, OAuthCancelledError } from "../src/lib/auth";
import { useAppStore } from "../src/store";

type Mode = "signup" | "signin";

/** Google's brand mark. Must be the official colours — Google's branding
 *  guidelines do not allow a recoloured or monochrome "G" on a sign-in button. */
function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

export default function AuthScreen() {
  const router = useRouter();
  const setUserId = useAppStore((s) => s.setUserId);
  const setUserName = useAppStore((s) => s.setUserName);

  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(initialMode === "signin" ? "signin" : "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setName("");
    setEmail("");
    setPassword("");
  };

  const handleSubmit = async () => {
    setError("");

    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (err) throw err;

        if (data.session) {
          // Email confirmation disabled — session returned immediately
          setUserId(data.session.user.id);
          setUserName(data.session.user.user_metadata?.name ?? name.trim());
          router.replace("/onboarding");
        } else {
          Alert.alert(
            "Check your email ✉️",
            `We sent a confirmation link to ${email.trim()}. Tap it to activate your account, then sign in.`,
            [{ text: "Got it", onPress: () => switchMode("signin") }]
          );
        }
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (err) throw err;
        setUserId(data.session.user.id);
        setUserName(data.session.user.user_metadata?.name ?? "Reader");
        router.replace("/(tabs)/home");
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();

      // On web the browser navigates away and nothing below this runs.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Sign-in did not complete. Please try again.");
        return;
      }

      const meta = session.user.user_metadata ?? {};
      setUserId(session.user.id);
      setUserName(meta.name ?? meta.full_name ?? "Reader");

      // Google gives us a name and email but never a reading goal, so a
      // first-time Google user still needs onboarding.
      const onboarded = Number(meta.reading_goal) > 0;
      router.replace(onboarded ? "/(tabs)/home" : "/onboarding");
    } catch (e: any) {
      // Backing out of the provider sheet is a normal action, not a failure.
      if (e instanceof OAuthCancelledError) return;
      setError(e?.message ?? "Could not sign in with Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const inp = (field: string) => [
    styles.input,
    focused === field && styles.inputFocused,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back */}
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M19 12H5M12 5l-7 7 7 7"
                  stroke={colors.ink}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>

            {/* Logo */}
            <View style={styles.logoBlock}>
              <Text style={styles.appName}>
                <Text style={{ color: colors.ink }}>Read</Text>
                <Text style={{ color: colors.blushInk }}>Scape</Text>
              </Text>
              <Text style={styles.tagline}>
                {mode === "signup"
                  ? "Start your reading journey"
                  : "Welcome back, reader"}
              </Text>
            </View>

            {/* Tab toggle */}
            <View style={styles.toggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, mode === "signup" && styles.toggleBtnActive]}
                onPress={() => switchMode("signup")}
              >
                <Text style={[styles.toggleText, mode === "signup" && styles.toggleTextActive]}>
                  Create Account
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, mode === "signin" && styles.toggleBtnActive]}
                onPress={() => switchMode("signin")}
              >
                <Text style={[styles.toggleText, mode === "signin" && styles.toggleTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.card}>
              {mode === "signup" && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Your name</Text>
                  <TextInput
                    style={inp("name")}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Alex"
                    placeholderTextColor={colors.char3}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  ref={emailRef}
                  style={inp("email")}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.char3}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TextInput
                  ref={passwordRef}
                  style={inp("password")}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.char3}
                  secureTextEntry
                  returnKeyType="done"
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  onSubmitEditing={handleSubmit}
                />
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.65 }]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitText}>
                    {mode === "signup" ? "Create Account" : "Sign In"}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.googleBtn, googleLoading && { opacity: 0.65 }]}
                onPress={handleGoogle}
                disabled={googleLoading || loading}
                activeOpacity={0.85}
              >
                {googleLoading ? (
                  <ActivityIndicator color={colors.inkPrimary} size="small" />
                ) : (
                  <>
                    <GoogleMark />
                    <Text style={styles.googleText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Switch mode hint */}
            <Text style={styles.hint}>
              {mode === "signup" ? "Already have an account? " : "New to ReadScape? "}
              <Text
                style={styles.hintLink}
                onPress={() => switchMode(mode === "signup" ? "signin" : "signup")}
              >
                {mode === "signup" ? "Sign in" : "Create account"}
              </Text>
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  backBtn: {
    marginTop: 12,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "flex-start",
  },

  logoBlock: {
    marginTop: 32,
    marginBottom: 32,
  },
  appName: {
    fontFamily: fonts.display,
    fontSize: 42,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.pencil,
    letterSpacing: 0.1,
  },

  // Tab toggle
  toggle: {
    flexDirection: "row",
    gap: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    marginBottom: 22,
  },
  toggleBtn: {
    paddingBottom: 9,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  toggleBtnActive: {
    borderBottomColor: colors.ink,
  },
  toggleText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    color: colors.pencil,
  },
  toggleTextActive: {
    color: colors.ink,
  },

  // Form card
  card: {
    backgroundColor: colors.card,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.rule,
    padding: 22,
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    color: colors.pencil,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 7,
  },
  // Underline inputs rather than boxes: less chrome, more notebook.
  input: {
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    paddingHorizontal: 0,
    paddingVertical: 9,
    fontFamily: fonts.body,
    fontSize: 15.5,
    color: colors.ink,
  },
  inputFocused: {
    borderBottomColor: colors.ink,
  },

  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 3,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: fonts.body,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },

  submitBtn: {
    backgroundColor: colors.ink,
    borderRadius: 3,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  submitText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.rule,
  },
  dividerText: {
    fontFamily: fonts.body,
    color: colors.pencil,
    fontSize: 12,
    marginHorizontal: 12,
    letterSpacing: 0.5,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderRadius: 3,
    paddingVertical: 14,
  },
  googleText: {
    fontFamily: fonts.bodySemi,
    color: colors.ink,
    fontSize: 14.5,
    letterSpacing: 0.1,
  },

  hint: {
    textAlign: "center",
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.pencil,
  },
  hintLink: {
    fontFamily: fonts.bodySemi,
    color: colors.ink,
    textDecorationLine: "underline",
  },
});
