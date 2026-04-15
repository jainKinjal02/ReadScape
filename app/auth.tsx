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
  SafeAreaView,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { colors } from "../src/design/tokens";
import { supabase } from "../src/lib/supabase";
import { useAppStore } from "../src/store";

const BG = "https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=1200&q=80";

type Mode = "signup" | "signin";

export default function AuthScreen() {
  const router = useRouter();
  const setUserId = useAppStore((s) => s.setUserId);
  const setUserName = useAppStore((s) => s.setUserName);

  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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
          router.replace("/(tabs)/home");
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
    fontFamily: "PlayfairDisplay_700Bold",
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
