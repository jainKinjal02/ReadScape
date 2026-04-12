import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { colors } from "../src/design/tokens";

const GENRES = [
  "Fiction", "Fantasy", "Mystery", "Romance", "Sci-Fi",
  "Non-Fiction", "Biography", "History", "Self-Help", "Horror",
  "Thriller", "Literary", "Poetry", "Graphic Novel", "Young Adult",
];

const GOALS = [6, 12, 24, 52];

type Step = "auth" | "profile" | "goals";

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("auth");
  const [isSignIn, setIsSignIn] = useState(false);

  // Auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Profile fields
  const [name, setName] = useState("");
  const [goal, setGoal] = useState(12);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      if (isSignIn) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/(tabs)/home");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setStep("profile");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("user_profiles").upsert({
      user_id: user.id,
      name: name || email.split("@")[0],
      reading_goal: goal,
      favorite_genres: selectedGenres,
    });

    router.replace("/(tabs)/home");
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  if (step === "auth") {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.headline}>
            {isSignIn ? "Welcome back" : "Begin your journey"}
          </Text>
          <Text style={styles.subheadline}>
            {isSignIn
              ? "Sign in to continue reading"
              : "Create your personal reading sanctuary"}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={colors.inkMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.inkMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? "..." : isSignIn ? "Sign In" : "Create Account"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchLink}
            onPress={() => setIsSignIn(!isSignIn)}
          >
            <Text style={styles.switchText}>
              {isSignIn
                ? "New here? Create an account"
                : "Already have an account? Sign in"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (step === "profile") {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.headline}>What should we call you?</Text>

          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.inkMuted}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.sectionLabel}>Reading goal (books/year)</Text>
          <View style={styles.goalRow}>
            {GOALS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.goalChip, goal === g && styles.goalChipSelected]}
                onPress={() => setGoal(g)}
              >
                <Text
                  style={[
                    styles.goalChipText,
                    goal === g && styles.goalChipTextSelected,
                  ]}
                >
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep("goals")}>
            <Text style={styles.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.headline}>What do you love to read?</Text>
        <Text style={styles.subheadline}>Pick your favorite genres</Text>
        <ScrollView contentContainerStyle={styles.genreGrid}>
          {GENRES.map((genre) => (
            <TouchableOpacity
              key={genre}
              style={[
                styles.genreChip,
                selectedGenres.includes(genre) && styles.genreChipSelected,
              ]}
              onPress={() => toggleGenre(genre)}
            >
              <Text
                style={[
                  styles.genreChipText,
                  selectedGenres.includes(genre) && styles.genreChipTextSelected,
                ]}
              >
                {genre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleFinish}>
          <Text style={styles.primaryBtnText}>Enter ReadScape →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { flex: 1, padding: 32, justifyContent: "center" },
  headline: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: colors.inkPrimary,
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 15,
    color: colors.inkMuted,
    marginBottom: 32,
    lineHeight: 22,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.inkPrimary,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.bgSurface,
  },
  primaryBtn: {
    backgroundColor: colors.roseAccent,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  switchLink: { alignItems: "center", marginTop: 16 },
  switchText: { color: colors.inkMuted, fontSize: 13 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkPrimary,
    marginTop: 24,
    marginBottom: 12,
  },
  goalRow: { flexDirection: "row", gap: 12 },
  goalChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.bgSurface,
    alignItems: "center",
  },
  goalChipSelected: { backgroundColor: colors.roseSoft, borderWidth: 1.5, borderColor: colors.roseAccent },
  goalChipText: { fontSize: 18, fontWeight: "600", color: colors.inkMuted },
  goalChipTextSelected: { color: colors.roseAccent },
  genreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 8 },
  genreChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.bgSurface,
  },
  genreChipSelected: { backgroundColor: colors.roseSoft, borderWidth: 1.5, borderColor: colors.roseAccent },
  genreChipText: { fontSize: 13, color: colors.inkPrimary },
  genreChipTextSelected: { color: colors.roseAccent, fontWeight: "600" },
});
