import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet as RNStyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { colors, moodConfig } from "../../src/design/tokens";
import { CoverImage } from "../../src/components/CoverImage";
import { CURRENT_BOOK } from "../../src/data/mockData";

type Mood = "loving_it" | "getting_into_it" | "struggling" | "taking_a_break" | "finished";
const MOODS: Mood[] = ["loving_it", "getting_into_it", "struggling", "taking_a_break", "finished"];
const QUICK_TAGS = ["Plot twist", "Beautiful writing", "Slow chapter", "Favourite scene", "Confusing part"];

export default function ReadingSessionScreen() {
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [currentPage, setCurrentPage] = useState(CURRENT_BOOK.currentPage);
  const [note, setNote] = useState("");
  const [quoteText, setQuoteText] = useState("");
  const [showQuoteInput, setShowQuoteInput] = useState(false);

  const adjustPage = (delta: number) => {
    setCurrentPage((p) => Math.max(0, Math.min(CURRENT_BOOK.totalPages, p + delta)));
  };

  const progress = Math.round((currentPage / CURRENT_BOOK.totalPages) * 100);

  const saveSession = () => {
    if (!selectedMood) {
      Alert.alert("Pick a mood", "Let us know how you're feeling about this book.");
      return;
    }
    Alert.alert(
      "Session saved!",
      `Page ${currentPage} logged. Great reading session!`,
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Atmospheric blurred book cover background */}
      <Image
        source={{ uri: CURRENT_BOOK.cover }}
        style={[RNStyleSheet.absoluteFill, { opacity: 0.35 }]}
        contentFit="cover"
      />
      <BlurView intensity={60} style={RNStyleSheet.absoluteFill} />
      <LinearGradient
        colors={["rgba(247,242,235,0.55)", colors.cream]}
        locations={[0, 0.55]}
        style={RNStyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={styles.sessHdr}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 12H5M12 5l-7 7 7 7"
                stroke={colors.char3}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.backTxt}>Back</Text>
          </TouchableOpacity>
          <View style={styles.sessBookRow}>
            <CoverImage uri={CURRENT_BOOK.cover} title={CURRENT_BOOK.title} style={styles.sessCover} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sessTitle} numberOfLines={1}>{CURRENT_BOOK.title}</Text>
              <Text style={styles.sessAuthor}>{CURRENT_BOOK.author} · Reading session</Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Page counter */}
          <View style={styles.section}>
            <Text style={styles.sectionLbl}>Where did you stop?</Text>
            <View style={styles.pageRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pageNum}>{currentPage}</Text>
                <Text style={styles.pageOf}>of {CURRENT_BOOK.totalPages} pages</Text>
              </View>
              <View style={styles.pageBtns}>
                <TouchableOpacity style={styles.pageBtn} onPress={() => adjustPage(10)}>
                  <Text style={styles.pageBtnText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pageBtn} onPress={() => adjustPage(-10)}>
                  <Text style={styles.pageBtnText}>−</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.progBg}>
              <View style={[styles.progFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progPct}>{progress}% complete</Text>
          </View>

          {/* Mood grid */}
          <View style={styles.section}>
            <Text style={styles.sectionLbl}>How are you feeling right now?</Text>
            <View style={styles.moodGrid}>
              {MOODS.map((mood) => {
                const cfg = moodConfig[mood];
                const sel = selectedMood === mood;
                return (
                  <TouchableOpacity
                    key={mood}
                    style={[styles.moodOpt, sel && styles.moodOptSel]}
                    onPress={() => setSelectedMood(mood)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.moodEmoji}>{cfg.symbol}</Text>
                    <Text style={[styles.moodName, sel && styles.moodNameSel]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Note */}
          <View style={styles.section}>
            <Text style={styles.sectionLbl}>Quick note (optional)</Text>
            <View style={styles.noteBox}>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="What's on your mind about this book…"
                placeholderTextColor={colors.cream3}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            <View style={styles.quickTags}>
              {QUICK_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.qtag}
                  onPress={() => setNote((n) => n ? `${n}, ${tag}` : tag)}
                >
                  <Text style={styles.qtagText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Quote capture */}
          <TouchableOpacity
            style={styles.quoteToggle}
            onPress={() => setShowQuoteInput(!showQuoteInput)}
          >
            <Text style={styles.quoteToggleText}>
              {showQuoteInput ? "▼ Hide quote capture" : "❝ Capture a quote"}
            </Text>
          </TouchableOpacity>

          {showQuoteInput && (
            <View style={styles.quoteSection}>
              <TextInput
                style={styles.quoteInput}
                value={quoteText}
                onChangeText={setQuoteText}
                placeholder="Type a passage that moved you…"
                placeholderTextColor={colors.char3}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          )}

          {/* Save */}
          <TouchableOpacity style={styles.saveBtn} onPress={saveSession} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Save check-in</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  sessHdr: {
    backgroundColor: "rgba(250,246,240,0.92)",
    borderBottomWidth: 1, borderBottomColor: colors.cream3,
    paddingHorizontal: 20, paddingVertical: 14,
    paddingTop: 52,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  backTxt: { fontSize: 13, color: colors.char3 },
  sessBookRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  sessCover: { width: 40, height: 58, borderRadius: 4 },
  sessTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 15, color: colors.espresso },
  sessAuthor: { fontSize: 12, color: colors.char3, marginTop: 2 },

  body: { padding: 20 },
  section: { marginBottom: 20 },
  sectionLbl: {
    fontSize: 11, fontWeight: "600", color: colors.espresso2,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10,
  },

  pageRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(250,246,240,0.9)", borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 12, padding: 14, gap: 12,
  },
  pageNum: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 32, color: colors.espresso },
  pageOf: { fontSize: 12, color: colors.char3 },
  pageBtns: { flexDirection: "column", gap: 6 },
  pageBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.cream3,
    alignItems: "center", justifyContent: "center",
  },
  pageBtnText: { fontSize: 20, color: colors.espresso, lineHeight: 24 },
  progBg: { height: 4, backgroundColor: colors.cream3, borderRadius: 4, marginTop: 10 },
  progFill: { height: 4, backgroundColor: colors.terracotta, borderRadius: 4 },
  progPct: { fontSize: 11, color: colors.char3, marginTop: 4 },

  moodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  moodOpt: {
    width: "30.5%", backgroundColor: "rgba(250,246,240,0.9)",
    borderWidth: 1.5, borderColor: colors.cream3,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6, alignItems: "center",
  },
  moodOptSel: { backgroundColor: "rgba(201,124,90,0.1)", borderColor: colors.terracotta },
  moodEmoji: { fontSize: 20, marginBottom: 4 },
  moodName: { fontSize: 11, color: colors.char3, fontWeight: "500", textAlign: "center" },
  moodNameSel: { color: colors.terracotta },

  noteBox: {
    backgroundColor: "rgba(250,246,240,0.9)", borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 12, padding: 14, minHeight: 80,
  },
  noteInput: { fontSize: 13, color: colors.espresso, minHeight: 60 },
  quickTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  qtag: {
    paddingVertical: 5, paddingHorizontal: 11, borderRadius: 14,
    borderWidth: 1, borderColor: colors.cream3, backgroundColor: "rgba(250,246,240,0.9)",
  },
  qtagText: { fontSize: 11, color: colors.char3 },

  quoteToggle: { paddingVertical: 8, marginBottom: 12 },
  quoteToggleText: { fontSize: 13, color: colors.terracotta, fontWeight: "600" },
  quoteSection: {
    backgroundColor: "rgba(250,246,240,0.9)", borderRadius: 12,
    padding: 14, marginBottom: 20, borderWidth: 1, borderColor: colors.cream3,
  },
  quoteInput: { fontSize: 14, color: colors.espresso, minHeight: 80 },

  saveBtn: {
    backgroundColor: colors.espresso, borderRadius: 24, paddingVertical: 15, alignItems: "center",
  },
  saveBtnText: { color: colors.cream, fontSize: 15, fontWeight: "600" },
});
