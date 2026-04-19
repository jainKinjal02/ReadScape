import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../src/design/tokens";
import { CoverImage } from "../../src/components/CoverImage";
import { useBooks } from "../../src/hooks/useBooks";

const GENRE_META: Record<string, { emoji: string; gradient: readonly [string, string]; image: any }> = {
  Fiction:    { emoji: "📚", gradient: ["#7F77DD", "#4a40a8"], image: require("../../assets/genres/fiction.png") },
  Fantasy:    { emoji: "🌟", gradient: ["#5bbfaa", "#2d8a78"], image: require("../../assets/genres/fantasy.png") },
  "Sci-Fi":   { emoji: "🚀", gradient: ["#3a7bd5", "#1a4898"], image: require("../../assets/genres/scifi.png") },
  Thriller:   { emoji: "⚡", gradient: ["#8b3535", "#5a1010"], image: require("../../assets/genres/thriller.png") },
  "Self-Help":{ emoji: "🌱", gradient: ["#c47a4a", "#8a4020"], image: require("../../assets/genres/selfhelp.png") },
  Romance:    { emoji: "🌸", gradient: ["#c06080", "#8a2850"], image: require("../../assets/genres/romance.png") },
  History:    { emoji: "🏛️", gradient: ["#7a6a40", "#4a3a18"], image: require("../../assets/genres/history.png") },
  Biography:  { emoji: "🖊️", gradient: ["#4a7090", "#254060"], image: require("../../assets/genres/biography.png") },
  Horror:     { emoji: "🌙", gradient: ["#6a2a7a", "#2a0a3a"], image: require("../../assets/genres/horror.png") },
  Dystopian:  { emoji: "🔮", gradient: ["#4a5078", "#222440"], image: require("../../assets/genres/dystopian.png") },
};

const DEFAULT_META = { emoji: "📖", gradient: ["#7F77DD", "#4a40a8"] as const, image: null };

const BADGE: Record<string, { label: string; bg: string; text: string }> = {
  reading:      { label: "Reading",  bg: "rgba(127,119,221,0.2)",  text: "#9b95e8" },
  read:         { label: "Read",     bg: "rgba(91,191,170,0.2)",   text: "#5bbfaa" },
  want_to_read: { label: "Want",     bg: "rgba(184,180,212,0.12)", text: "#b8b4d4" },
  abandoned:    { label: "Stopped",  bg: "rgba(122,122,154,0.12)", text: "#7a7a9a" },
};

export default function GenreScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const { books: allBooks } = useBooks();

  const meta = GENRE_META[name] ?? DEFAULT_META;
  // genre is string[] in the real type — check if this genre is in the array
  const books = allBooks.filter((b) => Array.isArray(b.genre) ? b.genre.includes(name) : b.genre === name);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      {/* Hero — full-bleed image with gradient overlay */}
      <View style={styles.hero}>
        {meta.image ? (
          <Image
            source={meta.image}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <LinearGradient
            colors={meta.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* Dark gradient so back button and text stay legible */}
        <LinearGradient
          colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.72)"]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView>
          <View style={styles.heroTop}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M19 12H5M12 5l-7 7 7 7"
                  stroke="#fff"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroEmoji}>{meta.emoji}</Text>
            <Text style={styles.heroTitle}>{name}</Text>
            <Text style={styles.heroSub}>
              {books.length > 0
                ? `${books.length} book${books.length !== 1 ? "s" : ""} in your library`
                : "No books added yet"}
            </Text>
          </View>
        </SafeAreaView>
      </View>

      {/* Book list */}
      {books.length > 0 ? (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const badge = BADGE[item.status] ?? BADGE.want_to_read;
            return (
              <TouchableOpacity
                style={styles.bookRow}
                onPress={() => router.push(`/book/${item.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.coverShadow}>
                  <CoverImage uri={item.cover_url ?? ""} title={item.title} style={styles.cover} />
                </View>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.bookAuthor}>{item.author}</Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>{meta.emoji}</Text>
          <Text style={styles.emptyTitle}>No {name} books yet</Text>
          <Text style={styles.emptySub}>Add books from the Library tab to see them here.</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push("/(tabs)/library")}
          >
            <Text style={styles.emptyBtnText}>Browse Library</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Hero
  hero: { paddingBottom: 28, overflow: "hidden" },
  heroTop: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  heroContent: { paddingHorizontal: 24, paddingTop: 8 },
  heroEmoji: { fontSize: 44, marginBottom: 10 },
  heroTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 34, color: "#ffffff",
    marginBottom: 6,
  },
  heroSub: { fontSize: 14, color: "rgba(255,255,255,0.75)" },

  // Books
  list: { padding: 20, gap: 14 },
  bookRow: {
    flexDirection: "row", gap: 14,
    backgroundColor: colors.parchment,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.cream3,
    shadowColor: "#000", shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3,
  },
  coverShadow: {
    shadowColor: "#000", shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  cover: { width: 64, height: 94, borderRadius: 8 },
  bookInfo: { flex: 1, justifyContent: "center" },
  bookTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 15, color: colors.espresso, marginBottom: 4,
  },
  bookAuthor: { fontSize: 12, color: colors.char3, marginBottom: 10 },
  badge: {
    alignSelf: "flex-start", borderRadius: 6,
    paddingVertical: 3, paddingHorizontal: 8,
  },
  badgeText: { fontSize: 10, fontWeight: "600" },

  // Empty state
  empty: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20, color: colors.espresso,
    textAlign: "center", marginBottom: 8,
  },
  emptySub: {
    fontSize: 14, color: colors.char3,
    textAlign: "center", lineHeight: 20, marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: colors.terracotta,
    borderRadius: 20, paddingVertical: 12, paddingHorizontal: 28,
  },
  emptyBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
