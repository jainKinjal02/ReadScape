import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../src/design/tokens";
import { CoverImage } from "../../src/components/CoverImage";
import { useAppStore } from "../../src/store";
import { Quote, Note } from "../../src/types";
import {
  updateBookRating,
  updateBookStatus,
  updateCurrentPage,
  markBookFinished,
  deleteBook,
  toggleFavorite,
  fetchQuotes,
  addQuote,
  deleteQuote,
  fetchNotes,
  addNote,
  deleteNote,
} from "../../src/lib/books";
import { BookStatus } from "../../src/types";

type Tab = "quotes" | "notes";

const STATUS_LABELS: Record<string, string> = {
  reading:      "Reading",
  read:         "Read",
  want_to_read: "Want to Read",
  abandoned:    "Abandoned",
};

const STATUS_COLORS: Record<string, string> = {
  reading:      "#9b95e8",
  read:         "#5bbfaa",
  want_to_read: "#b8b4d4",
  abandoned:    "#7a7a9a",
};

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAppStore((s) => s.userId);
  const books = useAppStore((s) => s.books);
  const updateBook = useAppStore((s) => s.updateBook);
  const removeBook = useAppStore((s) => s.removeBook);

  const book = books.find((b) => b.id === id) ?? null;

  const [activeTab, setActiveTab] = useState<Tab>("quotes");
  const [rating, setRating] = useState(book?.rating ?? 0);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  // Current page editing
  const [pageEditing, setPageEditing] = useState(false);
  const [pageInput, setPageInput] = useState(String(book?.current_page ?? 0));

  const progress =
    book && book.total_pages && book.total_pages > 0
      ? Math.min(100, Math.round((book.current_page / book.total_pages) * 100))
      : 0;

  useEffect(() => {
    if (!id) return;
    setLoadingData(true);
    Promise.all([fetchQuotes(id), fetchNotes(id)])
      .then(([q, n]) => {
        setQuotes(q);
        setNotes(n);
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [id]);

  const handleRating = async (star: number) => {
    if (!book) return;
    setRating(star);
    updateBook({ ...book, rating: star });
    if (id) await updateBookRating(id, star).catch(() => {});
  };

  const handleStatusChange = async (status: BookStatus) => {
    if (!id || !book) return;
    updateBook({ ...book, status });
    await updateBookStatus(id, status).catch(() => {});
  };

  const handlePageSave = async () => {
    if (!id || !book) return;
    const raw = Number(pageInput) || 0;
    const page = book.total_pages ? Math.min(raw, book.total_pages) : raw;
    setPageEditing(false);
    setPageInput(String(page));
    // Auto-finish if user reached total pages
    if (book.total_pages && page >= book.total_pages) {
      updateBook({ ...book, current_page: page, status: "read", date_finished: new Date().toISOString() });
      await markBookFinished(id, page).catch(() => {});
    } else {
      updateBook({ ...book, current_page: page });
      await updateCurrentPage(id, page).catch(() => {});
    }
  };

  const handleMarkFinished = async () => {
    if (!id || !book) return;
    const totalPages = book.total_pages ?? book.current_page;
    updateBook({ ...book, status: "read", current_page: totalPages, date_finished: new Date().toISOString() });
    setPageInput(String(totalPages));
    await markBookFinished(id, totalPages).catch(() => {});
  };

  const handleToggleFavorite = async () => {
    if (!id || !book) return;
    const next = !book.is_favorite;
    updateBook({ ...book, is_favorite: next });
    await toggleFavorite(id, next).catch(() => {});
  };

  const handleDeleteBook = () => {
    Alert.alert(
      "Remove from Library",
      `Remove "${book?.title}" from your library? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!id) return;
            removeBook(id);
            router.back();
            await deleteBook(id).catch(() => {});
          },
        },
      ]
    );
  };

  const handleAddQuote = async (text: string, page: number | null) => {
    if (!userId || !id) return;
    try {
      const q = await addQuote(userId, id, text, page);
      setQuotes((prev) => [q, ...prev]);
    } catch {
      Alert.alert("Couldn't save quote", "Please try again.");
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
    await deleteQuote(quoteId).catch(() => {});
  };

  const handleAddNote = async (text: string) => {
    if (!userId || !id) return;
    try {
      const n = await addNote(userId, id, text);
      setNotes((prev) => [n, ...prev]);
    } catch {
      Alert.alert("Couldn't save note", "Please try again.");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    await deleteNote(noteId).catch(() => {});
  };

  if (!book) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.terracotta} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.cream }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[2]}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Hero blurred background ── */}
        <View style={[styles.bdHero, { paddingTop: insets.top + 8 }]}>
          {/* Clip only the background layers, not the floating cover */}
          <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
            {book.cover_url ? (
              <Image
                source={{ uri: book.cover_url }}
                style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.25 }] }]}
                contentFit="cover"
              />
            ) : null}
            <BlurView intensity={50} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(15,25,35,0.05)", colors.cream]}
              locations={[0, 1]}
              style={[StyleSheet.absoluteFill, { top: "35%" }]}
            />
          </View>

          {/* Back / Favourite / Delete buttons */}
          <View style={styles.bdTopRow}>
            <TouchableOpacity style={styles.bdCircleBtn} onPress={() => router.back()}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M19 12H5M12 5l-7 7 7 7"
                  stroke={colors.espresso}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={styles.bdCircleBtn} onPress={handleToggleFavorite}>
                <Svg width={16} height={16} viewBox="0 0 24 24"
                  fill={book.is_favorite ? "#e74c3c" : "none"}
                >
                  <Path
                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                    stroke="#e74c3c"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bdCircleBtn} onPress={handleDeleteBook}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                    stroke="#c0392b"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>

          {/* Floating cover */}
          <View style={styles.bdCoverWrap}>
            <View style={styles.bdCoverShadow}>
              <CoverImage uri={book.cover_url ?? ""} title={book.title} style={styles.bdCoverImg} />
            </View>
          </View>
        </View>

        {/* ── Book info ── */}
        <View style={styles.bdInfo}>
          <Text style={styles.bdTitle}>{book.title}</Text>
          {!!book.author && (
            <Text style={styles.bdAuthor}>by {book.author}</Text>
          )}

          {/* Genre + page count tags */}
          <View style={styles.bdTags}>
            {(book.genre ?? []).map((g) => (
              <View key={g} style={styles.bdTag}>
                <Text style={styles.bdTagText}>{g}</Text>
              </View>
            ))}
            {!!book.total_pages && (
              <View style={styles.bdTag}>
                <Text style={styles.bdTagText}>{book.total_pages} pages</Text>
              </View>
            )}
          </View>

          {/* Tappable status chips */}
          <View style={styles.statusChips}>
            {(["reading", "read", "want_to_read", "abandoned"] as BookStatus[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, book.status === s && { backgroundColor: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] }]}
                onPress={() => handleStatusChange(s)}
              >
                <Text style={[styles.statusChipText, book.status === s && styles.statusChipTextActive]}>
                  {STATUS_LABELS[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Star rating */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => handleRating(s)}>
                <Text style={[styles.star, s <= rating && styles.starFilled]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Synopsis */}
          {!!book.synopsis && (
            <Text style={styles.synopsis} numberOfLines={4}>{book.synopsis}</Text>
          )}
        </View>

        {/* ── Progress section ── */}
        <View style={styles.bdProgSection}>
          <View style={styles.bdProgRow}>
            <Text style={styles.bdProgLabel}>Reading progress</Text>
            <Text style={styles.bdProgPct}>{progress}%</Text>
          </View>
          <View style={styles.progBg}>
            <View style={[styles.progFill, { width: `${progress}%` }]} />
          </View>
          <View style={styles.bdStatsMini}>
            {/* Editable current page */}
            <TouchableOpacity
              style={styles.bdStatMini}
              onPress={() => { setPageEditing(true); setPageInput(String(book.current_page)); }}
              activeOpacity={0.7}
            >
              {pageEditing ? (
                <TextInput
                  style={styles.pageEditInput}
                  value={pageInput}
                  onChangeText={setPageInput}
                  keyboardType="number-pad"
                  autoFocus
                  onBlur={handlePageSave}
                  onSubmitEditing={handlePageSave}
                  selectTextOnFocus
                />
              ) : (
                <Text style={[styles.bdStatV, { color: colors.terracotta }]}>{book.current_page}</Text>
              )}
              <Text style={styles.bdStatL}>Tap to edit page</Text>
            </TouchableOpacity>
            <View style={[styles.bdStatMini, styles.bdStatMiniMid]}>
              <Text style={styles.bdStatV}>{book.total_pages ?? "—"}</Text>
              <Text style={styles.bdStatL}>Total pages</Text>
            </View>
            <View style={styles.bdStatMini}>
              <Text style={styles.bdStatV}>{progress}%</Text>
              <Text style={styles.bdStatL}>Complete</Text>
            </View>
          </View>

          {/* Mark as Finished CTA */}
          {book.status === "reading" && (
            <TouchableOpacity style={styles.finishBtn} onPress={handleMarkFinished}>
              <Text style={styles.finishBtnText}>✓ Mark as Finished</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Tabs header (sticky) ── */}
        <View style={styles.tabRow}>
          {(["quotes", "notes"] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabItemText, activeTab === tab && styles.tabItemTextActive]}>
                {tab === "quotes" ? "Quotes" : "Notes"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab content ── */}
        {loadingData ? (
          <View style={{ padding: 32, alignItems: "center" }}>
            <ActivityIndicator color={colors.terracotta} />
          </View>
        ) : activeTab === "quotes" ? (
          <QuotesTab quotes={quotes} onAdd={handleAddQuote} onDelete={handleDeleteQuote} scrollRef={scrollRef} />
        ) : (
          <NotesTab notes={notes} onAdd={handleAddNote} onDelete={handleDeleteNote} scrollRef={scrollRef} />
        )}

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Quotes Tab ────────────────────────────────────────────────────────────────

function QuotesTab({
  quotes,
  onAdd,
  onDelete,
  scrollRef,
}: {
  quotes: Quote[];
  onAdd: (text: string, page: number | null) => Promise<void>;
  onDelete: (id: string) => void;
  scrollRef: React.RefObject<ScrollView>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [text, setText] = useState("");
  const [pageText, setPageText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (showAdd) {
      // Wait for keyboard to fully open (~300ms), then scroll input into view
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 320);
      return () => clearTimeout(t);
    }
  }, [showAdd]);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await onAdd(text.trim(), pageText ? Number(pageText) : null);
    setText("");
    setPageText("");
    setShowAdd(false);
    setSaving(false);
  };

  return (
    <View style={styles.tabContent}>
      {quotes.length === 0 && !showAdd && (
        <Text style={styles.emptyTabText}>No quotes yet. Tap below to save a passage.</Text>
      )}
      {quotes.map((q) => (
        <View key={q.id} style={styles.quoteCard}>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(q.id)}>
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.quoteText}>"{q.text}"</Text>
          {!!q.page && <Text style={styles.quotePage}>Page {q.page}</Text>}
        </View>
      ))}
      {showAdd ? (
        <View style={styles.addCard}>
          <TextInput
            style={styles.addInput}
            value={text}
            onChangeText={setText}
            placeholder="Type a passage that moved you…"
            placeholderTextColor={colors.char3}
            multiline
            autoFocus
          />
          <TextInput
            style={[styles.addInput, styles.addInputSmall]}
            value={pageText}
            onChangeText={setPageText}
            placeholder="Page number (optional)"
            placeholderTextColor={colors.char3}
            keyboardType="number-pad"
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <TouchableOpacity
              style={[styles.addSaveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.cream} size="small" />
              ) : (
                <Text style={styles.addSaveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.addCancelBtn} onPress={() => { setShowAdd(false); setText(""); setPageText(""); }}>
              <Text style={styles.addCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addDashedBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addDashedText}>+ Add quote</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Notes Tab ─────────────────────────────────────────────────────────────────

function NotesTab({
  notes,
  onAdd,
  onDelete,
  scrollRef,
}: {
  notes: Note[];
  onAdd: (text: string) => Promise<void>;
  onDelete: (id: string) => void;
  scrollRef: React.RefObject<ScrollView>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (showAdd) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 320);
      return () => clearTimeout(t);
    }
  }, [showAdd]);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await onAdd(text.trim());
    setText("");
    setShowAdd(false);
    setSaving(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <View style={styles.tabContent}>
      {notes.length === 0 && !showAdd && (
        <Text style={styles.emptyTabText}>No notes yet. Tap below to write your thoughts.</Text>
      )}
      {notes.map((n) => (
        <View key={n.id} style={styles.noteCard}>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(n.id)}>
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.noteCardText}>{n.text}</Text>
          <Text style={styles.noteCardDate}>{formatDate(n.created_at)}</Text>
        </View>
      ))}
      {showAdd ? (
        <View style={styles.addCard}>
          <TextInput
            style={styles.addInput}
            value={text}
            onChangeText={setText}
            placeholder="Write your thought…"
            placeholderTextColor={colors.char3}
            multiline
            autoFocus
          />
          <TouchableOpacity
            style={[styles.addSaveBtn, { marginTop: 8 }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.cream} size="small" />
            ) : (
              <Text style={styles.addSaveBtnText}>Save Note</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.addDashedBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addDashedText}>+ Add note</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Hero
  bdHero: { height: 300 },
  bdTopRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 8,
  },
  bdCircleBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(22,32,48,0.9)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
    elevation: 2,
  },
  bdCoverWrap: { position: "absolute", bottom: -30, left: 0, right: 0, alignItems: "center" },
  bdCoverShadow: {
    borderRadius: 10, overflow: "hidden",
    shadowColor: "#2c1f14", shadowOpacity: 0.3, shadowOffset: { width: 0, height: 10 }, shadowRadius: 24,
    elevation: 10,
  },
  bdCoverImg: { width: 110, height: 160, borderRadius: 10 },

  // Info
  bdInfo: { paddingTop: 44, paddingHorizontal: 20, alignItems: "center", paddingBottom: 16 },
  bdTitle: {
    fontFamily: "CormorantGaramond_700Bold", fontSize: 22,
    color: colors.espresso, textAlign: "center", marginBottom: 4,
  },
  bdAuthor: { fontSize: 13, color: colors.char3, marginBottom: 12 },
  bdTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 12 },
  bdTag: {
    paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: colors.cream3, backgroundColor: colors.cream2,
  },
  bdTagText: { fontSize: 11, color: colors.espresso2, fontWeight: "500" },

  // Status chips
  statusChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 12 },
  statusChip: {
    paddingVertical: 5, paddingHorizontal: 14, borderRadius: 20,
    borderWidth: 1.5, borderColor: colors.cream3, backgroundColor: colors.cream2,
  },
  statusChipText: { fontSize: 11, color: colors.char3, fontWeight: "500" },
  statusChipTextActive: { color: "#fff", fontWeight: "700" },

  // Page edit
  pageEditInput: {
    fontSize: 13, fontWeight: "600", color: colors.terracotta,
    borderBottomWidth: 1.5, borderBottomColor: colors.terracotta,
    paddingVertical: 0, minWidth: 36, textAlign: "center",
  },

  // Mark as Finished
  finishBtn: {
    marginTop: 12, backgroundColor: "#5bbfaa",
    borderRadius: 20, paddingVertical: 10, paddingHorizontal: 24,
    alignSelf: "center",
  },
  finishBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  starsRow: { flexDirection: "row", gap: 3, marginBottom: 12 },
  star: { fontSize: 18, color: colors.cream3 },
  starFilled: { color: colors.terracotta },
  synopsis: { fontSize: 12, color: colors.char3, lineHeight: 18, textAlign: "center" },

  // Progress
  bdProgSection: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 14, padding: 14,
  },
  bdProgRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  bdProgLabel: { fontSize: 12, fontWeight: "500", color: colors.espresso },
  bdProgPct: { fontSize: 12, color: colors.terracotta, fontWeight: "600" },
  progBg: { height: 4, backgroundColor: colors.cream3, borderRadius: 4 },
  progFill: { height: 4, backgroundColor: colors.terracotta, borderRadius: 4 },
  bdStatsMini: {
    flexDirection: "row", marginTop: 12,
    borderRadius: 8, overflow: "hidden",
    borderWidth: 1, borderColor: colors.cream3,
  },
  bdStatMini: { flex: 1, backgroundColor: colors.parchment, padding: 8, alignItems: "center" },
  bdStatMiniMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.cream3 },
  bdStatV: { fontSize: 13, fontWeight: "600", color: colors.espresso },
  bdStatL: { fontSize: 9, color: colors.char3, marginTop: 1 },

  // Tabs
  tabRow: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.cream3,
    backgroundColor: colors.cream, paddingHorizontal: 20,
  },
  tabItem: {
    flex: 1, paddingVertical: 11,
    borderBottomWidth: 2, borderBottomColor: "transparent",
    alignItems: "center",
  },
  tabItemActive: { borderBottomColor: colors.terracotta },
  tabItemText: { fontSize: 12, fontWeight: "500", color: colors.char3 },
  tabItemTextActive: { color: colors.terracotta },

  // Tab content
  tabContent: { paddingHorizontal: 20, paddingTop: 14 },
  emptyTabText: { fontSize: 13, color: colors.char3, textAlign: "center", paddingVertical: 24, lineHeight: 20 },

  // Quotes
  quoteCard: {
    borderLeftWidth: 3, borderLeftColor: colors.terracotta,
    borderTopWidth: 1, borderTopColor: colors.cream3,
    borderRightWidth: 1, borderRightColor: colors.cream3,
    borderBottomWidth: 1, borderBottomColor: colors.cream3,
    borderTopRightRadius: 10, borderBottomRightRadius: 10,
    backgroundColor: colors.parchment, padding: 12, marginBottom: 12,
  },
  quoteText: {
    fontFamily: "CormorantGaramond_400Regular_Italic",
    fontSize: 13, color: colors.espresso, lineHeight: 20, marginBottom: 6,
  },
  quotePage: { fontSize: 11, color: colors.char3 },

  // Notes
  noteCard: {
    backgroundColor: colors.parchment, borderRadius: 12,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.cream3,
  },
  noteCardText: { fontSize: 13, color: colors.espresso, lineHeight: 19 },
  noteCardDate: { fontSize: 10, color: colors.char3, marginTop: 6 },

  // Delete button
  deleteBtn: {
    position: "absolute", top: 8, right: 8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.cream2,
    alignItems: "center", justifyContent: "center",
    zIndex: 1,
  },
  deleteBtnText: { fontSize: 10, color: colors.char3 },

  // Add form
  addDashedBtn: {
    borderWidth: 1.5, borderColor: colors.cream3, borderStyle: "dashed",
    borderRadius: 10, padding: 12, alignItems: "center", marginBottom: 12,
  },
  addDashedText: { fontSize: 13, color: colors.char3 },
  addCard: {
    backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  addInput: {
    fontSize: 14, color: colors.espresso, lineHeight: 20,
    borderWidth: 1, borderColor: colors.cream3, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.cream2, marginBottom: 8, minHeight: 80,
  },
  addInputSmall: { minHeight: 0, height: 44 },
  addSaveBtn: {
    backgroundColor: colors.espresso, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 16, alignSelf: "flex-start",
    minWidth: 64, alignItems: "center",
  },
  addSaveBtnText: { color: colors.cream, fontSize: 13, fontWeight: "600" },
  addCancelBtn: {
    backgroundColor: colors.cream2, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 16, alignSelf: "flex-start",
    borderWidth: 1, borderColor: colors.cream3,
  },
  addCancelBtnText: { color: colors.char3, fontSize: 13 },

});
