import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  ScrollView,
  SafeAreaView,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { colors } from "../../src/design/tokens";
import { LIBRARY_BOOKS } from "../../src/data/mockData";

type Status = "all" | "reading" | "read" | "want_to_read" | "abandoned";

const FILTERS: { label: string; value: Status }[] = [
  { label: "All Books",   value: "all" },
  { label: "Reading",     value: "reading" },
  { label: "Read",        value: "read" },
  { label: "Want to Read",value: "want_to_read" },
  { label: "Abandoned",   value: "abandoned" },
];

const BADGE: Record<string, { label: string; bg: string; text: string }> = {
  reading:      { label: "Reading",  bg: "rgba(201,124,90,0.15)", text: "#a85e3e" },
  read:         { label: "Read",     bg: "rgba(122,158,126,0.15)", text: "#4a7c59" },
  want_to_read: { label: "Want",     bg: "rgba(74,55,40,0.08)",  text: "#4a3728" },
  abandoned:    { label: "Stopped",  bg: "rgba(74,63,58,0.08)",  text: "#7a6e6a" },
};

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
  const [filter, setFilter] = useState<Status>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = filter === "all"
    ? LIBRARY_BOOKS
    : LIBRARY_BOOKS.filter((b) => b.status === filter);

  const gridData: any[] = [...filtered, { id: "__add__" }];

  const renderBook = ({ item }: { item: typeof LIBRARY_BOOKS[0] & { id: string } }) => {
    if (item.id === "__add__") {
      return (
        <TouchableOpacity style={styles.bgItem} onPress={() => setShowAddModal(true)} activeOpacity={0.7}>
          <View style={styles.bgCoverAdd}>
            <Text style={styles.addPlus}>+</Text>
            <Text style={styles.addLabel}>Add book</Text>
          </View>
        </TouchableOpacity>
      );
    }
    const badge = BADGE[item.status] ?? BADGE.want_to_read;
    return (
      <TouchableOpacity
        style={styles.bgItem}
        onPress={() => router.push("/book/1")}
        activeOpacity={0.8}
      >
        <View style={styles.bgCover}>
          <Image source={{ uri: item.cover }} style={styles.bgCoverImg} contentFit="cover" />
        </View>
        <Text style={styles.bgTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.bgAuthor} numberOfLines={1}>{item.author}</Text>
        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.heading}>My Library</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <SearchIcon />
          <Text style={styles.searchPlaceholder}>Find your favourite…</Text>
        </TouchableOpacity>

        {/* Filter pills */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
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

        {/* Book grid */}
        <FlatList
          data={gridData}
          renderItem={renderBook}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.gridRow}
        />

        {/* Add Book Modal (placeholder) */}
        <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add a Book</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <View style={styles.searchRow}>
                  <View style={styles.searchInput}>
                    <SearchIcon />
                    <Text style={styles.searchPlaceholder}>Search by title or author…</Text>
                  </View>
                  <TouchableOpacity style={styles.searchBtn}>
                    <Text style={styles.searchBtnText}>Search</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.comingSoon}>
                  <Text style={styles.comingSoonText}>Google Books search will be connected here.</Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    backgroundColor: colors.parchment, borderBottomWidth: 1, borderBottomColor: colors.cream3,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  heading: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 22, color: colors.espresso },
  addBtn: {
    backgroundColor: colors.espresso, borderRadius: 16,
    paddingVertical: 6, paddingHorizontal: 14,
  },
  addBtnText: { color: colors.cream, fontSize: 12, fontWeight: "600" },

  searchBar: {
    marginHorizontal: 20, marginTop: 12,
    backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 12, padding: 10,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  searchPlaceholder: { fontSize: 13, color: colors.char3 },

  filterRow: { marginTop: 10, marginBottom: 14 },
  pill: {
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, borderColor: colors.cream3, backgroundColor: colors.parchment,
  },
  pillActive: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  pillText: { fontSize: 12, fontWeight: "500", color: colors.char3 },
  pillTextActive: { color: colors.cream },

  grid: { paddingHorizontal: 20, paddingBottom: 40 },
  gridRow: { gap: 12, marginBottom: 16 },
  bgItem: { flex: 1, maxWidth: "31%" },
  bgCover: {
    width: "100%", aspectRatio: 2 / 3, borderRadius: 8, overflow: "hidden", marginBottom: 6,
    shadowColor: "#2c1f14", shadowOpacity: 0.12, shadowOffset: { width: 2, height: 4 }, shadowRadius: 10,
    elevation: 3,
  },
  bgCoverImg: { width: "100%", height: "100%" },
  bgCoverAdd: {
    width: "100%", aspectRatio: 2 / 3, borderRadius: 8,
    borderWidth: 1.5, borderColor: colors.cream3, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 4,
  },
  addPlus: { fontSize: 22, color: colors.cream3 },
  addLabel: { fontSize: 9, color: colors.cream3 },
  bgTitle: { fontSize: 11, color: colors.espresso, fontWeight: "500", lineHeight: 14 },
  bgAuthor: { fontSize: 10, color: colors.char3, marginTop: 1 },
  statusBadge: {
    alignSelf: "flex-start", borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6, marginTop: 4,
  },
  statusBadgeText: { fontSize: 9, fontWeight: "600" },

  // Modal
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.cream3,
  },
  modalTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 20, color: colors.espresso },
  modalClose: { fontSize: 18, color: colors.char3, padding: 4 },
  modalBody: { padding: 20 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  searchInput: {
    flex: 1, backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  searchBtn: {
    backgroundColor: colors.espresso, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center",
  },
  searchBtnText: { color: colors.cream, fontWeight: "600", fontSize: 14 },
  comingSoon: {
    backgroundColor: colors.cream2, borderRadius: 12, padding: 20, alignItems: "center",
  },
  comingSoonText: { fontSize: 13, color: colors.char3, textAlign: "center" },
});
