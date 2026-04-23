import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { colors } from "../../src/design/tokens";
import { CoverImage } from "../../src/components/CoverImage";
import { useAppStore } from "../../src/store";
import { useBooks } from "../../src/hooks/useBooks";
import { searchBooks, addBookToLibrary } from "../../src/lib/books";
import { GoogleBook, BookStatus, Book } from "../../src/types";

const BG = "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=1200&q=80";

const HEADER_IMGS = [
  "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80",
  "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
  "https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=800&q=80",
];

type Filter = "all" | "reading" | "read" | "want_to_read" | "abandoned";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All",          value: "all" },
  { label: "Reading",      value: "reading" },
  { label: "Read",         value: "read" },
  { label: "Want to Read", value: "want_to_read" },
  { label: "Abandoned",    value: "abandoned" },
];

const BADGE: Record<string, { label: string; bg: string; text: string }> = {
  reading:      { label: "Reading", bg: "rgba(127,119,221,0.2)",  text: "#9b95e8" },
  read:         { label: "Read",    bg: "rgba(91,191,170,0.2)",   text: "#5bbfaa" },
  want_to_read: { label: "Want",    bg: "rgba(184,180,212,0.12)", text: "#b8b4d4" },
  abandoned:    { label: "Stopped", bg: "rgba(122,122,154,0.12)", text: "#7a7a9a" },
};

const ADD_STATUS: { label: string; value: BookStatus }[] = [
  { label: "Want",    value: "want_to_read" },
  { label: "Reading", value: "reading" },
  { label: "Read",    value: "read" },
];

function SearchIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={8} stroke={colors.char3} strokeWidth={1.5} />
      <Path d="M21 21l-4.35-4.35" stroke={colors.char3} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAppStore((s) => s.userId);
  const { books, loading, refresh } = useBooks();
  const setBooks = useAppStore((s) => s.setBooks);

  // Crossfading header images
  const opacities = useRef(HEADER_IMGS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const currentIdx = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      const cur = currentIdx.current;
      const nxt = (cur + 1) % HEADER_IMGS.length;
      Animated.parallel([
        Animated.timing(opacities[cur], { toValue: 0, duration: 1800, useNativeDriver: true }),
        Animated.timing(opacities[nxt], { toValue: 1, duration: 1800, useNativeDriver: true }),
      ]).start(() => { currentIdx.current = nxt; });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const [filter, setFilter] = useState<Filter>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GoogleBook[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered =
    filter === "all" ? books : books.filter((b) => b.status === filter);

  const gridData: (Book | { id: "__add__" })[] = [
    ...filtered,
    { id: "__add__" },
  ];

  // ── Real-time debounced search ───────────────────────────────────────────
  const runSearch = async (text: string) => {
    if (!text.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const hits = await searchBooks(text);
      setResults(hits);
    } catch (e: any) {
      // Only show alert if the modal is still open with this query
      Alert.alert("Search failed", "Could not reach book database. Check your connection and try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(() => runSearch(text), 400);
  };

  // ── Add book to Supabase ─────────────────────────────────────────────────
  const handleAdd = async (book: GoogleBook, status: BookStatus) => {
    if (!userId) return;
    setAddingId(`${book.id}-${status}`);
    try {
      const added = await addBookToLibrary(userId, book, status);
      setBooks([added, ...books]);
      // Clear result row to signal success without closing modal
      setResults((prev) => prev.filter((r) => r.id !== book.id));
    } catch (err: any) {
      Alert.alert("Couldn't add book", err.message ?? "Try again.");
    } finally {
      setAddingId(null);
    }
  };

  const openModal = () => setShowAddModal(true);

  const closeModal = () => {
    setShowAddModal(false);
    setQuery("");
    setResults([]);
  };

  // ── Render book grid item ────────────────────────────────────────────────
  const renderBook = ({ item }: { item: Book | { id: "__add__" } }) => {
    if (item.id === "__add__") {
      return (
        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => openModal()}
          activeOpacity={0.7}
        >
          <View style={styles.coverAdd}>
            <Text style={styles.addPlus}>+</Text>
            <Text style={styles.addLabel}>Add book</Text>
          </View>
        </TouchableOpacity>
      );
    }
    const b = item as Book;
    const badge = BADGE[b.status] ?? BADGE.want_to_read;
    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => router.push(`/book/${b.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.cover}>
          <CoverImage uri={b.cover_url ?? ""} title={b.title} style={styles.coverImg} />
        </View>
        <Text style={styles.bookTitle} numberOfLines={2}>{b.title}</Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>{b.author ?? ""}</Text>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Render Google Books search result ────────────────────────────────────
  const renderResult = ({ item }: { item: GoogleBook }) => {
    const info = item.volumeInfo;
    const cover =
      (info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? "")
        .replace("http://", "https://");
    const author = info.authors?.join(", ") ?? "Unknown author";

    return (
      <View style={styles.resultRow}>
        <Image
          source={{ uri: cover }}
          style={styles.resultCover}
          contentFit="cover"
        />
        <View style={styles.resultInfo}>
          <Text style={styles.resultTitle} numberOfLines={2}>{info.title}</Text>
          <Text style={styles.resultAuthor} numberOfLines={1}>{author}</Text>
          {!!info.pageCount && (
            <Text style={styles.resultPages}>{info.pageCount} pages</Text>
          )}
          <View style={styles.addChips}>
            {ADD_STATUS.map((s) => {
              const key = `${item.id}-${s.value}`;
              const isAdding = addingId === key;
              return (
                <TouchableOpacity
                  key={s.value}
                  style={styles.addChip}
                  onPress={() => handleAdd(item, s.value)}
                  disabled={!!addingId}
                  activeOpacity={0.75}
                >
                  {isAdding ? (
                    <ActivityIndicator size="small" color={colors.terracotta} />
                  ) : (
                    <Text style={styles.addChipText}>{s.label}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,25,35,0.7)" }]} />

      {/* ── Atmospheric hero header ── */}
      <View style={styles.heroHeader}>
        {HEADER_IMGS.map((src, i) => (
          <Animated.View key={src} style={[StyleSheet.absoluteFill, { opacity: opacities[i] }]}>
            <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
        ))}
        <LinearGradient
          colors={["rgba(44,31,20,0.55)", "rgba(44,31,20,0.35)", colors.cream]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroContent, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.heroTitle}>My Library</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Content below hero ── */}
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["bottom"]}>
        <View style={styles.container}>

          {/* Filter pills */}
          <View style={styles.filterRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContent}
            >
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.pill, filter === f.value && styles.pillActive]}
                  onPress={() => setFilter(f.value)}
                >
                  <Text style={[styles.pillText, filter === f.value && styles.pillTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Loading / empty / grid */}
          {loading && books.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.terracotta} />
              <Text style={styles.loadingText}>Loading your library…</Text>
            </View>
          ) : filtered.length === 0 && filter === "all" ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyTitle}>Your library is empty</Text>
              <Text style={styles.emptySub}>Tap "+ Add" to find your first book.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => openModal()}>
                <Text style={styles.emptyBtnText}>Add a book</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={gridData}
              renderItem={renderBook}
              keyExtractor={(item) => item.id}
              numColumns={3}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
              columnWrapperStyle={styles.gridRow}
              onRefresh={refresh}
              refreshing={loading}
            />
          )}
        </View>
      </SafeAreaView>

      {/* ── Add Book Full-Screen Modal ──────────────────────────────────────── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalScreen} edges={["top", "bottom"]}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add a Book</Text>
              <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke={colors.espresso2} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
            </View>

            {/* Search input */}
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <SearchIcon />
                <TextInput
                  ref={inputRef}
                  style={styles.searchInput}
                  value={query}
                  onChangeText={handleQueryChange}
                  placeholder="Title or author…"
                  placeholderTextColor={colors.char3}
                  returnKeyType="search"
                  onSubmitEditing={() => runSearch(query)}
                  autoCorrect={false}
                />
                {searching && (
                  <ActivityIndicator color={colors.terracotta} size="small" style={{ marginRight: 4 }} />
                )}
                {query.length > 0 && !searching && (
                  <TouchableOpacity onPress={() => { setQuery(""); setResults([]); }}>
                    <Text style={styles.clearBtn}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Results / empty states */}
            {results.length > 0 ? (
              <FlatList
                data={results}
                renderItem={renderResult}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.resultsList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            ) : !searching && query.trim().length >= 2 ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No results for "{query}". Try a different title or author.</Text>
              </View>
            ) : !searching ? (
              <View style={styles.searchHint}>
                <Text style={styles.searchHintText}>
                  Start typing to search millions of books.{"\n"}Tap{" "}
                  <Text style={{ color: colors.terracotta }}>Want</Text>,{" "}
                  <Text style={{ color: colors.terracotta }}>Reading</Text>, or{" "}
                  <Text style={{ color: colors.terracotta }}>Read</Text> to add instantly.
                </Text>
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Atmospheric hero header
  heroHeader: { height: 170, overflow: "hidden", justifyContent: "flex-end" },
  heroContent: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  heroTitle: { fontFamily: "CormorantGaramond_700Bold", fontSize: 28, color: "#faf6f0" },
  addBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.45)",
    borderRadius: 16, paddingVertical: 6, paddingHorizontal: 14,
  },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  filterRow: { height: 48, justifyContent: "center", marginTop: 6, marginBottom: 4 },
  filterContent: { paddingHorizontal: 20, gap: 8, alignItems: "center" },
  pill: {
    paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, borderColor: colors.cream3,
    backgroundColor: "rgba(22,32,48,0.95)",
  },
  pillActive: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  pillText: { fontSize: 12, fontWeight: "500", color: colors.char3 },
  pillTextActive: { color: "#fff" },

  grid: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 },
  gridRow: { gap: 12, marginBottom: 16 },
  gridItem: { flex: 1, maxWidth: "31%" },

  cover: {
    width: "100%", aspectRatio: 2 / 3, borderRadius: 8, marginBottom: 6,
    shadowColor: "#000", shadowOpacity: 0.15, shadowOffset: { width: 2, height: 4 }, shadowRadius: 10,
    elevation: 3,
  },
  coverImg: { width: "100%", height: "100%", borderRadius: 8 },
  coverAdd: {
    width: "100%", aspectRatio: 2 / 3, borderRadius: 8,
    borderWidth: 1.5, borderColor: "rgba(127,119,221,0.55)", borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: "rgba(127,119,221,0.08)",
  },
  addPlus: { fontSize: 22, color: colors.terra2 },
  addLabel: { fontSize: 9, color: colors.terra2 },
  bookTitle: { fontSize: 11, color: colors.espresso, fontWeight: "500", lineHeight: 14 },
  bookAuthor: { fontSize: 10, color: colors.char3, marginTop: 1 },
  badge: {
    alignSelf: "flex-start", borderRadius: 6,
    paddingVertical: 2, paddingHorizontal: 6, marginTop: 4,
  },
  badgeText: { fontSize: 9, fontWeight: "600" },

  // Loading / empty states
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, color: colors.char3 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: {
    fontFamily: "CormorantGaramond_700Bold", fontSize: 20,
    color: colors.espresso, textAlign: "center", marginBottom: 8,
  },
  emptySub: { fontSize: 14, color: colors.char3, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  emptyBtn: {
    backgroundColor: colors.terracotta, borderRadius: 20,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  emptyBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  // Full-screen modal
  modalScreen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.cream3,
    backgroundColor: colors.parchment,
  },
  modalTitle: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 22,
    color: colors.espresso,
  },
  modalCloseBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.cream2,
    borderWidth: 1, borderColor: colors.cream3,
    alignItems: "center", justifyContent: "center",
  },

  searchRow: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.cream3,
  },
  searchInputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.cream2,
    borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  searchInput: {
    flex: 1, fontSize: 15, color: colors.espresso,
  },
  clearBtn: { fontSize: 13, color: colors.char3, paddingHorizontal: 4 },

  resultsList: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  resultRow: {
    flexDirection: "row", gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.cream3,
  },
  resultCover: { width: 52, height: 76, borderRadius: 6, backgroundColor: colors.cream3 },
  resultInfo: { flex: 1 },
  resultTitle: {
    fontFamily: "CormorantGaramond_700Bold", fontSize: 14,
    color: colors.espresso, marginBottom: 3,
  },
  resultAuthor: { fontSize: 12, color: colors.char3, marginBottom: 2 },
  resultPages: { fontSize: 11, color: colors.espresso2, marginBottom: 8 },
  addChips: { flexDirection: "row", gap: 6, marginTop: 4 },
  addChip: {
    paddingVertical: 5, paddingHorizontal: 10,
    backgroundColor: "rgba(127,119,221,0.12)",
    borderWidth: 1, borderColor: "rgba(127,119,221,0.3)",
    borderRadius: 10, minWidth: 56, alignItems: "center",
  },
  addChipText: { fontSize: 11, fontWeight: "600", color: colors.terracotta },

  noResults: { padding: 40, alignItems: "center" },
  noResultsText: { fontSize: 13, color: colors.char3, textAlign: "center" },
  searchHint: { padding: 32, alignItems: "center" },
  searchHintText: {
    fontSize: 13, color: colors.char3,
    textAlign: "center", lineHeight: 20,
  },

});
