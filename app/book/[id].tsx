import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  Modal,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Polyline, Circle, Line } from "react-native-svg";
import { supabase } from "../../src/lib/supabase";
import { useAppStore } from "../../src/store";
import { colors, moodConfig } from "../../src/design/tokens";
import { BookCover } from "../../src/components/BookCover";
import { Book, Quote, Note, MoodLog } from "../../src/types";

type Tab = "overview" | "notes" | "quotes" | "mood_arc";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAppStore();

  const [book, setBook] = useState<Book | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [newNote, setNewNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const fetchBook = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("books").select("*").eq("id", id).single();
    if (data) setBook(data as Book);
  }, [id]);

  const fetchTabData = useCallback(async () => {
    if (!id || !userId) return;
    if (activeTab === "quotes") {
      const { data } = await supabase
        .from("quotes")
        .select("*")
        .eq("book_id", id)
        .order("created_at", { ascending: false });
      setQuotes((data ?? []) as Quote[]);
    } else if (activeTab === "notes") {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("book_id", id)
        .order("created_at", { ascending: false });
      setNotes((data ?? []) as Note[]);
    } else if (activeTab === "mood_arc") {
      const { data } = await supabase
        .from("mood_logs")
        .select("*")
        .eq("book_id", id)
        .order("created_at", { ascending: true });
      setMoodLogs((data ?? []) as MoodLog[]);
    }
  }, [id, userId, activeTab]);

  useEffect(() => { fetchBook(); }, [fetchBook]);
  useEffect(() => { fetchTabData(); }, [fetchTabData]);

  const addNote = async () => {
    if (!newNote.trim() || !userId || !id) return;
    await supabase.from("notes").insert({
      user_id: userId,
      book_id: id,
      text: newNote.trim(),
    });
    setNewNote("");
    setShowNoteInput(false);
    fetchTabData();
  };

  const updateStatus = async (status: Book["status"]) => {
    if (!id) return;
    await supabase.from("books").update({ status }).eq("id", id);
    fetchBook();
  };

  const updateRating = async (rating: number) => {
    if (!id) return;
    await supabase.from("books").update({ rating }).eq("id", id);
    fetchBook();
  };

  if (!book) return <View style={styles.loading} />;

  const progress = book.total_pages
    ? Math.round((book.current_page / book.total_pages) * 100)
    : 0;

  return (
    <View style={styles.container}>
      {/* Hero header */}
      <View style={styles.hero}>
        {book.cover_url && (
          <Image
            source={{ uri: book.cover_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.2)", "rgba(247,244,239,1)"]}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.heroContent}>
          <BookCover uri={book.cover_url} title={book.title} width={90} height={134} borderRadius={10} />
          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle} numberOfLines={3}>{book.title}</Text>
            <Text style={styles.heroAuthor}>{book.author}</Text>
            {/* Star rating */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => updateRating(s)}>
                  <Text style={styles.star}>
                    {s <= (book.rating ?? 0) ? "★" : "☆"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.readNowBtn}
              onPress={() => router.push(`/session/${book.id}`)}
            >
              <Text style={styles.readNowText}>Read Now →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(["overview", "notes", "quotes", "mood_arc"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === tab && styles.tabBtnTextActive,
              ]}
            >
              {tabLabel(tab)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {activeTab === "overview" && (
          <OverviewTab book={book} progress={progress} onStatusChange={updateStatus} />
        )}
        {activeTab === "notes" && (
          <NotesTab
            notes={notes}
            newNote={newNote}
            setNewNote={setNewNote}
            showInput={showNoteInput}
            setShowInput={setShowNoteInput}
            onAdd={addNote}
          />
        )}
        {activeTab === "quotes" && <QuotesTab quotes={quotes} />}
        {activeTab === "mood_arc" && <MoodArcTab moodLogs={moodLogs} />}
      </ScrollView>
    </View>
  );
}

function OverviewTab({
  book,
  progress,
  onStatusChange,
}: {
  book: Book;
  progress: number;
  onStatusChange: (s: Book["status"]) => void;
}) {
  const statuses: Book["status"][] = ["reading", "read", "want_to_read", "abandoned"];
  return (
    <View style={styles.tabSection}>
      {/* Progress */}
      <View style={styles.progressCard}>
        <View style={styles.progressBarBig}>
          <View style={[styles.progressFillBig, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressTextBig}>
          {book.current_page} of {book.total_pages ?? "?"} pages ({progress}%)
        </Text>
      </View>

      {/* Status */}
      <Text style={styles.overviewLabel}>Status</Text>
      <View style={styles.statusRow}>
        {statuses.map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.statusChip,
              book.status === s && styles.statusChipActive,
            ]}
            onPress={() => onStatusChange(s)}
          >
            <Text
              style={[
                styles.statusChipText,
                book.status === s && styles.statusChipTextActive,
              ]}
            >
              {s.replace("_", " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Synopsis */}
      {book.synopsis && (
        <>
          <Text style={styles.overviewLabel}>About this book</Text>
          <Text style={styles.synopsisText}>{book.synopsis}</Text>
        </>
      )}

      {/* Genres */}
      {book.genre?.length > 0 && (
        <View style={styles.genreRow}>
          {book.genre.map((g) => (
            <View key={g} style={styles.genreTag}>
              <Text style={styles.genreTagText}>{g}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function NotesTab({
  notes,
  newNote,
  setNewNote,
  showInput,
  setShowInput,
  onAdd,
}: {
  notes: Note[];
  newNote: string;
  setNewNote: (t: string) => void;
  showInput: boolean;
  setShowInput: (b: boolean) => void;
  onAdd: () => void;
}) {
  return (
    <View style={styles.tabSection}>
      <TouchableOpacity
        style={styles.addItemBtn}
        onPress={() => setShowInput(!showInput)}
      >
        <Text style={styles.addItemBtnText}>+ Add Note</Text>
      </TouchableOpacity>
      {showInput && (
        <View style={styles.addItemCard}>
          <TextInput
            style={styles.noteTextInput}
            value={newNote}
            onChangeText={setNewNote}
            placeholder="Write your thought..."
            placeholderTextColor={colors.inkMuted}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.saveItemBtn} onPress={onAdd}>
            <Text style={styles.saveItemBtnText}>Save Note</Text>
          </TouchableOpacity>
        </View>
      )}
      {notes.map((note) => (
        <View key={note.id} style={styles.noteCard}>
          <Text style={styles.noteText}>{note.text}</Text>
          <Text style={styles.noteDate}>{formatDate(note.created_at)}</Text>
        </View>
      ))}
      {notes.length === 0 && !showInput && (
        <Text style={styles.emptyTabText}>No notes yet. Add your first thought.</Text>
      )}
    </View>
  );
}

function QuotesTab({ quotes }: { quotes: Quote[] }) {
  return (
    <View style={styles.tabSection}>
      {quotes.map((q) => (
        <View key={q.id} style={styles.quoteCard}>
          <Text style={styles.quoteOpenQuote}>❝</Text>
          <Text style={styles.quoteText}>{q.text}</Text>
          {q.page && <Text style={styles.quotePage}>— p. {q.page}</Text>}
        </View>
      ))}
      {quotes.length === 0 && (
        <Text style={styles.emptyTabText}>
          No quotes saved yet. Capture a quote during your next reading session.
        </Text>
      )}
    </View>
  );
}

function MoodArcTab({ moodLogs }: { moodLogs: MoodLog[] }) {
  const W = SCREEN_WIDTH - 64;
  const H = 160;
  const PADDING = 20;

  if (moodLogs.length === 0) {
    return (
      <View style={styles.tabSection}>
        <Text style={styles.emptyTabText}>
          Your Mood Arc will appear here once you start logging your feelings during reading sessions.
        </Text>
      </View>
    );
  }

  const scores = moodLogs.map((m) => moodConfig[m.mood]?.score ?? 3);
  const maxScore = 5;
  const points = scores.map((score, i) => {
    const x = PADDING + (i / Math.max(scores.length - 1, 1)) * (W - PADDING * 2);
    const y = H - PADDING - ((score - 1) / (maxScore - 1)) * (H - PADDING * 2);
    return { x, y, mood: moodLogs[i].mood, page: moodLogs[i].page };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View style={styles.tabSection}>
      <Text style={styles.moodArcTitle}>Your Mood Arc</Text>
      <Text style={styles.moodArcSubtitle}>
        How your feelings about this book changed over time
      </Text>
      <View style={styles.chartContainer}>
        <Svg width={W} height={H}>
          {/* Grid lines */}
          {[1, 2, 3, 4, 5].map((score) => {
            const y = H - PADDING - ((score - 1) / 4) * (H - PADDING * 2);
            return (
              <Line
                key={score}
                x1={PADDING}
                y1={y}
                x2={W - PADDING}
                y2={y}
                stroke={colors.bgSurface}
                strokeWidth={1}
              />
            );
          })}
          {/* Line */}
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={colors.roseAccent}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Data points */}
          {points.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={5}
              fill={colors.roseAccent}
              stroke={colors.bgCard}
              strokeWidth={2}
            />
          ))}
        </Svg>
      </View>

      {/* Legend */}
      <View style={styles.arcLegend}>
        {moodLogs.map((log, i) => (
          <View key={log.id} style={styles.arcLegendItem}>
            <Text style={styles.arcLegendEmoji}>{moodConfig[log.mood]?.emoji}</Text>
            <Text style={styles.arcLegendLabel}>{moodConfig[log.mood]?.label}</Text>
            {log.page && (
              <Text style={styles.arcLegendPage}>p. {log.page}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function tabLabel(tab: Tab) {
  const map: Record<Tab, string> = {
    overview: "Overview",
    notes: "Notes",
    quotes: "Quotes",
    mood_arc: "Mood Arc ✨",
  };
  return map[tab];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  loading: { flex: 1, backgroundColor: colors.bgPrimary },
  hero: {
    height: 260,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  backBtn: {
    position: "absolute",
    top: 56,
    left: 20,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backBtnText: { fontSize: 13, color: colors.inkPrimary, fontWeight: "600" },
  heroContent: {
    flexDirection: "row",
    padding: 20,
    gap: 14,
    alignItems: "flex-end",
  },
  heroInfo: { flex: 1 },
  heroTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: colors.inkPrimary,
    marginBottom: 4,
  },
  heroAuthor: { fontSize: 13, color: colors.inkMuted, marginBottom: 8 },
  starsRow: { flexDirection: "row", marginBottom: 10 },
  star: { fontSize: 20, color: colors.roseAccent, marginRight: 2 },
  readNowBtn: {
    backgroundColor: colors.roseAccent,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  readNowText: { color: "#FFF", fontSize: 12, fontWeight: "600" },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgSurface,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: colors.roseAccent },
  tabBtnText: { fontSize: 11, color: colors.inkMuted, fontWeight: "500" },
  tabBtnTextActive: { color: colors.roseAccent, fontWeight: "700" },
  tabContent: { flex: 1 },
  tabSection: { padding: 20, paddingBottom: 60 },
  progressCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  progressBarBig: {
    height: 8,
    backgroundColor: colors.bgSurface,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFillBig: {
    height: 8,
    backgroundColor: colors.roseAccent,
    borderRadius: 999,
  },
  progressTextBig: { fontSize: 13, color: colors.inkMuted },
  overviewLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  statusChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.bgSurface,
  },
  statusChipActive: { backgroundColor: colors.roseSoft, borderWidth: 1.5, borderColor: colors.roseAccent },
  statusChipText: { fontSize: 12, color: colors.inkMuted },
  statusChipTextActive: { color: colors.roseAccent, fontWeight: "600" },
  synopsisText: { fontSize: 14, color: colors.inkPrimary, lineHeight: 22, marginBottom: 16 },
  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  genreTag: {
    backgroundColor: colors.bgSurface,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  genreTagText: { fontSize: 11, color: colors.inkMuted },
  addItemBtn: {
    backgroundColor: colors.roseAccent,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  addItemBtnText: { color: "#FFF", fontWeight: "600", fontSize: 13 },
  addItemCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.bgSurface,
  },
  noteTextInput: {
    fontSize: 14,
    color: colors.inkPrimary,
    minHeight: 80,
    marginBottom: 10,
  },
  saveItemBtn: {
    backgroundColor: colors.roseAccent,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  saveItemBtnText: { color: "#FFF", fontWeight: "600", fontSize: 13 },
  noteCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  noteText: { fontSize: 14, color: colors.inkPrimary, lineHeight: 20, marginBottom: 6 },
  noteDate: { fontSize: 11, color: colors.inkMuted },
  quoteCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  quoteOpenQuote: {
    fontSize: 32,
    color: colors.roseSoft,
    lineHeight: 36,
    marginBottom: 4,
  },
  quoteText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 15,
    color: colors.inkPrimary,
    lineHeight: 24,
    marginBottom: 8,
  },
  quotePage: { fontSize: 12, color: colors.inkMuted },
  emptyTabText: { fontSize: 14, color: colors.inkMuted, lineHeight: 22 },
  moodArcTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: colors.inkPrimary,
    marginBottom: 6,
  },
  moodArcSubtitle: { fontSize: 13, color: colors.inkMuted, marginBottom: 20, lineHeight: 18 },
  chartContainer: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  arcLegend: { gap: 8 },
  arcLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    padding: 10,
  },
  arcLegendEmoji: { fontSize: 20 },
  arcLegendLabel: { flex: 1, fontSize: 13, color: colors.inkPrimary },
  arcLegendPage: { fontSize: 11, color: colors.inkMuted },
});
