import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { useAppStore } from "../../src/store";
import { colors } from "../../src/design/tokens";
import { BookCover } from "../../src/components/BookCover";
import { Book, BookStatus, GoogleBook } from "../../src/types";
import { searchBooks, getCoverUrl } from "../../src/lib/googleBooks";

const STATUS_TABS: { label: string; value: BookStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Reading", value: "reading" },
  { label: "Read", value: "read" },
  { label: "Want to Read", value: "want_to_read" },
  { label: "Abandoned", value: "abandoned" },
];

export default function LibraryScreen() {
  const router = useRouter();
  const { userId } = useAppStore();
  const [books, setBooks] = useState<Book[]>([]);
  const [filter, setFilter] = useState<BookStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Add book modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [googleQuery, setGoogleQuery] = useState("");
  const [googleResults, setGoogleResults] = useState<GoogleBook[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchBooks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    let query = supabase.from("books").select("*").eq("user_id", userId);
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query.order("date_added", { ascending: false });
    setBooks(data ?? []);
    setLoading(false);
  }, [userId, filter]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const searchGoogle = async () => {
    if (!googleQuery.trim()) return;
    setSearching(true);
    const results = await searchBooks(googleQuery);
    setGoogleResults(results);
    setSearching(false);
  };

  const addBook = async (gb: GoogleBook, status: BookStatus = "want_to_read") => {
    if (!userId) return;
    const { error } = await supabase.from("books").insert({
      user_id: userId,
      title: gb.volumeInfo.title,
      author: gb.volumeInfo.authors?.[0] ?? null,
      cover_url: getCoverUrl(gb),
      genre: gb.volumeInfo.categories ?? [],
      status,
      total_pages: gb.volumeInfo.pageCount ?? null,
      synopsis: gb.volumeInfo.description ?? null,
      google_books_id: gb.id,
      date_started: status === "reading" ? new Date().toISOString() : null,
    });
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setShowAddModal(false);
      setGoogleQuery("");
      setGoogleResults([]);
      fetchBooks();
    }
  };

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.author ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderBook = ({ item }: { item: Book }) => (
    <TouchableOpacity
      style={styles.bookCard}
      onPress={() => router.push(`/book/${item.id}`)}
      activeOpacity={0.8}
    >
      <BookCover uri={item.cover_url} title={item.title} width={90} height={134} />
      <View style={styles.statusPill}>
        <Text style={styles.statusPillText}>{statusLabel(item.status)}</Text>
      </View>
      <Text style={styles.bookCardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.bookCardAuthor} numberOfLines={1}>
        {item.author}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>My Library</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addBtnText}>+ Add Book</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search your library..."
        placeholderTextColor={colors.inkMuted}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      >
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            style={[styles.filterTab, filter === tab.value && styles.filterTabActive]}
            onPress={() => setFilter(tab.value)}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === tab.value && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Book grid */}
      {loading ? (
        <ActivityIndicator color={colors.roseAccent} style={{ marginTop: 40 }} />
      ) : filteredBooks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>No books here yet.</Text>
          <TouchableOpacity onPress={() => setShowAddModal(true)}>
            <Text style={styles.emptyLink}>Add your first book →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredBooks}
          renderItem={renderBook}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.gridRow}
        />
      )}

      {/* Add Book Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add a Book</Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                setGoogleQuery("");
                setGoogleResults([]);
              }}
            >
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.googleSearchRow}>
            <TextInput
              style={styles.googleInput}
              placeholder="Search by title or author..."
              placeholderTextColor={colors.inkMuted}
              value={googleQuery}
              onChangeText={setGoogleQuery}
              onSubmitEditing={searchGoogle}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={searchGoogle}>
              <Text style={styles.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>

          {searching ? (
            <ActivityIndicator color={colors.roseAccent} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={googleResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.googleResult}>
                  <BookCover uri={getCoverUrl(item)} title={item.volumeInfo.title} width={50} height={74} />
                  <View style={styles.googleResultInfo}>
                    <Text style={styles.googleResultTitle} numberOfLines={2}>
                      {item.volumeInfo.title}
                    </Text>
                    <Text style={styles.googleResultAuthor} numberOfLines={1}>
                      {item.volumeInfo.authors?.join(", ")}
                    </Text>
                    <Text style={styles.googleResultPages}>
                      {item.volumeInfo.pageCount ? `${item.volumeInfo.pageCount} pages` : ""}
                    </Text>
                  </View>
                  <View style={styles.addActions}>
                    <TouchableOpacity
                      style={styles.addActionBtn}
                      onPress={() => addBook(item, "reading")}
                    >
                      <Text style={styles.addActionText}>Reading</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.addActionBtn, styles.addActionSecondary]}
                      onPress={() => addBook(item, "want_to_read")}
                    >
                      <Text style={styles.addActionTextSecondary}>Want to Read</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function statusLabel(status: BookStatus) {
  const map: Record<BookStatus, string> = {
    reading: "Reading",
    read: "Read ✓",
    want_to_read: "Want to Read",
    abandoned: "Abandoned",
  };
  return map[status];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  heading: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: colors.inkPrimary,
  },
  addBtn: {
    backgroundColor: colors.roseAccent,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  addBtnText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  searchInput: {
    marginHorizontal: 20,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.inkPrimary,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.bgSurface,
  },
  filterRow: { marginBottom: 16 },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.bgSurface,
    marginRight: 8,
  },
  filterTabActive: { backgroundColor: colors.roseSoft, borderWidth: 1.5, borderColor: colors.roseAccent },
  filterTabText: { fontSize: 12, color: colors.inkMuted },
  filterTabTextActive: { color: colors.roseAccent, fontWeight: "600" },
  grid: { paddingHorizontal: 12, paddingBottom: 32 },
  gridRow: { marginBottom: 16 },
  bookCard: { flex: 1, margin: 4, alignItems: "center", maxWidth: "33%" },
  statusPill: {
    backgroundColor: colors.roseSoft,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginTop: 6,
  },
  statusPillText: { fontSize: 9, color: colors.roseAccent, fontWeight: "600" },
  bookCardTitle: {
    fontSize: 11,
    color: colors.inkPrimary,
    textAlign: "center",
    marginTop: 4,
    fontWeight: "500",
  },
  bookCardAuthor: { fontSize: 10, color: colors.inkMuted, textAlign: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, color: colors.inkMuted, marginBottom: 12 },
  emptyLink: { fontSize: 15, color: colors.roseAccent, fontWeight: "600" },
  modal: { flex: 1, backgroundColor: colors.bgPrimary },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgSurface,
  },
  modalTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: colors.inkPrimary,
  },
  modalClose: { fontSize: 18, color: colors.inkMuted, padding: 4 },
  googleSearchRow: { flexDirection: "row", padding: 16, gap: 8 },
  googleInput: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.inkPrimary,
    borderWidth: 1,
    borderColor: colors.bgSurface,
  },
  searchBtn: {
    backgroundColor: colors.roseAccent,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  searchBtnText: { color: "#FFF", fontWeight: "600", fontSize: 14 },
  googleResult: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgSurface,
    alignItems: "center",
    gap: 12,
  },
  googleResultInfo: { flex: 1 },
  googleResultTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkPrimary,
    marginBottom: 2,
  },
  googleResultAuthor: { fontSize: 12, color: colors.inkMuted, marginBottom: 2 },
  googleResultPages: { fontSize: 11, color: colors.inkMuted },
  addActions: { gap: 6 },
  addActionBtn: {
    backgroundColor: colors.roseAccent,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  addActionText: { color: "#FFF", fontSize: 11, fontWeight: "600" },
  addActionSecondary: { backgroundColor: colors.bgSurface },
  addActionTextSecondary: { color: colors.inkPrimary, fontSize: 11 },
});
