import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { colors } from "../../src/design/tokens";
import { STATS, LIBRARY_BOOKS } from "../../src/data/mockData";
import { useAppStore } from "../../src/store";

const { width: SW } = Dimensions.get("window");
// Card is 47% of (screen - 40px padding - 12px gap)
const CARD_W = (SW - 40 - 12) / 2;

const BG = "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=1200&q=80";

const HEADER_IMGS = [
  "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80",
  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80",
  "https://images.unsplash.com/photo-1476275466078-4cdc48d9e56f?w=800&q=80",
];

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

// ─── Year Wrap Modal ──────────────────────────────────────────────────────────
function YearWrapModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const books = useAppStore((s) => s.books);
  const readingGoal = useAppStore((s) => s.readingGoal);
  const year = new Date().getFullYear();

  // Slide-up animation
  const slideY = useRef(new Animated.Value(600)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 600, duration: 240, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Compute wrap stats from real store data
  const finishedBooks = books.filter((b) => {
    if (b.status !== "read") return false;
    if (!b.date_finished) return true; // count books marked read even without date
    return new Date(b.date_finished).getFullYear() === year;
  });

  const totalPages = finishedBooks.reduce((sum, b) => sum + (b.total_pages ?? 0), 0);

  // Top genre
  const genreCounts: Record<string, number> = {};
  finishedBooks.forEach((b) => {
    (b.genre ?? []).forEach((g) => {
      genreCounts[g] = (genreCounts[g] ?? 0) + 1;
    });
  });
  const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const goalMet = readingGoal > 0 && finishedBooks.length >= readingGoal;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <StatusBar barStyle="light-content" />
      <Animated.View style={[wrapStyles.overlay, { opacity: bgOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View
        style={[wrapStyles.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideY }] }]}
      >
        {/* Header gradient */}
        <LinearGradient
          colors={["rgba(127,119,221,0.35)", "rgba(127,119,221,0.08)", "transparent"]}
          style={wrapStyles.sheetGrad}
          pointerEvents="none"
        />

        {/* Stars decoration */}
        <View style={wrapStyles.starsRow} pointerEvents="none">
          {["✦", "✧", "✦", "✧", "✦"].map((s, i) => (
            <Text key={i} style={[wrapStyles.star, { opacity: 0.4 + i * 0.08 }]}>{s}</Text>
          ))}
        </View>

        {/* Close pill */}
        <TouchableOpacity style={wrapStyles.closeArea} onPress={onClose}>
          <View style={wrapStyles.closePill} />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={wrapStyles.scrollContent}>
          {/* Year label */}
          <Text style={wrapStyles.yearLabel}>{year}</Text>
          <Text style={wrapStyles.wrapHeading}>Your Reading Year</Text>

          {finishedBooks.length === 0 ? (
            /* Empty state */
            <View style={wrapStyles.emptyState}>
              <Text style={wrapStyles.emptyEmoji}>📖</Text>
              <Text style={wrapStyles.emptyTitle}>Your story starts here</Text>
              <Text style={wrapStyles.emptySub}>
                Finish your first book of {year} and it'll appear in your wrap.
              </Text>
            </View>
          ) : (
            <>
              {/* Big stat cards */}
              <View style={wrapStyles.statRow}>
                <View style={wrapStyles.statCard}>
                  <Text style={wrapStyles.statBig}>{finishedBooks.length}</Text>
                  <Text style={wrapStyles.statLabel}>Books finished</Text>
                  {readingGoal > 0 && (
                    <Text style={[wrapStyles.statNote, goalMet && { color: colors.sage }]}>
                      {goalMet ? `Goal of ${readingGoal} reached ✓` : `${readingGoal - finishedBooks.length} left to goal`}
                    </Text>
                  )}
                </View>
                <View style={wrapStyles.statCard}>
                  <Text style={wrapStyles.statBig}>{totalPages > 0 ? totalPages.toLocaleString() : "—"}</Text>
                  <Text style={wrapStyles.statLabel}>Pages turned</Text>
                  {totalPages > 0 && (
                    <Text style={wrapStyles.statNote}>{Math.round(totalPages / 365)} pages/day avg</Text>
                  )}
                </View>
              </View>

              {/* Top genre badge */}
              {topGenre && (
                <View style={wrapStyles.genreBadge}>
                  <Text style={wrapStyles.genreBadgeLabel}>Your top genre</Text>
                  <Text style={wrapStyles.genreBadgeValue}>{topGenre}</Text>
                </View>
              )}

              {/* Books timeline */}
              <Text style={wrapStyles.timelineTitle}>Books you finished</Text>
              {finishedBooks.map((book, idx) => (
                <View key={book.id} style={wrapStyles.timelineRow}>
                  <View style={wrapStyles.timelineLeft}>
                    <Text style={wrapStyles.timelineNum}>{String(idx + 1).padStart(2, "0")}</Text>
                    {idx < finishedBooks.length - 1 && <View style={wrapStyles.timelineLine} />}
                  </View>
                  <View style={wrapStyles.timelineCard}>
                    {book.cover_url ? (
                      <Image
                        source={{ uri: book.cover_url }}
                        style={wrapStyles.timelineCover}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[wrapStyles.timelineCover, wrapStyles.timelineCoverFallback]}>
                        <Text style={{ fontSize: 18 }}>📚</Text>
                      </View>
                    )}
                    <View style={wrapStyles.timelineInfo}>
                      <Text style={wrapStyles.timelineBookTitle} numberOfLines={2}>{book.title}</Text>
                      {book.author ? (
                        <Text style={wrapStyles.timelineAuthor} numberOfLines={1}>{book.author}</Text>
                      ) : null}
                      {book.rating ? (
                        <Text style={wrapStyles.timelineRating}>
                          {"★".repeat(book.rating)}{"☆".repeat(5 - (book.rating ?? 0))}
                        </Text>
                      ) : null}
                      {book.date_finished ? (
                        <Text style={wrapStyles.timelineDate}>
                          {new Date(book.date_finished).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 16 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const readingGoal = useAppStore((s) => s.readingGoal);
  const [showWrap, setShowWrap] = useState(false);

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

  return (
    <View style={{ flex: 1 }}>
      <Image
        source={{ uri: BG }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
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
          <Text style={styles.heroTitle}>Reading Insights</Text>
          <Text style={styles.heroSub}>Your {new Date().getFullYear()} journey</Text>
        </View>
      </View>

      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["bottom"]}>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

          <View style={styles.body}>
            {/* Stats 2×2 */}
            <View style={styles.bigStatRow}>
              <View style={styles.bigStat}>
                <Text style={styles.bigStatV}>{STATS.booksRead}</Text>
                <Text style={styles.bigStatL}>Books finished</Text>
                <Text style={styles.bigStatS}>
                  {readingGoal > 0 ? `Goal: ${readingGoal} books` : "Set a goal"}
                </Text>
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
            <TouchableOpacity style={styles.wrapCTA} activeOpacity={0.85} onPress={() => setShowWrap(true)}>
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

      <YearWrapModal visible={showWrap} onClose={() => setShowWrap(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Atmospheric hero header
  heroHeader: { height: 170, overflow: "hidden", justifyContent: "flex-end" },
  heroContent: { paddingHorizontal: 20, paddingBottom: 16 },
  heroTitle: { fontFamily: "CormorantGaramond_700Bold", fontSize: 28, color: "#faf6f0" },
  heroSub: { fontSize: 13, color: "rgba(247,242,235,0.75)", marginTop: 3 },

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
  bigStatV: { fontFamily: "CormorantGaramond_700Bold", fontSize: 28, color: colors.espresso },
  bigStatL: { fontSize: 11, color: colors.char3, marginTop: 2 },
  bigStatS: { fontSize: 11, color: colors.terracotta, marginTop: 4, fontWeight: "500" },

  secHdr: { paddingHorizontal: 20, marginBottom: 14 },
  secTitle: { fontFamily: "CormorantGaramond_700Bold", fontSize: 18, color: colors.espresso },
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
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 16,
    color: "#ffffff",
    marginBottom: 3,
  },
  genreCount: {
    fontSize: 11,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "500",
  },

  // Year wrap CTA button
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
  wrapTitle: { fontFamily: "CormorantGaramond_700Bold", fontSize: 16, color: colors.espresso, marginBottom: 4 },
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

// ─── Year Wrap Modal styles ───────────────────────────────────────────────────
const wrapStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "92%",
    backgroundColor: colors.parchment,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  sheetGrad: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    paddingTop: 28,
    paddingBottom: 4,
  },
  star: { fontSize: 10, color: colors.terracotta },
  closeArea: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingTop: 12 },
  closePill: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.cream3 },

  scrollContent: { paddingHorizontal: 24, paddingTop: 8 },

  yearLabel: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 56,
    color: colors.terracotta,
    opacity: 0.22,
    textAlign: "center",
    marginTop: 8,
    letterSpacing: 6,
  },
  wrapHeading: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 26,
    color: colors.espresso,
    textAlign: "center",
    marginTop: -34,
    marginBottom: 24,
  },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: colors.espresso, marginBottom: 8 },
  emptySub: { fontSize: 13, color: colors.char3, textAlign: "center", lineHeight: 20 },

  // Stats row
  statRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: colors.cream2,
    borderWidth: 1,
    borderColor: colors.cream3,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  statBig: { fontFamily: "CormorantGaramond_700Bold", fontSize: 36, color: colors.espresso },
  statLabel: { fontSize: 11, color: colors.char3, marginTop: 2, textAlign: "center" },
  statNote: { fontSize: 10, color: colors.terracotta, marginTop: 6, textAlign: "center", fontWeight: "500" },

  // Top genre badge
  genreBadge: {
    backgroundColor: "rgba(127,119,221,0.12)",
    borderWidth: 1,
    borderColor: "rgba(127,119,221,0.3)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  genreBadgeLabel: { fontSize: 11, color: colors.char3, marginBottom: 4, letterSpacing: 0.5 },
  genreBadgeValue: { fontFamily: "CormorantGaramond_700Bold", fontSize: 22, color: colors.terracotta },

  // Books timeline
  timelineTitle: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 17,
    color: colors.espresso,
    marginBottom: 16,
  },
  timelineRow: { flexDirection: "row", marginBottom: 20 },
  timelineLeft: { width: 32, alignItems: "center" },
  timelineNum: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 13,
    color: colors.terracotta,
    opacity: 0.7,
    marginBottom: 6,
  },
  timelineLine: {
    flex: 1,
    width: 1,
    backgroundColor: colors.cream3,
    marginBottom: 4,
  },
  timelineCard: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.cream2,
    borderWidth: 1,
    borderColor: colors.cream3,
    borderRadius: 12,
    padding: 12,
    marginLeft: 10,
  },
  timelineCover: {
    width: 48,
    height: 68,
    borderRadius: 6,
    flexShrink: 0,
  },
  timelineCoverFallback: {
    backgroundColor: colors.cream3,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineInfo: { flex: 1, justifyContent: "center" },
  timelineBookTitle: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 15,
    color: colors.espresso,
    lineHeight: 20,
  },
  timelineAuthor: { fontSize: 11, color: colors.char3, marginTop: 3 },
  timelineRating: { fontSize: 11, color: colors.terracotta, marginTop: 4 },
  timelineDate: { fontSize: 10, color: colors.char3, marginTop: 4, opacity: 0.7 },
});
