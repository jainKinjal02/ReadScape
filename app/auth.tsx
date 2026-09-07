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
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { colors } from "../src/design/tokens";
import { supabase } from "../src/lib/supabase";
import { signInWithGoogle, OAuthCancelledError } from "../src/lib/auth";
import { useAppStore } from "../src/store";

const BG = "https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=1200&q=80";

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
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      {/* Background image */}
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      <LinearGradient
        colors={["rgba(15,25,35,0.55)", "rgba(15,25,35,0.96)"]}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFill}
      />

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
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>

            {/* Logo */}
            <View style={styles.logoBlock}>
              <Text style={styles.appName}>
                <Text style={{ color: "#f0eef8" }}>Read</Text>
                <Text style={{ color: "#7F77DD" }}>Scape</Text>
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
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  logoBlock: {
    marginTop: 32,
    marginBottom: 32,
  },
  appName: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 42,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 0.2,
  },

  // Tab toggle
  toggle: {
    flexDirection: "row",
    backgroundColor: "rgba(22,32,48,0.85)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cream3,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: colors.terracotta,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.char3,
  },
  toggleTextActive: {
    color: "#ffffff",
  },

  // Form card
  card: {
    backgroundColor: "rgba(19,30,44,0.88)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(127,119,221,0.2)",
    padding: 22,
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.espresso2,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.cream2,
    borderWidth: 1.5,
    borderColor: colors.cream3,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.espresso,
  },
  inputFocused: {
    borderColor: colors.terracotta,
    backgroundColor: "rgba(127,119,221,0.08)",
  },

  errorBox: {
    backgroundColor: "rgba(180,60,60,0.15)",
    borderWidth: 1,
    borderColor: "rgba(180,60,60,0.35)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    color: "#e88080",
    fontSize: 13,
    lineHeight: 18,
  },

  submitBtn: {
    backgroundColor: colors.terracotta,
    borderRadius: 14,
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
    backgroundColor: "rgba(127,119,221,0.18)",
  },
  dividerText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginHorizontal: 12,
    letterSpacing: 0.5,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 14,
    paddingVertical: 15,
  },
  googleText: {
    color: colors.inkPrimary,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  hint: {
    textAlign: "center",
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
  },
  hintLink: {
    color: colors.terra2,
    fontWeight: "600",
  },
});
