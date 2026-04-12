import React, { useEffect, useState } from "react";
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
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { useAppStore } from "../../src/store";
import { colors, moodConfig } from "../../src/design/tokens";
import { MoodChip } from "../../src/components/MoodChip";
import { Book, Mood } from "../../src/types";

const MOODS: Mood[] = [
  "loving_it", "getting_into_it", "struggling", "taking_a_break", "finished"
];

export default function ReadingSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAppStore();

  const [book, setBook] = useState<Book | null>(null);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [currentPage, setCurrentPage] = useState("");
  const [note, setNote] = useState("");
  const [quoteText, setQuoteText] = useState("");
  const [quotePage, setQuotePage] = useState("");
  const [showQuoteInput, setShowQuoteInput] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("books")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) {
          setBook(data as Book);
          setCurrentPage(String(data.current_page ?? ""));
        }
      });
  }, [id]);

  const saveSession = async () => {
    if (!book || !userId || !selectedMood) {
      Alert.alert("Pick a mood", "Let us know how you're feeling about this book.");
      return;
    }
    setSaving(true);

    const page = parseInt(currentPage) || book.current_page;

    // Log mood
    await supabase.from("mood_logs").insert({
      user_id: userId,
      book_id: book.id,
      page,
      mood: selectedMood,
      note: note.trim() || null,
    });

    // Update current page
    await supabase
      .from("books")
      .update({
        current_page: page,
        status: selectedMood === "finished" ? "read" : "reading",
        date_finished: selectedMood === "finished" ? new Date().toISOString() : null,
      })
      .eq("id", book.id);

    // Save quote if entered
    if (quoteText.trim()) {
      await supabase.from("quotes").insert({
        user_id: userId,
        book_id: book.id,
        text: quoteText.trim(),
        page: parseInt(quotePage) || page,
      });
    }

    setSaving(false);
    router.back();
  };

  if (!book) return <View style={styles.loading} />;

  return (
    <View style={{ flex: 1 }}>
      {/* Atmospheric background */}
      {book.cover_url ? (
        <>
          <Image
            source={{ uri: book.cover_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <BlurView intensity={80} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["rgba(247,244,239,0.6)", "rgba(247,244,239,0.95)"]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgPrimary }]} />
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerLabel}>Reading Session</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Book info */}
          <Text style={styles.bookTitle} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={styles.bookAuthor}>{book.author}</Text>

          {/* Page input */}
          <Text style={styles.label}>Current page</Text>
          <View style={styles.pageInputRow}>
            <TextInput
              style={styles.pageInput}
              value={currentPage}
              onChangeText={setCurrentPage}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.inkMuted}
            />
            {book.total_pages && (
              <Text style={styles.totalPages}>/ {book.total_pages}</Text>
            )}
          </View>

          {/* Mood selection */}
          <Text style={styles.label}>How are you feeling about this book?</Text>
          <View style={styles.moodGrid}>
            {MOODS.map((mood) => (
              <MoodChip
                key={mood}
                mood={mood}
                selected={selectedMood === mood}
                onPress={() => setSelectedMood(mood)}
              />
            ))}
          </View>

          {/* Quick note */}
          <Text style={styles.label}>What's on your mind? (optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="A thought, reaction, or feeling about where you are in the story..."
            placeholderTextColor={colors.inkMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

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
                placeholder="Type a passage that moved you..."
                placeholderTextColor={colors.inkMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                fontFamily="PlayfairDisplay_400Regular_Italic"
              />
              <TextInput
                style={styles.quotePageInput}
                value={quotePage}
                onChangeText={setQuotePage}
                placeholder="Page #"
                placeholderTextColor={colors.inkMuted}
                keyboardType="number-pad"
              />
            </View>
          )}

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={saveSession}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? "Saving..." : "Save Session ✓"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(45,45,45,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 16, color: colors.inkPrimary },
  headerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  bookTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 26,
    color: colors.inkPrimary,
    marginBottom: 6,
  },
  bookAuthor: { fontSize: 15, color: colors.inkMuted, marginBottom: 28 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.inkPrimary,
    marginBottom: 10,
    marginTop: 4,
  },
  pageInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 8,
  },
  pageInput: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: "700",
    color: colors.inkPrimary,
    width: 100,
    textAlign: "center",
    borderWidth: 1,
    borderColor: colors.bgSurface,
  },
  totalPages: { fontSize: 18, color: colors.inkMuted },
  moodGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
  noteInput: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: colors.inkPrimary,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.bgSurface,
    marginBottom: 20,
  },
  quoteToggle: {
    paddingVertical: 8,
    marginBottom: 12,
  },
  quoteToggleText: { fontSize: 14, color: colors.roseAccent, fontWeight: "600" },
  quoteSection: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.bgSurface,
  },
  quoteInput: {
    fontSize: 15,
    color: colors.inkPrimary,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    minHeight: 80,
    marginBottom: 8,
  },
  quotePageInput: {
    fontSize: 13,
    color: colors.inkMuted,
    borderTopWidth: 1,
    borderTopColor: colors.bgSurface,
    paddingTop: 8,
  },
  saveBtn: {
    backgroundColor: colors.roseAccent,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
});
