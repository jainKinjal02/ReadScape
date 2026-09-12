import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useState, useRef, useEffect } from "react";
import {
  useWindowDimensions,
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
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { colors, fonts, moodConfig } from "../../src/design/tokens";
import { CoverImage } from "../../src/components/CoverImage";
import { useAppStore } from "../../src/store";
import { useBooks } from "../../src/hooks/useBooks";
import { fetchMoodLogs } from "../../src/lib/books";
import { searchBooks, addBookToLibrary, toggleFavorite } from "../../src/lib/books";
import { GoogleBook, BookStatus, Book } from "../../src/types";





type Filter = "all" | "reading" | "read" | "want_to_read" | "abandoned";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All",          value: "all" },
  { label: "Reading",      value: "reading" },
  { label: "Read",         value: "read" },
  { label: "Waiting",      value: "want_to_read" },
  { label: "Put down",     value: "abandoned" },
];

const EMPTY_COPY: Record<Filter, { title: string; sub: string; btn: string | null; action: "add" | "browse" | null }> = {
  all:          { title: "Your library awaits",        sub: "Every great reader starts with one book.\nSearch above or tap \"Add\" to begin.",       btn: "Add your first book", action: "add"    },
  reading:      { title: "Nothing in progress",         sub: "Find a book in your library, open it,\nand mark it as Reading.",                         btn: "Browse all books",    action: "browse" },
  read:         { title: "No finished books yet",       sub: "Books you complete will live here.\nKeep going — every page counts.",                    btn: "See all books",       action: "browse" },
  want_to_read: { title: "Your reading list is empty",  sub: "Add books you're curious about.\nFuture you will be very grateful.",                     btn: "Find a book",         action: "add"    },
  abandoned:    { title: "No abandoned books",          sub: "Sometimes a book just isn't the right fit,\nand that's perfectly okay.",                 btn: null,                  action: null     },
};

function BookOpenSvg() {
  return (
    <Svg width={72} height={72} viewBox="0 0 24 24" fill="none" style={{ marginBottom: 18 }}>
      <Path d="M12 4H5a1 1 0 00-1 1v13a1 1 0 001 1h7V4z" fill={colors.cream3} stroke={colors.terracotta} strokeWidth={1.2} strokeLinejoin="round" />
      <Path d="M12 4h7a1 1 0 011 1v13a1 1 0 01-1 1h-7V4z" fill={colors.cream3} stroke={colors.terracotta} strokeWidth={1.2} strokeLinejoin="round" />
      <Path d="M12 4v15" stroke={colors.terracotta} strokeWidth={1.2} />
      <Path d="M6 8h4M6 11h4M6 14h3" stroke={colors.char3} strokeWidth={1} strokeLinecap="round" />
      <Path d="M14 8h4M14 11h4M14 14h3" stroke={colors.char3} strokeWidth={1} strokeLinecap="round" />
    </Svg>
  );
}


const ADD_STATUS: { label: string; value: BookStatus }[] = [
  { label: "Want",    value: "want_to_read" },
  { label: "Reading", value: "reading" },
  { label: "Read",    value: "read" },
];

function SearchIcon({ color = colors.pencil }: { color?: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={8} stroke={color} strokeWidth={1.8} />
      <Path d="M21 21l-4.35-4.35" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        fill={filled ? colors.danger : "none"}
        stroke={filled ? colors.danger : colors.ink}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const gutter = Math.round(Math.min(30, Math.max(18, winW * 0.065)));
  const userId = useAppStore((s) => s.userId);
  const { books, loading, refresh } = useBooks();
  const setBooks = useAppStore((s) => s.setBooks);

  // Crossfading header images

  // Up to two recent moods per book. The reference puts these in the grid
  // rather than a detail screen — status and stars are what every tracker
  // shows, how a book felt is what only this one can.
  const [bookMoods, setBookMoods] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchMoodLogs(userId)
      .then((logs) => {
        if (cancelled) return;
        const map: Record<string, string[]> = {};
        for (const l of logs) {
          const list = map[l.book_id] ?? (map[l.book_id] = []);
          if (list.length < 2 && !list.includes(l.mood)) list.push(l.mood);
        }
        setBookMoods(map);
      })
      .catch(() => {
        // Non-fatal — cards simply render without chips.
      });
    return () => { cancelled = true; };
  }, [userId]);

  const [filter, setFilter] = useState<Filter>("all");
  const [librarySearch, setLibrarySearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GoogleBook[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const libraryInputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const statusFiltered =
    filter === "all" ? books : books.filter((b) => b.status === filter);

  const filtered = librarySearch.trim().length === 0
    ? statusFiltered
    : statusFiltered.filter((b) => {
        const q = librarySearch.toLowerCase();
        return b.title.toLowerCase().includes(q) || (b.author ?? "").toLowerCase().includes(q);
      });

  const handleToggleFavorite = async (book: Book) => {
    const newValue = !book.is_favorite;
    setBooks(books.map((b) => b.id === book.id ? { ...b, is_favorite: newValue } : b));
    try {
      await toggleFavorite(book.id, newValue);
    } catch {
      setBooks(books.map((b) => b.id === book.id ? { ...b, is_favorite: !newValue } : b));
    }
  };

  const gridData: (Book | { id: "__add__" })[] = [
    ...filtered,
    ...(librarySearch.trim().length === 0 ? [{ id: "__add__" as const }] : []),
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
    const moods = bookMoods[b.id] ?? [];
    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => router.push(`/book/${b.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.cover}>
          <CoverImage uri={b.cover_url ?? ""} title={b.title} style={styles.coverImg} />
          {!!b.is_favorite && (
            <TouchableOpacity
              style={styles.heartBtn}
              onPress={() => handleToggleFavorite(b)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.heartBg}>
                <HeartIcon filled />
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.meta}>
          <View style={styles.titleRow}>
            {/* Reading gets a filled mark, waiting a hollow one. Finished books
                get nothing: that is the resting state, so it needs no label. */}
            {b.status === "reading" && <View style={styles.dot} />}
            {b.status === "want_to_read" && <View style={[styles.dot, styles.dotWait]} />}
            <Text style={styles.bookTitle} numberOfLines={2}>{b.title}</Text>
          </View>
          {!!b.author && <Text style={styles.bookAuthor} numberOfLines={1}>{b.author}</Text>}
          {moods.length > 0 && (
            <View style={styles.chips}>
              {moods.map((m, i) => {
                const label = moodConfig[m]?.label ?? m.replace(/_/g, " ");
                return (
                  <View key={m} style={[styles.chip, i === 0 && styles.chipLead]}>
                    <Text style={[styles.chipText, i === 0 && styles.chipLeadText]}>
                      {label.toLowerCase()}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
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

      {/* ── Masthead ── */}
      <View style={[styles.masthead, { paddingTop: insets.top + 10, paddingHorizontal: gutter }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Library</Text>
          <Text style={styles.heroSub}>
            {books.length === 0
              ? "nothing here yet"
              : `${books.length} book${books.length === 1 ? "" : "s"}, all yours`}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => openModal()} activeOpacity={0.7}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* ── Content below hero ── */}
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["bottom"]}>
        <View style={styles.container}>

          {/* Filters read as text with an underline. Pills that scroll off the
              edge look broken; text runs quietly and fits more. */}
          <View style={[styles.filterRow, { marginHorizontal: gutter }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContent}
            >
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.tab, filter === f.value && styles.tabActive]}
                  onPress={() => setFilter(f.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, filter === f.value && styles.tabTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Library search bar */}
          <View style={[styles.libSearchWrap, { marginHorizontal: gutter }]}>
            <SearchIcon />
            <TextInput
              ref={libraryInputRef}
              style={styles.libSearchInput}
              value={librarySearch}
              onChangeText={setLibrarySearch}
              placeholder="Search your library…"
              placeholderTextColor={colors.pencil2}
              returnKeyType="search"
              autoCorrect={false}
            />
            {librarySearch.length > 0 && (
              <TouchableOpacity onPress={() => setLibrarySearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.libClearBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Loading / empty / grid */}
          {loading && books.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.terracotta} />
              <Text style={styles.loadingText}>Loading your library…</Text>
            </View>
          ) : filtered.length === 0 && librarySearch.trim().length > 0 ? (
            <View style={styles.emptyWrap}>
              <Svg width={52} height={52} viewBox="0 0 24 24" fill="none" style={{ marginBottom: 16 }}>
                <Path d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" stroke={colors.char3} strokeWidth={1.4} strokeLinecap="round" />
              </Svg>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptySub}>No books matching "{librarySearch}" in your library. Try a different title or author.</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <BookOpenSvg />
              <Text style={styles.emptyTitle}>{EMPTY_COPY[filter].title}</Text>
              <Text style={styles.emptySub}>{EMPTY_COPY[filter].sub}</Text>
              {EMPTY_COPY[filter].action === "add" && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => openModal()}>
                  <Text style={styles.emptyBtnText}>{EMPTY_COPY[filter].btn}</Text>
                </TouchableOpacity>
              )}
              {EMPTY_COPY[filter].action === "browse" && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setFilter("all")}>
                  <Text style={styles.emptyBtnText}>{EMPTY_COPY[filter].btn}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={gridData}
              renderItem={renderBook}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={[
                styles.grid,
                { paddingHorizontal: gutter, paddingBottom: 40 + insets.bottom },
              ]}
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
        <View style={[styles.modalScreen, { paddingBottom: insets.bottom }]}>
          {/* Header outside KAV so it never moves with the keyboard */}
          <View style={[styles.modalHeader, { paddingTop: insets.top + 14 }]}>
            <Text style={styles.modalTitle}>Add a Book</Text>
            <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke={colors.espresso2} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
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
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Atmospheric hero header
  masthead: { flexDirection: "row", alignItems: "flex-start", paddingBottom: 4 },
  heroTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: colors.ink },
  heroSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.pencil, marginTop: 4 },
  addBtn: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.3, borderColor: colors.ink,
    alignItems: "center", justifyContent: "center", marginTop: 6,
  },
  addBtnText: { fontFamily: fonts.body, color: colors.ink, fontSize: 19, lineHeight: 22, marginTop: -2 },

  filterRow: { marginTop: 15, borderBottomWidth: 1, borderBottomColor: colors.rule },
  filterContent: { gap: 17, alignItems: "flex-end" },
  tab: { paddingBottom: 9, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: colors.ink },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.pencil },
  tabTextActive: { color: colors.ink },

  // Library search bar
  // A row, not a box. One less rectangle on a page already full of covers.
  libSearchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginBottom: 4,
    backgroundColor: "transparent",
    borderRadius: 0, borderWidth: 0,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  libSearchInput: {
    flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.ink,
  },
  libClearBtn: { fontSize: 13, color: colors.pencil, paddingHorizontal: 2 },

  // Two columns, not three: titles fit, and covers are recognisable across
  // the room. Three columns forced 11px type and truncated most titles.
  grid: { paddingBottom: 40, paddingTop: 8 },
  gridRow: { gap: 15, marginBottom: 22 },
  gridItem: { flex: 1 },

  cover: {
    width: "100%", aspectRatio: 2 / 3, borderRadius: 3,
    shadowColor: colors.ink, shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 13, elevation: 3,
  },
  coverImg: { width: "100%", height: "100%", borderRadius: 3 },
  heartBtn: { position: "absolute", top: 7, right: 7 },
  heartBg: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.ink, shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, elevation: 2,
  },

  meta: { paddingTop: 8 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mark, marginTop: 6 },
  dotWait: { backgroundColor: "transparent", borderWidth: 1.2, borderColor: colors.ruleStrong },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 },
  chip: { backgroundColor: colors.rule, borderRadius: 2, paddingHorizontal: 8, paddingVertical: 3.5 },
  chipLead: { backgroundColor: colors.mark },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.pencil },
  chipLeadText: { color: colors.markInk },
  coverAdd: {
    width: "100%", aspectRatio: 2 / 3, borderRadius: 3,
    borderWidth: 1, borderColor: colors.ruleStrong, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: "transparent",
  },
  addPlus: { fontFamily: fonts.body, fontSize: 22, color: colors.pencil },
  addLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.pencil },
  bookTitle: { flex: 1, fontFamily: fonts.display, fontSize: 14, color: colors.ink, lineHeight: 17 },
  bookAuthor: { fontFamily: fonts.body, fontSize: 11, color: colors.pencil, marginTop: 2 },

  // Loading / empty states
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, color: colors.char3 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 44, paddingBottom: 40 },
  emptyTitle: {
    fontFamily: fonts.display, fontSize: 22,
    color: colors.espresso, textAlign: "center", marginBottom: 10,
  },
  emptySub: { fontSize: 14, color: colors.char3, textAlign: "center", lineHeight: 21, marginBottom: 28 },
  emptyBtn: {
    backgroundColor: colors.terracotta, borderRadius: 24,
    paddingVertical: 13, paddingHorizontal: 32,
    shadowColor: colors.terracotta, shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4,
  },
  emptyBtnText: { color: "#fff", fontSize: 14, fontWeight: "600", letterSpacing: 0.3 },

  // Full-screen modal
  modalScreen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.cream3,
    backgroundColor: colors.parchment,
  },
  modalTitle: {
    fontFamily: fonts.display,
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
    fontFamily: fonts.display, fontSize: 14,
    color: colors.espresso, marginBottom: 3,
  },
  resultAuthor: { fontSize: 12, color: colors.char3, marginBottom: 2 },
  resultPages: { fontSize: 11, color: colors.espresso2, marginBottom: 8 },
  addChips: { flexDirection: "row", gap: 6, marginTop: 4 },
  addChip: {
    paddingVertical: 5, paddingHorizontal: 10,
    backgroundColor: colors.blushSoft,
    borderWidth: 1, borderColor: colors.ruleStrong,
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
