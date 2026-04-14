import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { colors } from "../../src/design/tokens";
import { STATS, LIBRARY_BOOKS } from "../../src/data/mockData";

const BG = "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=1200&q=80";

const GENRES = [
  { name: "Fiction",   emoji: "📚", gradient: ["#7F77DD", "#4a40a8"] as const },
  { name: "Fantasy",   emoji: "🌟", gradient: ["#5bbfaa", "#2d8a78"] as const },
  { name: "Sci-Fi",    emoji: "🚀", gradient: ["#3a7bd5", "#1a4898"] as const },
  { name: "Thriller",  emoji: "⚡", gradient: ["#8b3535", "#5a1010"] as const },
  { name: "Self-Help", emoji: "🌱", gradient: ["#c47a4a", "#8a4020"] as const },
  { name: "Romance",   emoji: "🌸", gradient: ["#c06080", "#8a2850"] as const },
  { name: "History",   emoji: "🏛️", gradient: ["#7a6a40", "#4a3a18"] as const },
  { name: "Biography", emoji: "🖊️", gradient: ["#4a7090", "#254060"] as const },
  { name: "Horror",    emoji: "🌙", gradient: ["#6a2a7a", "#2a0a3a"] as const },
  { name: "Dystopian", emoji: "🔮", gradient: ["#4a5078", "#222440"] as const },
];

function bookCountForGenre(genre: string) {
  return LIBRARY_BOOKS.filter((b) => b.genre === genre).length;
}

export default function InsightsScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,25,35,0.7)" }]} />
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.insHdr}>
            <Text style={styles.insTitle}>Reading insights</Text>
            <Text style={styles.insSub}>Your {new Date().getFullYear()} journey so far</Text>
          </View>

          <View style={styles.body}>
            {/* Stats 2×2 */}
            <View style={styles.bigStatRow}>
              <View style={styles.bigStat}>
                <Text style={styles.bigStatV}>{STATS.booksRead}</Text>
                <Text style={styles.bigStatL}>Books finished</Text>
                <Text style={styles.bigStatS}>Goal: 20 books</Text>
              </View>
              <View style={styles.bigStat}>
                <Text style={styles.bigStatV}>2,847</Text>
                <Text style={styles.bigStatL}>Pages read</Text>
                <Text style={styles.bigStatS}>Avg 34 min/day</Text>
              </View>
              <View style={styles.bigStat}>
                <Text style={styles.bigStatV}>{STATS.streak}</Text>
                <Text style={styles.bigStatL}>Day streak</Text>
                <Text style={styles.bigStatS}>Best: 23 days</Text>
              </View>
              <View style={styles.bigStat}>
                <Text style={styles.bigStatV}>{STATS.quotesSaved}</Text>
                <Text style={styles.bigStatL}>Quotes saved</Text>
                <Text style={styles.bigStatS}>Across all books</Text>
              </View>
            </View>

            {/* Genre cards */}
            <View style={styles.secHdr}>
              <Text style={styles.secTitle}>Explore by genre</Text>
              <Text style={styles.secSub}>Tap a genre to see your books</Text>
            </View>

            <View style={styles.genreGrid}>
              {GENRES.map((g) => {
                const count = bookCountForGenre(g.name);
                return (
                  <TouchableOpacity
                    key={g.name}
                    style={styles.genreCard}
                    onPress={() => router.push(`/genre/${g.name}`)}
                    activeOpacity={0.82}
                  >
                    <LinearGradient
                      colors={g.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.genreCardInner}
                    >
                      <Text style={styles.genreEmoji}>{g.emoji}</Text>
                      <Text style={styles.genreName}>{g.name}</Text>
                      <Text style={styles.genreCount}>
                        {count > 0 ? `${count} book${count !== 1 ? "s" : ""}` : "Explore"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Year wrap CTA */}
            <TouchableOpacity style={styles.wrapCTA} activeOpacity={0.85}>
              <Text style={styles.wrapTitle}>Your {new Date().getFullYear()} reading wrap</Text>
              <Text style={styles.wrapSub}>{STATS.booksRead} books · your year in one page</Text>
              <View style={styles.wrapBtn}>
                <Text style={styles.wrapBtnText}>View wrap</Text>
              </View>
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  insHdr: {
    backgroundColor: colors.parchment, borderBottomWidth: 1, borderBottomColor: colors.cream3,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14,
  },
  insTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 22, color: colors.espresso },
  insSub: { fontSize: 13, color: colors.char3, marginTop: 2 },

  body: { paddingTop: 16 },

  // Stats
  bigStatRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20, marginBottom: 24 },
  bigStat: {
    width: "47%", backgroundColor: colors.parchment,
    borderWidth: 1, borderColor: colors.cream3, borderRadius: 14, padding: 16,
  },
  bigStatV: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 28, color: colors.espresso },
  bigStatL: { fontSize: 11, color: colors.char3, marginTop: 2 },
  bigStatS: { fontSize: 11, color: colors.terracotta, marginTop: 4, fontWeight: "500" },

  secHdr: { paddingHorizontal: 20, marginBottom: 14 },
  secTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18, color: colors.espresso },
  secSub: { fontSize: 12, color: colors.char3, marginTop: 3 },

  // Genre grid
  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  genreCard: {
    width: "47%",
    aspectRatio: 0.95,
    borderRadius: 18,
    overflow: "hidden",
    // Shadow
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  genreCardInner: {
    flex: 1,
    padding: 18,
    justifyContent: "flex-end",
  },
  genreEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  genreName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 17,
    color: "#ffffff",
    marginBottom: 4,
  },
  genreCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "500",
  },

  // Year wrap
  wrapCTA: {
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: "rgba(127,119,221,0.1)", borderWidth: 1, borderColor: "rgba(127,119,221,0.25)",
    borderRadius: 14, padding: 16, alignItems: "center",
  },
  wrapTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 16, color: colors.espresso, marginBottom: 4 },
  wrapSub: { fontSize: 12, color: colors.char3 },
  wrapBtn: {
    marginTop: 10, backgroundColor: colors.espresso, borderRadius: 16,
    paddingVertical: 8, paddingHorizontal: 20,
  },
  wrapBtnText: { color: colors.cream, fontSize: 12, fontWeight: "500" },
});
