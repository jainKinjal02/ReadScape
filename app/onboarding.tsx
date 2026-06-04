import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { colors } from "../src/design/tokens";
import { supabase } from "../src/lib/supabase";
import { useAppStore } from "../src/store";

const BG = "https://images.unsplash.com/photo-1476275466078-4cdc48d9e56f?w=1200&q=80";
const { width: SW } = Dimensions.get("window");

const GOALS = [
  { value: 6,  label: "Casual",    books: "6 books",  freq: "~1 every 2 months" },
  { value: 12, label: "Regular",   books: "12 books", freq: "~1 per month"       },
  { value: 24, label: "Avid",      books: "24 books", freq: "~2 per month"       },
  { value: 52, label: "Committed", books: "52 books", freq: "~1 per week"        },
];

const GENRES = [
  "Fiction", "Fantasy", "Mystery", "Romance", "Sci-Fi",
  "Non-Fiction", "Biography", "History", "Self-Help", "Horror",
  "Thriller", "Literary Fiction", "Poetry", "Graphic Novel", "Young Adult",
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const setReadingGoal = useAppStore((s) => s.setReadingGoal);
  const userName       = useAppStore((s) => s.userName);

  const [step, setStep]                     = useState<0 | 1>(0);
  const [goal, setGoal]                     = useState(12);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [loading, setLoading]               = useState(false);

  // Fade + subtle slide-up transition between steps
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepY       = useRef(new Animated.Value(0)).current;

  const transitionToGenres = () => {
    Animated.parallel([
      Animated.timing(stepOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(stepY,       { toValue: -24, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStep(1);
      stepY.setValue(28);
      Animated.parallel([
        Animated.timing(stepOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(stepY,       { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 120 }),
      ]).start();
    });
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await supabase.auth.updateUser({
        data: { reading_goal: goal, favorite_genres: selectedGenres },
      });
      setReadingGoal(goal);
    } catch {
      // Non-fatal — still enter the app
    } finally {
      router.replace("/(tabs)/home");
    }
  };

  const firstName = userName ? userName.split(" ")[0] : null;

  return (
    <View style={styles.container}>
      {/* Atmospheric background */}
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      <LinearGradient
        colors={["rgba(15,25,35,0.55)", "rgba(15,25,35,0.97)"]}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFill}
      />

      {/* Progress bar */}
      <View style={[styles.progressWrap, { paddingTop: insets.top + 18 }]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: step === 0 ? "50%" : "100%" }]} />
        </View>
        <Text style={styles.progressLabel}>{step + 1} of 2</Text>
      </View>

      {/* Step content */}
      <Animated.View
        style={[styles.stepWrap, { opacity: stepOpacity, transform: [{ translateY: stepY }] }]}
      >
        {step === 0 ? (
          /* ─── STEP 1: Reading Goal ─── */
          <View style={styles.stepInner}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>
                {firstName
                  ? `How many books\nthis year, ${firstName}?`
                  : "How many books\ndo you want to read?"}
              </Text>
              <Text style={styles.stepSub}>
                Set your reading goal. You can always adjust this later.
              </Text>
            </View>

            <View style={styles.goalGrid}>
              {GOALS.map((g) => {
                const selected = goal === g.value;
                return (
                  <TouchableOpacity
                    key={g.value}
                    style={[styles.goalCard, selected && styles.goalCardSelected]}
                    onPress={() => setGoal(g.value)}
                    activeOpacity={0.8}
                  >
                    {selected && (
                      <View style={styles.goalCheck}>
                        <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                          <Path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                      </View>
                    )}
                    <Text style={[styles.goalBooks, selected && styles.goalBooksSelected]}>
                      {g.books}
                    </Text>
                    <Text style={[styles.goalLabel, selected && styles.goalLabelSelected]}>
                      {g.label}
                    </Text>
                    <Text style={[styles.goalFreq, selected && styles.goalFreqSelected]}>
                      {g.freq}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={transitionToGenres} activeOpacity={0.87}>
              <Text style={styles.nextBtnText}>Continue</Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M5 12h14M12 5l7 7-7 7" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        ) : (
          /* ─── STEP 2: Genres ─── */
          <View style={styles.stepInner}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>{"What do you\nlove to read?"}</Text>
              <Text style={styles.stepSub}>
                Pick your favourites — helps personalise your recommendations.
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={styles.genreGrid}
              showsVerticalScrollIndicator={false}
              style={styles.genreScroll}
            >
              {GENRES.map((genre) => {
                const selected = selectedGenres.includes(genre);
                return (
                  <TouchableOpacity
                    key={genre}
                    style={[styles.genreChip, selected && styles.genreChipSelected]}
                    onPress={() => toggleGenre(genre)}
                    activeOpacity={0.8}
                  >
                    {selected && (
                      <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" style={{ marginRight: 5 }}>
                        <Path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    )}
                    <Text style={[styles.genreChipText, selected && styles.genreChipTextSelected]}>
                      {genre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.nextBtn, loading && { opacity: 0.7 }]}
              onPress={handleFinish}
              disabled={loading}
              activeOpacity={0.87}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>Enter ReadScape</Text>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 12h14M12 5l7 7-7 7" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipLink} onPress={handleFinish} disabled={loading}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      <View style={{ height: insets.bottom + 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1923" },

  // Progress bar
  progressWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    gap: 12,
    marginBottom: 8,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.terracotta,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
    minWidth: 32,
    textAlign: "right",
  },

  // Step container
  stepWrap:  { flex: 1 },
  stepInner: { flex: 1, paddingHorizontal: 28 },
  stepHeader: { paddingTop: 28, marginBottom: 28 },
  stepTitle: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 36,
    color: "#f0eef8",
    lineHeight: 44,
    marginBottom: 12,
  },
  stepSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 21,
  },

  // Goal cards — 2 × 2 grid
  goalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 32,
  },
  goalCard: {
    width: (SW - 56 - 12) / 2,
    backgroundColor: "rgba(22,32,48,0.88)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 16,
    position: "relative",
  },
  goalCardSelected: {
    borderColor: colors.terracotta,
    backgroundColor: "rgba(127,119,221,0.15)",
  },
  goalCheck: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  goalBooks: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 22,
    color: "rgba(255,255,255,0.45)",
    marginBottom: 4,
  },
  goalBooksSelected: { color: "#f0eef8" },
  goalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.38)",
    marginBottom: 4,
  },
  goalLabelSelected: { color: colors.terra2 },
  goalFreq: {
    fontSize: 11,
    color: "rgba(255,255,255,0.28)",
    lineHeight: 16,
  },
  goalFreqSelected: { color: "rgba(255,255,255,0.52)" },

  // Genre chips
  genreScroll: { flex: 1, marginBottom: 24 },
  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 8,
  },
  genreChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: "rgba(22,32,48,0.88)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  genreChipSelected: {
    backgroundColor: "rgba(127,119,221,0.2)",
    borderColor: colors.terracotta,
  },
  genreChipText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "500",
  },
  genreChipTextSelected: {
    color: "#f0eef8",
    fontWeight: "600",
  },

  // Buttons
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: colors.terracotta,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  nextBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  skipLink: {
    alignItems: "center",
    paddingVertical: 14,
  },
  skipText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
  },
});
