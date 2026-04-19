import { SafeAreaView } from "react-native-safe-area-context";
import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { colors } from "../../src/design/tokens";
import { STATS, LIBRARY_BOOKS } from "../../src/data/mockData";

const { width: SW } = Dimensions.get("window");
// Card is 47% of (screen - 40px padding - 12px gap)
const CARD_W = (SW - 40 - 12) / 2;

const BG = "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=1200&q=80";

// ─── Genre configuration ─────────────────────────────────────────────────────
// Add a local `image` require() for each genre as you generate the images.
// Leave as `null` to fall back to the gradient.
const GENRES: {
  name: string;
  emoji: string;
  gradient: readonly [string, string];
  image: any;
}[] = [
  { name: "Fiction",    emoji: "📚", gradient: ["#7F77DD", "#4a40a8"], image: require("../../assets/genres/fiction.png") },
  { name: "Fantasy",    emoji: "🌟", gradient: ["#5bbfaa", "#2d8a78"], image: require("../../assets/genres/fantasy.png") },
  { name: "Sci-Fi",     emoji: "🚀", gradient: ["#3a7bd5", "#1a4898"], image: require("../../assets/genres/scifi.png") },
  { name: "Thriller",   emoji: "⚡", gradient: ["#8b3535", "#5a1010"], image: require("../../assets/genres/thriller.png") },
  { name: "Self-Help",  emoji: "🌱", gradient: ["#c47a4a", "#8a4020"], image: require("../../assets/genres/selfhelp.png") },
  { name: "Romance",    emoji: "🌸", gradient: ["#c06080", "#8a2850"], image: require("../../assets/genres/romance.png") },
  { name: "History",    emoji: "🏛️", gradient: ["#7a6a40", "#4a3a18"], image: require("../../assets/genres/history.png") },
  { name: "Biography",  emoji: "🖊️", gradient: ["#4a7090", "#254060"], image: require("../../assets/genres/biography.png") },
  { name: "Horror",     emoji: "🌙", gradient: ["#6a2a7a", "#2a0a3a"], image: require("../../assets/genres/horror.png") },
  { name: "Dystopian",  emoji: "🔮", gradient: ["#4a5078", "#222440"], image: require("../../assets/genres/dystopian.png") },
];

function bookCountForGenre(genre: string) {
  return LIBRARY_BOOKS.filter((b) => b.genre === genre).length;
}

// ─── Animated genre card ──────────────────────────────────────────────────────
function GenreCard({
  genre,
  index,
  onPress,
}: {
  genre: typeof GENRES[number];
  index: number;
  onPress: () => void;
}) {
  const count = bookCountForGenre(genre.name);

  // 1. Staggered entrance — fades + slides up
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceY = useRef(new Animated.Value(24)).current;

  // 2. Press spring scale
  const scale = useRef(new Animated.Value(1)).current;

  // 3. Shimmer sweep across the card
  const shimmerX = useRef(new Animated.Value(-CARD_W * 0.6)).current;

  useEffect(() => {
    // Staggered entrance
    Animated.parallel([
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 480,
        delay: index * 70,
        useNativeDriver: true,
      }),
      Animated.timing(entranceY, {
        toValue: 0,
        duration: 420,
        delay: index * 70,
        useNativeDriver: true,
      }),
    ]).start();

    // Shimmer loop — offset each card so they don't all flash at once
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2800 + index * 350),
        Animated.timing(shimmerX, {
          toValue: CARD_W * 1.4,
          duration: 750,
          useNativeDriver: true,
        }),
        // Reset instantly
        Animated.timing(shimmerX, {
          toValue: -CARD_W * 0.6,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          opacity: entranceOpacity,
          transform: [{ translateY: entranceY }, { scale }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.cardTouchable}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {/* Background: local image if available, else solid gradient */}
        {genre.image ? (
          <Image
            source={genre.image}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={genre.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Dark gradient overlay at bottom — keeps text legible over photos */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.72)"]}
          locations={[0.3, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Shimmer beam — a narrow translucent band that sweeps left→right */}
        <Animated.View
          style={[styles.shimmerBeam, { transform: [{ translateX: shimmerX }] }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[
              "transparent",
              "rgba(255,255,255,0.18)",
              "rgba(255,255,255,0.08)",
              "transparent",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {/* Card content */}
        <View style={styles.cardContent}>
          <Text style={styles.genreEmoji}>{genre.emoji}</Text>
          <Text style={styles.genreName}>{genre.name}</Text>
          <Text style={styles.genreCount}>
            {count > 0 ? `${count} book${count !== 1 ? "s" : ""}` : "Explore"}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <Image
        source={{ uri: BG }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
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

            {/* Genre section header */}
            <View style={styles.secHdr}>
              <Text style={styles.secTitle}>Explore by genre</Text>
              <Text style={styles.secSub}>Tap a genre to see your books</Text>
            </View>

            {/* Genre grid */}
            <View style={styles.genreGrid}>
              {GENRES.map((g, i) => (
                <GenreCard
                  key={g.name}
                  genre={g}
                  index={i}
                  onPress={() => router.push(`/genre/${g.name}`)}
                />
              ))}
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
    backgroundColor: colors.parchment,
    borderBottomWidth: 1,
    borderBottomColor: colors.cream3,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  insTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 22, color: colors.espresso },
  insSub: { fontSize: 13, color: colors.char3, marginTop: 2 },

  body: { paddingTop: 16 },

  // Stats
  bigStatRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20, marginBottom: 24 },
  bigStat: {
    width: "47%",
    backgroundColor: colors.parchment,
    borderWidth: 1,
    borderColor: colors.cream3,
    borderRadius: 14,
    padding: 16,
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

  // Card
  cardWrapper: {
    width: CARD_W,
    aspectRatio: 0.92,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
  },
  cardTouchable: {
    flex: 1,
  },
  shimmerBeam: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: CARD_W * 0.55,   // beam is ~55% of card width
    left: 0,
  },
  cardContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  genreEmoji: { fontSize: 34, marginBottom: 8 },
  genreName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: "#ffffff",
    marginBottom: 3,
  },
  genreCount: {
    fontSize: 11,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "500",
  },

  // Year wrap
  wrapCTA: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "rgba(127,119,221,0.1)",
    borderWidth: 1,
    borderColor: "rgba(127,119,221,0.25)",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  wrapTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 16, color: colors.espresso, marginBottom: 4 },
  wrapSub: { fontSize: 12, color: colors.char3 },
  wrapBtn: {
    marginTop: 10,
    backgroundColor: colors.espresso,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  wrapBtnText: { color: colors.cream, fontSize: 12, fontWeight: "500" },
});
