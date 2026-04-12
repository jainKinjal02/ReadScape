import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  ImageBackground,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../src/design/tokens";
import { CoverImage } from "../../src/components/CoverImage";
import {
  CURRENT_USER,
  CURRENT_BOOK,
  STATS,
  WANT_TO_READ,
} from "../../src/data/mockData";

const { width: SW } = Dimensions.get("window");

// Atmospheric header background images
const HEADER_IMGS = [
  "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80",
  "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80",
];

function FireIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill={colors.terracotta}>
      <Path d="M12 2C8 7 4 9 4 14a8 8 0 0016 0c0-5-4-7-8-12z" />
    </Svg>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const bgIndex = useRef(0);
  const [bgSrc, setBgSrc] = React.useState(HEADER_IMGS[0]);
  const [nextBgSrc, setNextBgSrc] = React.useState(HEADER_IMGS[1]);
  const nextOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (bgIndex.current + 1) % HEADER_IMGS.length;
      setNextBgSrc(HEADER_IMGS[next]);
      Animated.timing(nextOpacity, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }).start(() => {
        bgIndex.current = next;
        setBgSrc(HEADER_IMGS[next]);
        nextOpacity.setValue(0);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const greeting = getGreeting();

  return (
    <View style={styles.root}>
      {/* Full-screen background image */}
      <Image
        source={{ uri: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1200&q=80" }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Atmospheric header with background image ── */}
        <View style={styles.heroHeader}>
          {/* Base bg */}
          <Image source={{ uri: bgSrc }} style={StyleSheet.absoluteFill} contentFit="cover" />
          {/* Crossfade next */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: nextOpacity }]}>
            <Image source={{ uri: nextBgSrc }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
          {/* Gradient overlay */}
          <LinearGradient
            colors={["rgba(44,31,20,0.55)", "rgba(44,31,20,0.35)", colors.cream]}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* Content */}
          <View style={styles.heroContent}>
            <View style={styles.topRow}>
              <View>
                <Text style={styles.greeting}>{greeting},</Text>
                <Text style={styles.name}>{CURRENT_USER.name}</Text>
              </View>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{CURRENT_USER.initials}</Text>
              </View>
            </View>
            <View style={styles.streakPill}>
              <FireIcon />
              <Text style={styles.streakText}>
                {CURRENT_USER.streak} day reading streak
              </Text>
            </View>
          </View>
        </View>

        {/* ── Currently Reading ── */}
        <TouchableOpacity
          style={styles.curCard}
          onPress={() => router.push("/book/1")}
          activeOpacity={0.88}
        >
          <View style={styles.curCoverWrap}>
            <CoverImage
              uri={CURRENT_BOOK.cover}
              title={CURRENT_BOOK.title}
              style={styles.curCoverImg}
            />
          </View>
          <View style={styles.curInfo}>
            <Text style={styles.curLabel}>Continue reading</Text>
            <Text style={styles.curTitle} numberOfLines={2}>{CURRENT_BOOK.title}</Text>
            <Text style={styles.curAuthor}>{CURRENT_BOOK.author}</Text>
            <View style={styles.progBg}>
              <View style={[styles.progFill, { width: `${CURRENT_BOOK.progress}%` }]} />
            </View>
            <Text style={styles.progLbl}>
              Page {CURRENT_BOOK.currentPage} of {CURRENT_BOOK.totalPages} · {CURRENT_BOOK.progress}%
            </Text>
            <View style={styles.moodTag}>
              <Text style={styles.moodTagText}>
                {CURRENT_BOOK.lastMood.symbol} {CURRENT_BOOK.lastMood.label}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <View style={styles.statC}>
            <Text style={styles.statV}>{STATS.booksRead}</Text>
            <Text style={styles.statL}>Books read</Text>
          </View>
          <View style={styles.statC}>
            <Text style={styles.statV}>2,847</Text>
            <Text style={styles.statL}>Pages this year</Text>
          </View>
          <View style={styles.statC}>
            <Text style={styles.statV}>{STATS.quotesSaved}</Text>
            <Text style={styles.statL}>Quotes saved</Text>
          </View>
        </View>

        {/* ── Want to Read ── */}
        <View style={styles.secHdrRow}>
          <Text style={styles.secTitle}>Want to read</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/library")}>
            <Text style={styles.secAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={[...WANT_TO_READ, { id: "__add__", title: "", author: "", cover: "" }]}
          horizontal
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelfRow}
          renderItem={({ item }) => {
            if (item.id === "__add__") {
              return (
                <TouchableOpacity
                  style={styles.addCard}
                  onPress={() => router.push("/(tabs)/library")}
                >
                  <Text style={styles.addPlus}>+</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                style={styles.shelfItem}
                onPress={() => router.push("/book/2")}
                activeOpacity={0.8}
              >
                <View style={styles.shelfCover}>
                  <CoverImage
                    uri={item.cover}
                    title={item.title}
                    style={styles.shelfCoverImg}
                  />
                </View>
                <Text style={styles.shelfTitle} numberOfLines={2}>{item.title}</Text>
              </TouchableOpacity>
            );
          }}
        />

        {/* ── AI Companion promo ── */}
        <TouchableOpacity
          style={styles.aiPromo}
          onPress={() => router.push("/(tabs)/ai")}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.aiPromoTitle}>Ask your reading companion</Text>
            <Text style={styles.aiPromoSub}>About {CURRENT_BOOK.title}</Text>
          </View>
          <View style={styles.aiPromoBtn}>
            <Text style={styles.aiPromoBtnText}>Ask AI</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: 20 },

  // Hero header
  heroHeader: { height: 190, justifyContent: "flex-end", overflow: "hidden" },
  heroContent: { padding: 20, paddingBottom: 16 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  greeting: { fontSize: 13, color: "rgba(247,242,235,0.8)", marginBottom: 2 },
  name: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 26, color: "#faf6f0" },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(247,242,235,0.2)",
    borderWidth: 1.5, borderColor: "rgba(247,242,235,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontWeight: "700", color: "#faf6f0" },
  streakPill: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    backgroundColor: "rgba(247,242,235,0.18)",
    borderWidth: 1, borderColor: "rgba(247,242,235,0.3)",
    borderRadius: 12, paddingVertical: 5, paddingHorizontal: 11,
  },
  streakText: { fontSize: 12, color: "#faf6f0", fontWeight: "500" },

  // Currently reading card
  curCard: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: colors.parchment,
    borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 16, padding: 16,
    flexDirection: "row", gap: 14,
    shadowColor: "#2c1f14", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
    elevation: 3,
  },
  curCoverWrap: {
    width: 58, height: 84, borderRadius: 6,
    shadowColor: "#2c1f14", shadowOpacity: 0.18, shadowOffset: { width: 3, height: 3 }, shadowRadius: 10,
    elevation: 4,
  },
  curCoverImg: { width: 58, height: 84, borderRadius: 6 },
  curInfo: { flex: 1 },
  curLabel: {
    fontSize: 10, color: colors.terracotta,
    textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600", marginBottom: 4,
  },
  curTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 15, color: colors.espresso, marginBottom: 2 },
  curAuthor: { fontSize: 12, color: colors.char3, marginBottom: 10 },
  progBg: { backgroundColor: colors.cream3, borderRadius: 4, height: 4 },
  progFill: { backgroundColor: colors.terracotta, height: 4, borderRadius: 4 },
  progLbl: { fontSize: 11, color: colors.char3, marginTop: 4 },
  moodTag: {
    alignSelf: "flex-start", marginTop: 6,
    backgroundColor: "rgba(201,124,90,0.1)", borderWidth: 1, borderColor: "rgba(201,124,90,0.2)",
    borderRadius: 10, paddingVertical: 3, paddingHorizontal: 9,
  },
  moodTagText: { fontSize: 11, color: colors.terracotta },

  // Stats
  statsRow: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 20 },
  statC: {
    flex: 1, backgroundColor: colors.parchment,
    borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 12, padding: 12, alignItems: "center",
  },
  statV: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 20, color: colors.espresso },
  statL: { fontSize: 10, color: colors.char3, marginTop: 2, textAlign: "center", lineHeight: 13 },

  // Want to read
  secHdrRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, marginBottom: 12,
  },
  secTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 18, color: colors.espresso },
  secAll: { fontSize: 12, color: colors.terracotta, fontWeight: "500" },
  shelfRow: { paddingLeft: 20, paddingRight: 12, paddingBottom: 4 },
  shelfItem: { width: 80, marginRight: 10 },
  shelfCover: {
    width: 80, height: 116, borderRadius: 8, marginBottom: 6,
    shadowColor: "#2c1f14", shadowOpacity: 0.14, shadowOffset: { width: 2, height: 4 }, shadowRadius: 10,
    elevation: 3,
  },
  shelfCoverImg: { width: 80, height: 116, borderRadius: 8 },
  shelfTitle: { fontSize: 10, color: colors.espresso2, lineHeight: 14, fontWeight: "500" },
  addCard: {
    width: 80, height: 116, borderRadius: 8,
    borderWidth: 1.5, borderColor: colors.cream3, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", marginRight: 10,
  },
  addPlus: { fontSize: 26, color: colors.cream3 },

  // AI promo
  aiPromo: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: "rgba(201,124,90,0.08)",
    borderWidth: 1, borderColor: "rgba(201,124,90,0.2)",
    borderRadius: 14, padding: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  aiPromoTitle: { fontSize: 13, fontWeight: "600", color: colors.espresso },
  aiPromoSub: { fontSize: 11, color: colors.char3, marginTop: 2 },
  aiPromoBtn: {
    backgroundColor: colors.espresso, borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  aiPromoBtnText: { fontSize: 12, color: colors.cream, fontWeight: "500" },
});
