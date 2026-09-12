import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  useWindowDimensions,
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
  Modal,
  StatusBar,
  Animated,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import Svg, { Path } from "react-native-svg";
import { colors, fonts, moodConfig } from "../../src/design/tokens";
import { CoverImage } from "../../src/components/CoverImage";
import { useAppStore } from "../../src/store";
import { Quote, Note } from "../../src/types";
import {
  fetchMoodLogs,
  updateBookRating,
  updateBookGenre,
  updateBookStatus,
  updateCurrentPage,
  markBookFinished,
  deleteBook,
  fetchQuotes,
  addQuote,
  deleteQuote,
  fetchNotes,
  addNote,
  deleteNote,
  toggleFavorite,
} from "../../src/lib/books";
import {
  uploadBookPhoto,
  fetchBookPhotos,
  deleteGalleryPhoto,
  type PersistedPhoto,
} from "../../src/lib/gallery";
import { BookStatus } from "../../src/types";
import { GENRE_PRESETS } from "../../src/data/genres";

type Tab = "quotes" | "notes" | "photos";

const STATUS_LABELS: Record<string, string> = {
  reading:      "Reading",
  read:         "Read",
  want_to_read: "Waiting",
  abandoned:    "Put down",
};

// Ratings read as words next to the marks, the way you would say them aloud.
const RATING_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
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

  const { width: winW } = useWindowDimensions();
  const gutter = Math.round(Math.min(30, Math.max(18, winW * 0.065)));

  // Moods logged against this book, newest first, de-duplicated.
  const [moods, setMoods] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<Tab>("quotes");
  const [rating, setRating] = useState(book?.rating ?? 0);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  // Current page editing
  const [pageEditing, setPageEditing] = useState(false);
  const [pageInput, setPageInput] = useState(String(book?.current_page ?? 0));

  // Genre editing
  const [showGenreEditor, setShowGenreEditor] = useState(false);
  const [draftGenres, setDraftGenres] = useState<string[]>([]);
  const [genreDraft, setGenreDraft] = useState("");
  const [savingGenre, setSavingGenre] = useState(false);

  // Photos state
  const [bookPhotos, setBookPhotos] = useState<PersistedPhoto[]>([]);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [photoCaptionInput, setPhotoCaptionInput] = useState("");
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<PersistedPhoto | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ uri: string; caption: string } | null>(null);

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationRating, setCelebrationRating] = useState(0);
  const [celebrationNote, setCelebrationNote] = useState("");
  const [savingCelebration, setSavingCelebration] = useState(false);

  // Refetch on focus, not on mount. Logging a session pushes /session/[id] and
  // returns with router.back(), which never unmounts this screen — so a
  // mount-time effect would leave "How it felt" permanently empty.
  const bookId = book?.id;
  useFocusEffect(
    useCallback(() => {
      if (!userId || !bookId) return;
      let cancelled = false;
      fetchMoodLogs(userId)
        .then((logs) => {
          if (cancelled) return;
          const seen: string[] = [];
          for (const l of logs) {
            if (l.book_id === bookId && !seen.includes(l.mood)) seen.push(l.mood);
          }
          setMoods(seen);
        })
        .catch(() => {
          // Non-fatal — the section simply offers "+ add".
        });
      return () => { cancelled = true; };
    }, [userId, bookId])
  );

  // "336 pages · nine days · August" — only the parts we actually know.
  const facts = (() => {
    if (!book) return "";
    const out: string[] = [];
    if (book.total_pages) out.push(`${book.total_pages} pages`);
    if (book.date_started && book.date_finished) {
      const d = Math.max(
        1,
        Math.round(
          (new Date(book.date_finished).getTime() - new Date(book.date_started).getTime()) / 86400000
        )
      );
      out.push(d === 1 ? "one day" : `${d} days`);
    }
    if (book.date_finished) {
      out.push(new Date(book.date_finished).toLocaleString(undefined, { month: "long" }));
    }
    return out.join("  ·  ");
  })();

  const progress =
    book && book.total_pages && book.total_pages > 0
      ? Math.min(100, Math.round((book.current_page / book.total_pages) * 100))
      : 0;

  useEffect(() => {
    if (!id) return;
    setLoadingData(true);
    Promise.all([fetchQuotes(id), fetchNotes(id), fetchBookPhotos(id)])
      .then(([q, n, p]) => {
        setQuotes(q);
        setNotes(n);
        setBookPhotos(p);
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

  // ── Genre editing ──────────────────────────────────────────────────────────
  const openGenreEditor = () => {
    if (!book) return;
    setDraftGenres(book.genre ?? []);
    setGenreDraft("");
    setShowGenreEditor(true);
  };

  const toggleDraftGenre = (g: string) => {
    setDraftGenres((prev) =>
      prev.some((x) => x.toLowerCase() === g.toLowerCase())
        ? prev.filter((x) => x.toLowerCase() !== g.toLowerCase())
        : [...prev, g]
    );
  };

  // Add a typed genre, deduped case-insensitively against presets + current draft
  const addDraftGenre = () => {
    const cleaned = genreDraft.trim().replace(/\s+/g, " ");
    if (!cleaned) return;
    const lower = cleaned.toLowerCase();
    const canonical = GENRE_PRESETS.find((g) => g.toLowerCase() === lower) ?? cleaned;
    setDraftGenres((prev) =>
      prev.some((x) => x.toLowerCase() === lower) ? prev : [...prev, canonical]
    );
    setGenreDraft("");
  };

  const saveGenres = async () => {
    if (!book) return;
    setSavingGenre(true);
    try {
      await updateBookGenre(book.id, draftGenres);
      updateBook({ ...book, genre: draftGenres });
      setShowGenreEditor(false);
    } catch (err: any) {
      Alert.alert("Couldn't save genres", err?.message ?? "Please try again.");
    } finally {
      setSavingGenre(false);
    }
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
    setCelebrationRating(book.rating ?? 0);
    setCelebrationNote("");
    setShowCelebration(true);
  };

  const handleCelebrationDone = async () => {
    if (!id || !book) return;
    setSavingCelebration(true);
    try {
      if (celebrationRating > 0 && celebrationRating !== book.rating) {
        setRating(celebrationRating);
        updateBook({ ...book, rating: celebrationRating });
        await updateBookRating(id, celebrationRating).catch(() => {});
      }
    } finally {
      setSavingCelebration(false);
      setShowCelebration(false);
    }
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

  const handleToggleFavorite = async () => {
    if (!book || !id) return;
    const newValue = !book.is_favorite;
    updateBook({ ...book, is_favorite: newValue });
    await toggleFavorite(id, newValue).catch(() => {
      updateBook({ ...book, is_favorite: !newValue });
    });
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

  // ── Photo handlers ────────────────────────────────────────────────────────
  const pickBookPhoto = async (source: "camera" | "library") => {
    setShowSourcePicker(false);
    await new Promise((r) => setTimeout(r, 180));
    const { status } = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted" && status !== "limited") return;
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      setPendingPhotoUri(result.assets[0].uri);
      setPhotoCaptionInput("");
      setShowCaptionModal(true);
    }
  };

  // Dismiss the Modal first, then upload via useEffect — iOS blocks network requests
  // initiated from inside a presented Modal (same root cause as image-picker UIViewController conflict).
  const saveBookPhoto = () => {
    if (!pendingPhotoUri) return;
    const upload = { uri: pendingPhotoUri, caption: photoCaptionInput.trim() };
    setShowCaptionModal(false);
    setPendingPhotoUri(null);
    setPhotoCaptionInput("");
    setPendingUpload(upload);
  };

  useEffect(() => {
    if (!pendingUpload || !userId || !id) return;
    const { uri, caption } = pendingUpload;
    setPendingUpload(null);
    setIsSavingPhoto(true);
    const timer = setTimeout(async () => {
      try {
        const photo = await uploadBookPhoto(userId, id, uri, caption);
        setBookPhotos((prev) => [photo, ...prev]);
      } catch (e: any) {
        Alert.alert("Couldn't save photo", e.message ?? "Please try again.");
      } finally {
        setIsSavingPhoto(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [pendingUpload]);

  const deleteBookPhoto = async (photoId: string) => {
    const photo = bookPhotos.find((p) => p.id === photoId);
    if (!photo) return;
    setBookPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setViewingPhoto(null);
    await deleteGalleryPhoto(photo.id, photo.storagePath).catch(() => {
      setBookPhotos((prev) => [photo, ...prev]);
    });
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
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
      >

        {/* Everything above the tabs lives in one child so the sticky index
            stays fixed even when the progress section is absent. */}
        <View>
          {/* ── Top row ── */}
          <View style={[styles.bdTop, { paddingTop: insets.top + 8, paddingHorizontal: gutter }]}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M19 12H5M12 5l-7 7 7 7" stroke={colors.ink} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 18 }}>
              <TouchableOpacity onPress={handleToggleFavorite} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                    fill={book.is_favorite ? colors.blush : "none"}
                    stroke={book.is_favorite ? colors.blush : colors.ink}
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteBook} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={colors.pencil} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Hero cover ── */}
          <View style={styles.hero}>
            <View style={styles.heroCover}>
              <CoverImage uri={book.cover_url ?? ""} title={book.title} style={styles.heroCoverImg} />
            </View>
          </View>

          {/* ── Title block ── */}
          <View style={[styles.ctr, { paddingHorizontal: gutter }]}>
            <Text style={styles.bdTitle}>{book.title}</Text>
            {!!book.author && <Text style={styles.bdAuthor}>{book.author}</Text>}
            {!!facts && <Text style={styles.bdFacts}>{facts}</Text>}

            {/* Genres stay — they are editable per book and the reference has
                no equivalent, so they sit quietly under the facts line. */}
            <View style={styles.genreRow}>
              {(book.genre ?? []).map((g) => (
                <View key={g} style={styles.chip}>
                  <Text style={styles.chipText}>{g}</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.chipDash} onPress={openGenreEditor} activeOpacity={0.7}>
                <Text style={styles.chipDashText}>
                  {(book.genre?.length ?? 0) > 0 ? "edit" : "+ genre"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Status, as one segmented control ── */}
          <View style={[styles.seg, { marginHorizontal: gutter }]}>
            {(["reading", "read", "want_to_read", "abandoned"] as BookStatus[]).map((st, i) => (
              <TouchableOpacity
                key={st}
                style={[
                  styles.segBtn,
                  i > 0 && styles.segBtnDivider,
                  book.status === st && styles.segBtnActive,
                ]}
                onPress={() => handleStatusChange(st)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segText, book.status === st && styles.segTextActive]}>
                  {STATUS_LABELS[st]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Rating, as marks rather than stars ── */}
          <View style={[styles.rate, { paddingHorizontal: gutter }]}>
            <View style={styles.rateSquares}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => handleRating(n)} activeOpacity={0.7}>
                  <View style={[styles.rateSq, n <= rating && styles.rateSqOn]} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.xs}>
              {rating > 0 ? RATING_WORDS[rating] : "not rated yet"}
            </Text>
          </View>

          {/* ── Where you are — only while the book is actually being read ── */}
          {book.status === "reading" && (
            <View style={[styles.divide, { marginHorizontal: gutter }]}>
              <View style={styles.head}>
                <Text style={styles.h2}>Where you are</Text>
                <Text style={styles.xs}>{progress}%</Text>
              </View>
              <View style={styles.prog}>
                <View style={[styles.progFill, { width: `${progress}%` }]} />
              </View>
              <TouchableOpacity
                style={styles.pageRow}
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
                  <Text style={styles.pageText}>
                    page {book.current_page}
                    {book.total_pages ? ` of ${book.total_pages}` : ""}
                    <Text style={styles.pageHint}>   tap to change</Text>
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.ctaRow}>
                <TouchableOpacity
                  style={styles.ctaPrimary}
                  onPress={() => router.push(`/session/${book.id}`)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.ctaPrimaryText}>Log a session</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctaGhost} onPress={handleMarkFinished} activeOpacity={0.8}>
                  <Text style={styles.ctaGhostText}>Mark finished</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── How it felt ── */}
          <View style={[styles.divide, { marginHorizontal: gutter }]}>
            <Text style={[styles.h2, { marginBottom: 11 }]}>How it felt</Text>
            <View style={styles.chipsRow}>
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
              {/* Moods are logged as part of a reading session, so this goes there. */}
              <TouchableOpacity
                style={styles.chipDash}
                onPress={() => router.push(`/session/${book.id}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipDashText}>+ add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!!book.synopsis && (
            <View style={[styles.divide, { marginHorizontal: gutter }]}>
              <Text style={styles.synopsis} numberOfLines={6}>{book.synopsis}</Text>
            </View>
          )}
        </View>

        {/* ── Tabs (sticky) ──
            The sticky wrapper takes this outer View's style and hands the child
            `flex: 1`, which wipes out any flexDirection set on it. So the row
            lives one level deeper, where React Native leaves it alone. */}
        <View style={styles.tabSticky}>
        <View style={[styles.tabRow, { marginHorizontal: gutter }]}>
          {(["quotes", "notes", "photos"] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabItemText, activeTab === tab && styles.tabItemTextActive]}>
                {tab === "quotes" ? "Quotes" : tab === "notes" ? "Notes" : "Photos"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        </View>

        {/* ── Tab content ── */}
        <View style={{ paddingHorizontal: gutter }}>
        {loadingData ? (
          <View style={{ padding: 32, alignItems: "center" }}>
            <ActivityIndicator color={colors.terracotta} />
          </View>
        ) : activeTab === "quotes" ? (
          <QuotesTab quotes={quotes} onAdd={handleAddQuote} onDelete={handleDeleteQuote} scrollRef={scrollRef} book={book} />
        ) : activeTab === "notes" ? (
          <NotesTab notes={notes} onAdd={handleAddNote} onDelete={handleDeleteNote} scrollRef={scrollRef} />
        ) : (
          <PhotosTab photos={bookPhotos} onAdd={() => setShowSourcePicker(true)} onView={setViewingPhoto} isUploading={isSavingPhoto} />
        )}
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

      {/* ── Source picker overlay (no Modal — avoids UIViewController conflict) ── */}
      {showSourcePicker && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowSourcePicker(false)} />
          <View style={[photoStyles.sourceSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={photoStyles.sheetPill} />
            <Text style={photoStyles.sheetHeading}>Add a photo</Text>
            <TouchableOpacity style={photoStyles.sourceBtn} onPress={() => pickBookPhoto("camera")}>
              <Text style={photoStyles.sourceBtnText}>📷  Take a photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={photoStyles.sourceBtn} onPress={() => pickBookPhoto("library")}>
              <Text style={photoStyles.sourceBtnText}>🖼️  Choose from library</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Caption modal ── */}
      <Modal transparent visible={showCaptionModal} animationType="slide" onRequestClose={() => setShowCaptionModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCaptionModal(false)} />
          <View style={[photoStyles.captionSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={photoStyles.sheetPill} />
            {pendingPhotoUri && (
              <Image source={{ uri: pendingPhotoUri }} style={photoStyles.captionPreview} contentFit="cover" />
            )}
            <TextInput
              style={photoStyles.captionInput}
              value={photoCaptionInput}
              onChangeText={setPhotoCaptionInput}
              placeholder="Add a caption… (optional)"
              placeholderTextColor={colors.char3}
              autoFocus
            />
            <TouchableOpacity
              style={[photoStyles.saveBtn, isSavingPhoto && { opacity: 0.6 }]}
              onPress={saveBookPhoto}
              disabled={isSavingPhoto}
            >
              {isSavingPhoto
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={photoStyles.saveBtnText}>Save photo</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Genre editor ── */}
      <Modal transparent visible={showGenreEditor} animationType="slide" onRequestClose={() => setShowGenreEditor(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowGenreEditor(false)} />
          <View style={[styles.genreSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={photoStyles.sheetPill} />
            <Text style={styles.genreSheetTitle}>Edit genres</Text>

            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Selected genres (tap to remove) */}
              {draftGenres.length > 0 ? (
                <View style={styles.genreChipWrap}>
                  {draftGenres.map((g) => (
                    <TouchableOpacity key={g} style={styles.genreSelChip} onPress={() => toggleDraftGenre(g)}>
                      <Text style={styles.genreSelChipText}>{g}</Text>
                      <Text style={styles.genreSelChipX}>×</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.genreEmptyHint}>No genres yet — pick some below or add your own.</Text>
              )}

              {/* Preset suggestions */}
              <Text style={styles.genreSectionLbl}>SUGGESTIONS</Text>
              <View style={styles.genreChipWrap}>
                {GENRE_PRESETS.map((g) => {
                  const sel = draftGenres.some((x) => x.toLowerCase() === g.toLowerCase());
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genrePresetChip, sel && styles.genrePresetChipSel]}
                      onPress={() => toggleDraftGenre(g)}
                    >
                      <Text style={[styles.genrePresetText, sel && styles.genrePresetTextSel]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Add your own */}
            <View style={styles.genreAddRow}>
              <TextInput
                style={styles.genreAddInput}
                value={genreDraft}
                onChangeText={setGenreDraft}
                placeholder="Add your own…"
                placeholderTextColor={colors.char3}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={addDraftGenre}
              />
              <TouchableOpacity
                style={[styles.genreAddBtn, !genreDraft.trim() && { opacity: 0.4 }]}
                onPress={addDraftGenre}
                disabled={!genreDraft.trim()}
              >
                <Text style={styles.genreAddBtnText}>＋</Text>
              </TouchableOpacity>
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.genreSaveBtn, savingGenre && { opacity: 0.6 }]}
              onPress={saveGenres}
              disabled={savingGenre}
            >
              {savingGenre
                ? <ActivityIndicator color={colors.cream} size="small" />
                : <Text style={styles.genreSaveText}>Save genres</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Full-screen photo viewer ── */}
      <Modal transparent visible={!!viewingPhoto} animationType="fade" onRequestClose={() => setViewingPhoto(null)}>
        <View style={photoStyles.viewer}>
          <StatusBar barStyle="light-content" />
          <TouchableOpacity
            style={[photoStyles.viewerClose, { top: insets.top + 12 }]}
            onPress={() => setViewingPhoto(null)}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>

          {viewingPhoto && (
            <Image
              source={{ uri: viewingPhoto.uri }}
              style={{ flex: 1, width: "100%" }}
              contentFit="contain"
              transition={300}
              placeholder={{ color: "#1a1a2e" }}
            />
          )}

          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.88)"]}
            locations={[0, 0.35, 1]}
            style={[photoStyles.viewerBottom, { paddingBottom: insets.bottom + 24 }]}
          >
            {viewingPhoto?.caption ? (
              <View style={{ alignItems: "center", gap: 10, width: "100%" }}>
                <View style={{ width: 36, height: 1, backgroundColor: colors.pencil2 }} />
                <Text style={photoStyles.viewerCaption}>{viewingPhoto.caption}</Text>
              </View>
            ) : null}
            {viewingPhoto && (
              <TouchableOpacity style={photoStyles.viewerDeleteBtn} onPress={() => deleteBookPhoto(viewingPhoto.id)}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={colors.danger} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={photoStyles.viewerDeleteText}>Delete</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>
      </Modal>

      {/* ── Book Finish Celebration ── */}
      <Modal visible={showCelebration} transparent animationType="fade" onRequestClose={handleCelebrationDone}>
        <View style={celebStyles.overlay}>
          <Confetti />
          <View style={celebStyles.card}>
            {/* Book cover */}
            {book?.cover_url ? (
              <Image
                source={{ uri: book.cover_url }}
                style={celebStyles.cover}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <View style={[celebStyles.cover, { backgroundColor: colors.cream3, alignItems: "center", justifyContent: "center" }]}>
                <Text style={{ fontSize: 32 }}>📖</Text>
              </View>
            )}

            <Text style={celebStyles.emoji}>🎉</Text>
            <Text style={celebStyles.headline}>You finished it!</Text>
            <Text style={celebStyles.bookTitle} numberOfLines={2}>{book?.title}</Text>
            {!!book?.author && (
              <Text style={celebStyles.bookAuthor}>by {book.author}</Text>
            )}

            {/* Star rating */}
            <Text style={celebStyles.rateLabel}>How would you rate it?</Text>
            <View style={celebStyles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setCelebrationRating(star)} activeOpacity={0.7}>
                  <Text style={[celebStyles.star, celebrationRating >= star && celebStyles.starFilled]}>
                    {celebrationRating >= star ? "★" : "☆"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[celebStyles.doneBtn, savingCelebration && { opacity: 0.6 }]}
              onPress={handleCelebrationDone}
              disabled={savingCelebration}
              activeOpacity={0.85}
            >
              {savingCelebration
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={celebStyles.doneBtnText}>Continue</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Confetti animation ────────────────────────────────────────────────────────

const { width: SW, height: SH } = Dimensions.get("window");
const CONFETTI_COLORS = ["#e07b6b", colors.blushInk, colors.sage, colors.mark, colors.blush, colors.sage];
const PIECES = 28;

function Confetti() {
  const pieces = useRef(
    Array.from({ length: PIECES }, (_, i) => ({
      x: Math.random() * SW,
      size: 6 + Math.random() * 7,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 600,
      duration: 1600 + Math.random() * 1000,
      drift: (Math.random() - 0.5) * 120,
      rotate: Math.random() * 360,
      anim: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    const animations = pieces.map((p) =>
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(p.anim, { toValue: 1, duration: p.duration, useNativeDriver: true }),
      ])
    );
    Animated.parallel(animations).start();
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => {
        const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [-20, SH * 0.75] });
        const translateX = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
        const opacity = p.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        const rotate = p.anim.interpolate({ inputRange: [0, 1], outputRange: [`${p.rotate}deg`, `${p.rotate + 360}deg`] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: 0,
              width: p.size,
              height: p.size * 0.55,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

// ── Quotes Tab ────────────────────────────────────────────────────────────────

function QuotesTab({
  quotes,
  onAdd,
  onDelete,
  scrollRef,
  book,
}: {
  quotes: Quote[];
  onAdd: (text: string, page: number | null) => Promise<void>;
  onDelete: (id: string) => void;
  scrollRef: React.RefObject<ScrollView>;
  book: any;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [text, setText] = useState("");
  const [pageText, setPageText] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharingQuote, setSharingQuote] = useState<Quote | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const cardRef = useRef<ViewShot>(null);

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

  const handleShare = async () => {
    if (!cardRef.current) return;
    setIsSharing(true);
    try {
      const uri = await (cardRef.current as any).capture();
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share quote" });
    } catch {
      // user cancelled or sharing unavailable — silent
    } finally {
      setIsSharing(false);
      setSharingQuote(null);
    }
  };

  return (
    <View style={styles.tabContent}>
      {quotes.length === 0 && !showAdd && (
        <Text style={styles.emptyTabText}>No quotes yet. Tap below to save a passage.</Text>
      )}
      {quotes.map((q) => (
        <View key={q.id} style={styles.quoteCard}>
          <View style={styles.quoteCardActions}>
            <TouchableOpacity onPress={() => setSharingQuote(q)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke={colors.terracotta} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(q.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.quoteText}>"{q.text}"</Text>
          {!!q.page && <Text style={styles.quotePage}>Page {q.page}</Text>}
        </View>
      ))}

      {/* Share modal */}
      <Modal visible={!!sharingQuote} transparent animationType="fade" onRequestClose={() => setSharingQuote(null)}>
        <View style={shareStyles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSharingQuote(null)} />

          {/* The card that gets captured */}
          <ViewShot ref={cardRef} options={{ format: "png", quality: 1 }} style={shareStyles.cardWrap}>
            <LinearGradient colors={[colors.card, "#2c1f14"]} style={shareStyles.card}>
              <Text style={shareStyles.bigQuote}>"</Text>
              <Text style={shareStyles.quoteText}>{sharingQuote?.text}</Text>
              <View style={shareStyles.divider} />
              <Text style={shareStyles.bookTitle}>{book?.title}</Text>
              {!!book?.author && <Text style={shareStyles.bookAuthor}>{book.author}</Text>}
              <Text style={shareStyles.brand}>ReadScape</Text>
            </LinearGradient>
          </ViewShot>

          <TouchableOpacity
            style={[shareStyles.shareBtn, isSharing && { opacity: 0.6 }]}
            onPress={handleShare}
            disabled={isSharing}
            activeOpacity={0.85}
          >
            {isSharing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={shareStyles.shareBtnText}>Share</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setSharingQuote(null)}>
            <Text style={shareStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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

// ── Photos Tab ────────────────────────────────────────────────────────────────

function PhotosTab({
  photos,
  onAdd,
  onView,
  isUploading,
}: {
  photos: PersistedPhoto[];
  onAdd: () => void;
  onView: (photo: PersistedPhoto) => void;
  isUploading?: boolean;
}) {
  return (
    <View style={styles.tabContent}>
      {isUploading && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 10 }}>
          <ActivityIndicator color={colors.terracotta} size="small" />
          <Text style={{ fontSize: 12, color: colors.char3 }}>Saving photo…</Text>
        </View>
      )}
      {photos.length === 0 && !isUploading && (
        <Text style={styles.emptyTabText}>No photos yet. Add one to remember this book.</Text>
      )}
      <View style={photoStyles.grid}>
        {photos.map((photo) => (
          <TouchableOpacity key={photo.id} style={photoStyles.gridTile} onPress={() => onView(photo)} activeOpacity={0.85}>
            <Image
              source={{ uri: photo.uri }}
              style={photoStyles.gridImg}
              contentFit="cover"
              transition={350}
              placeholder={{ color: "#ede8df" }}
            />
            {!!photo.caption && (
              <Text style={photoStyles.gridCaption} numberOfLines={1}>{photo.caption}</Text>
            )}
          </TouchableOpacity>
        ))}
        {/* Add tile */}
        <TouchableOpacity style={photoStyles.addTile} onPress={onAdd} activeOpacity={0.75}>
          <Text style={photoStyles.addTilePlus}>+</Text>
          <Text style={photoStyles.addTileLabel}>Add photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Paper & Ink book screen ──
  bdTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 6 },

  hero: { alignItems: "center", paddingTop: 14, paddingBottom: 20 },
  heroCover: {
    width: 122, aspectRatio: 2 / 3, borderRadius: 3,
    shadowColor: colors.ink, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 14 }, shadowRadius: 26, elevation: 9,
  },
  heroCoverImg: { width: "100%", height: "100%", borderRadius: 3 },

  ctr: { alignItems: "center" },
  bdTitle: {
    fontFamily: fonts.display, fontSize: 23, lineHeight: 27,
    letterSpacing: -0.3, color: colors.ink, textAlign: "center",
  },
  bdAuthor: { fontFamily: fonts.body, fontSize: 13, color: colors.pencil, marginTop: 6, textAlign: "center" },
  bdFacts: { fontFamily: fonts.body, fontSize: 11.5, color: colors.pencil2, marginTop: 3, textAlign: "center" },
  genreRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 5, marginTop: 12 },

  // One control, four segments — reads as a single decision rather than four chips.
  seg: {
    flexDirection: "row", borderWidth: 1.2, borderColor: colors.ink,
    borderRadius: 2, overflow: "hidden", marginTop: 18, marginBottom: 16,
  },
  segBtn: { flex: 1, paddingVertical: 9, alignItems: "center", backgroundColor: "transparent" },
  segBtnDivider: { borderLeftWidth: 1, borderLeftColor: colors.rule },
  segBtnActive: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.ink },
  segTextActive: { color: colors.paper },

  rate: { flexDirection: "row", alignItems: "center", gap: 9 },
  rateSquares: { flexDirection: "row", gap: 4 },
  rateSq: { width: 16, height: 16, borderRadius: 1, backgroundColor: colors.rule },
  rateSqOn: { backgroundColor: colors.mark },

  divide: { borderTopWidth: 1, borderTopColor: colors.rule, marginTop: 19, paddingTop: 18 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 },
  h2: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  xs: { fontFamily: fonts.body, fontSize: 11.5, color: colors.pencil },

  prog: { height: 2, backgroundColor: colors.rule },
  pageRow: { paddingTop: 10 },
  pageText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink },
  pageHint: { fontFamily: fonts.body, fontSize: 11, color: colors.pencil2 },

  ctaRow: { flexDirection: "row", gap: 9, marginTop: 16 },
  ctaPrimary: { flex: 1, backgroundColor: colors.ink, borderRadius: 2, paddingVertical: 12, alignItems: "center" },
  ctaPrimaryText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.paper },
  ctaGhost: {
    flex: 1, borderRadius: 2, paddingVertical: 12, alignItems: "center",
    borderWidth: 1, borderColor: colors.ruleStrong,
  },
  ctaGhostText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.ink },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: { backgroundColor: colors.rule, borderRadius: 2, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 11.5, color: colors.pencil },
  chipLead: { backgroundColor: colors.mark },
  chipLeadText: { color: colors.markInk },
  chipDash: {
    borderWidth: 1, borderStyle: "dashed", borderColor: colors.ruleStrong,
    borderRadius: 2, paddingHorizontal: 9, paddingVertical: 4,
  },
  chipDashText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.pencil2 },

  // Hero

  // Info

  // Genre edit affordance + editor sheet
  genreSheet: {
    backgroundColor: colors.cream, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingHorizontal: 20, gap: 12,
  },
  genreSheetTitle: {
    fontFamily: fonts.display, fontSize: 20,
    color: colors.espresso, textAlign: "center",
  },
  genreEmptyHint: { fontSize: 12, color: colors.char3, textAlign: "center", paddingVertical: 4 },
  genreSectionLbl: {
    fontSize: 11, fontWeight: "700", color: colors.espresso2,
    letterSpacing: 0.6, marginTop: 14, marginBottom: 8,
  },
  genreChipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genreSelChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: colors.terracotta,
  },
  genreSelChipText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  genreSelChipX: { color: "#fff", fontSize: 16, lineHeight: 16, marginTop: -1 },
  genrePresetChip: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16,
    borderWidth: 1.5, borderColor: colors.cream3, backgroundColor: colors.cream2,
  },
  genrePresetChipSel: { borderColor: colors.terracotta, backgroundColor: colors.blushSoft },
  genrePresetText: { fontSize: 12, color: colors.char3, fontWeight: "500" },
  genrePresetTextSel: { color: colors.terracotta, fontWeight: "700" },
  genreAddRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  genreAddInput: {
    flex: 1, backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: colors.espresso,
  },
  genreAddBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.terracotta,
    alignItems: "center", justifyContent: "center",
  },
  genreAddBtnText: { color: "#fff", fontSize: 22, lineHeight: 24 },
  genreSaveBtn: {
    backgroundColor: colors.espresso, borderRadius: 12,
    paddingVertical: 13, alignItems: "center", marginTop: 4,
  },
  genreSaveText: { color: colors.cream, fontSize: 14, fontWeight: "600" },

  // Status chips

  // Page edit
  pageEditInput: {
    fontFamily: fonts.body, fontSize: 13, color: colors.ink,
    borderBottomWidth: 1.5, borderBottomColor: colors.ink,
    paddingVertical: 0, minWidth: 50,
  },

  // Reading-session CTAs — side by side

  // Mark as Finished

  synopsis: { fontFamily: fonts.reading, fontSize: 13.5, color: colors.pencil, lineHeight: 21 },

  // Progress
  progFill: { height: 2, backgroundColor: colors.ink },

  // Tabs
  // Text tabs, left-aligned and only as wide as their labels — the same
  // vocabulary as the Library filters, not full-width segments.
  // Outer: whatever lands on the sticky wrapper. Needs an opaque background so
  // content does not show through once it pins to the top.
  tabSticky: { backgroundColor: colors.paper, marginTop: 19 },
  tabRow: {
    flexDirection: "row", gap: 19,
    borderBottomWidth: 1, borderBottomColor: colors.rule,
  },
  tabItem: {
    paddingBottom: 9,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabItemActive: { borderBottomColor: colors.ink },
  tabItemText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.pencil },
  tabItemTextActive: { color: colors.ink },

  // Tab content
  tabContent: { paddingTop: 16 },
  emptyTabText: {
    fontFamily: fonts.body, fontSize: 12.5, color: colors.pencil,
    textAlign: "center", paddingVertical: 22, lineHeight: 19,
  },

  // Quotes
  quoteCard: {
    paddingTop: 4, paddingBottom: 18, marginBottom: 18,
    borderBottomWidth: 1, borderBottomColor: colors.rule,
  },
  quoteCardActions: {
    flexDirection: "row", justifyContent: "flex-end", gap: 14, marginBottom: 6,
  },
  quoteText: {
    fontFamily: fonts.reading,
    fontSize: 14.5, color: colors.ink, lineHeight: 24, marginBottom: 8,
  },
  quotePage: { fontFamily: fonts.body, fontSize: 11, color: colors.pencil },

  // Notes
  noteCard: {
    paddingTop: 4, paddingBottom: 16, marginBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.rule,
  },
  noteCardText: { fontFamily: fonts.reading, fontSize: 14, color: colors.ink, lineHeight: 22 },
  noteCardDate: { fontFamily: fonts.body, fontSize: 10.5, color: colors.pencil, marginTop: 7 },

  // Delete button
  deleteBtn: {
    position: "absolute", top: 2, right: 0,
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
    zIndex: 1,
  },
  deleteBtnText: { fontFamily: fonts.body, fontSize: 11, color: colors.pencil2 },

  // Add form
  addDashedBtn: {
    borderWidth: 1, borderColor: colors.ruleStrong, borderStyle: "dashed",
    borderRadius: 2, paddingVertical: 11, alignItems: "center", marginBottom: 12,
  },
  addDashedText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.pencil2 },
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

// ── Photo-specific styles ─────────────────────────────────────────────────────
const TILE_SIZE = 160;

const photoStyles = StyleSheet.create({
  // 2-column grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridTile: { width: TILE_SIZE, borderRadius: 10, overflow: "hidden", backgroundColor: colors.parchment },
  gridImg: { width: TILE_SIZE, height: TILE_SIZE },
  gridCaption: { fontSize: 10, color: colors.espresso2, paddingHorizontal: 6, paddingVertical: 5 },
  addTile: {
    width: TILE_SIZE, height: TILE_SIZE, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.cream3, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: colors.cream2,
  },
  addTilePlus: { fontSize: 26, color: colors.terracotta },
  addTileLabel: { fontSize: 10, color: colors.terracotta },

  // Source picker sheet
  sourceSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: colors.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingHorizontal: 20, gap: 10,
  },
  sheetPill: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.rule, alignSelf: "center", marginBottom: 8 },
  sheetHeading: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, marginBottom: 4 },
  sourceBtn: {
    backgroundColor: colors.rule, borderWidth: 1, borderColor: colors.rule,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
  },
  sourceBtnText: { fontSize: 14, color: colors.ink },

  // Caption sheet
  captionSheet: {
    backgroundColor: colors.cream, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingHorizontal: 20, gap: 12,
  },
  captionPreview: { width: "100%", height: 160, borderRadius: 12 },
  captionInput: {
    backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colors.espresso,
  },
  saveBtn: {
    backgroundColor: colors.terracotta, borderRadius: 12,
    paddingVertical: 13, alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  // Full-screen viewer
  viewer: { flex: 1, backgroundColor: "#000" },
  viewerClose: {
    position: "absolute", right: 16, zIndex: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  viewerBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingTop: 48, paddingHorizontal: 32, alignItems: "center", gap: 18,
  },
  viewerCaption: {
    fontFamily: fonts.readingItalic,
    color: colors.ink, fontSize: 19,
    textAlign: "center", lineHeight: 27, letterSpacing: 0.3,
  },
  viewerDeleteBtn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingVertical: 8, paddingHorizontal: 18,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1, borderColor: colors.dangerSoft,
    borderRadius: 20,
  },
  viewerDeleteText: { color: colors.danger, fontSize: 13, fontWeight: "500" },

});

// ── Celebration styles ────────────────────────────────────────────────────────

const celebStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  // This was a bottom sheet when it sat over a dark scrim. On paper there is
  // no scrim to rise from, so it is simply a centred full-screen moment —
  // no top radii, no sheet background, no bottom anchoring.
  card: {
    width: "100%",
    paddingHorizontal: 32,
    alignItems: "center",
  },
  cover: {
    width: 100, height: 148,
    borderRadius: 3,
    marginBottom: 6,
    shadowColor: colors.ink, shadowOpacity: 0.18, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16,
    elevation: 6,
  },
  emoji: { fontSize: 36, marginBottom: 8 },
  headline: {
    fontFamily: fonts.display,
    fontSize: 30, color: colors.espresso, marginBottom: 4,
  },
  bookTitle: {
    fontFamily: fonts.readingItalic,
    fontSize: 18, color: colors.espresso2,
    textAlign: "center", lineHeight: 24,
  },
  bookAuthor: { fontSize: 12, color: colors.char3, marginTop: 3, marginBottom: 20 },
  rateLabel: { fontSize: 12, color: colors.char3, marginBottom: 10 },
  starsRow: { flexDirection: "row", gap: 6, marginBottom: 24 },
  star: { fontSize: 34, color: colors.cream3 },
  starFilled: { color: colors.terracotta },
  doneBtn: {
    width: "100%",
    backgroundColor: colors.espresso,
    borderRadius: 14, paddingVertical: 15,
    alignItems: "center",
  },
  doneBtnText: { color: colors.cream, fontSize: 15, fontWeight: "600", letterSpacing: 0.5 },
});

// ── Share quote styles ────────────────────────────────────────────────────────
const shareStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center", justifyContent: "center", gap: 20, padding: 24,
  },
  cardWrap: { width: "100%", borderRadius: 20, overflow: "hidden" },
  card: {
    padding: 32, alignItems: "center",
    borderRadius: 20,
  },
  bigQuote: {
    fontFamily: fonts.display,
    fontSize: 72, color: colors.terracotta,
    lineHeight: 60, marginBottom: 8, alignSelf: "flex-start",
  },
  quoteText: {
    fontFamily: fonts.readingItalic,
    fontSize: 20, color: colors.ink, lineHeight: 30,
    textAlign: "center", marginBottom: 24,
  },
  divider: { width: 40, height: 1, backgroundColor: colors.pencil2, marginBottom: 20 },
  bookTitle: {
    fontFamily: fonts.display,
    fontSize: 14, color: colors.ink, textAlign: "center",
  },
  bookAuthor: { fontSize: 12, color: colors.pencil, marginTop: 3, textAlign: "center" },
  brand: {
    fontSize: 10, color: colors.pencil2,
    letterSpacing: 2, textTransform: "uppercase", marginTop: 24,
  },
  shareBtn: {
    width: "100%", backgroundColor: colors.terracotta,
    borderRadius: 14, paddingVertical: 15, alignItems: "center",
  },
  shareBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  cancelText: { fontSize: 13, color: colors.pencil },
});
