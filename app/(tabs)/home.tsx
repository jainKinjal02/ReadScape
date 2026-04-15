import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  Modal,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../src/design/tokens";
import { CoverImage } from "../../src/components/CoverImage";
import {
  CURRENT_BOOK,
  STATS,
  WANT_TO_READ,
} from "../../src/data/mockData";
import { useAppStore } from "../../src/store";
import { supabase } from "../../src/lib/supabase";

const { width: SW } = Dimensions.get("window");
const PANEL_W = SW * 0.78;

// Atmospheric header background images
const HEADER_IMGS = [
  "https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=800&q=80",
  "https://images.unsplash.com/photo-1476275466078-4cdc48d9e56f?w=800&q=80",
  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80",
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
  const userName = useAppStore((s) => s.userName);
  const streak = useAppStore((s) => s.streak);
  const setUserId = useAppStore((s) => s.setUserId);
  const setUserName = useAppStore((s) => s.setUserName);

  // Derive initials from the real user name (first letter of each word, max 2)
  const initials = userName
    ? userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  // ── Profile panel ─────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const panelAnim = useRef(new Animated.Value(PANEL_W)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openPanel = () => {
    setPanelOpen(true);
    Animated.parallel([
      Animated.spring(panelAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 14 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closePanel = (onDone?: () => void) => {
    Animated.parallel([
      Animated.timing(panelAnim, { toValue: PANEL_W, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setPanelOpen(false);
      onDone?.();
    });
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    setUserId(null);
    setUserName("");
    setLoggingOut(false);
    closePanel(() => router.replace("/"));
  };

  // ── Hero crossfade ────────────────────────────────────────────────────────
  const opacities = useRef(
    HEADER_IMGS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))
  ).current;
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

  const greeting = getGreeting();

  return (
    <View style={styles.root}>
      {/* Full-screen background image */}
      <Image
        source={{ uri: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=1200&q=80" }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,25,35,0.72)" }]} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Atmospheric header ── */}
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
          <View style={styles.heroContent}>
            <View style={styles.topRow}>
              <View>
                <Text style={styles.greeting}>{greeting},</Text>
                <Text style={styles.name}>{userName || "Reader"}</Text>
              </View>
              {/* Avatar — opens profile panel */}
              <TouchableOpacity style={styles.avatar} onPress={openPanel} activeOpacity={0.75}>
                <Text style={styles.avatarText}>{initials}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.streakPill}>
              <FireIcon />
              <Text style={styles.streakText}>{streak} day reading streak</Text>
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
            <CoverImage uri={CURRENT_BOOK.cover} title={CURRENT_BOOK.title} style={styles.curCoverImg} />
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
                  <CoverImage uri={item.cover} title={item.title} style={styles.shelfCoverImg} />
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

      {/* ── Profile slide-in panel ── */}
      <Modal visible={panelOpen} transparent animationType="none" onRequestClose={() => closePanel()}>
        {/* Dim overlay — tap to close */}
        <Animated.View
          style={[styles.overlay, { opacity: overlayAnim }]}
          pointerEvents={panelOpen ? "auto" : "none"}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => closePanel()} />
        </Animated.View>

        {/* Panel slides in from right */}
        <Animated.View style={[styles.panel, { transform: [{ translateX: panelAnim }] }]}>
          {/* Header area with gradient */}
          <LinearGradient
            colors={["#1a2a40", "#0f1923"]}
            style={styles.panelHeader}
          >
            {/* Close button */}
            <TouchableOpacity style={styles.closeBtn} onPress={() => closePanel()} activeOpacity={0.7}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            </TouchableOpacity>

            {/* Avatar */}
            <View style={styles.panelAvatar}>
              <Text style={styles.panelAvatarText}>{initials}</Text>
            </View>
            <Text style={styles.panelName}>{userName || "Reader"}</Text>
            <View style={styles.panelBadge}>
              <Text style={styles.panelBadgeText}>ReadScape Member</Text>
            </View>
          </LinearGradient>

          {/* Stats strip */}
          <View style={styles.panelStats}>
            <View style={styles.panelStat}>
              <Text style={styles.panelStatV}>{STATS.booksRead}</Text>
              <Text style={styles.panelStatL}>Books read</Text>
            </View>
            <View style={styles.panelStatDivider} />
            <View style={styles.panelStat}>
              <Text style={styles.panelStatV}>{streak}</Text>
              <Text style={styles.panelStatL}>Day streak</Text>
            </View>
            <View style={styles.panelStatDivider} />
            <View style={styles.panelStat}>
              <Text style={styles.panelStatV}>{STATS.quotesSaved}</Text>
              <Text style={styles.panelStatL}>Quotes</Text>
            </View>
          </View>

          {/* Menu items */}
          <View style={styles.panelMenu}>
            <PanelRow icon="📚" label="My Library" onPress={() => closePanel(() => router.push("/(tabs)/library"))} />
            <PanelRow icon="✦" label="AI Companion" onPress={() => closePanel(() => router.push("/(tabs)/ai"))} />
            <PanelRow icon="📊" label="Insights" onPress={() => closePanel(() => router.push("/(tabs)/insights"))} />
          </View>

          {/* Divider */}
          <View style={styles.panelDivider} />

          {/* Log Out */}
          <TouchableOpacity
            style={[styles.logoutBtn, loggingOut && { opacity: 0.6 }]}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.8}
          >
            {loggingOut ? (
              <ActivityIndicator color="#e88080" size="small" />
            ) : (
              <>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    stroke="#e88080"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.logoutText}>Log Out</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </View>
  );
}

function PanelRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.panelRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.panelRowIcon}>{icon}</Text>
      <Text style={styles.panelRowLabel}>{label}</Text>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginLeft: "auto" }}>
        <Path d="M9 18l6-6-6-6" stroke={colors.char3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </TouchableOpacity>
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
    backgroundColor: "rgba(127,119,221,0.35)",
    borderWidth: 1.5, borderColor: "rgba(127,119,221,0.7)",
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
    shadowColor: "#000", shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
    elevation: 3,
  },
  curCoverWrap: {
    width: 58, height: 84, borderRadius: 6,
    shadowColor: "#000", shadowOpacity: 0.18, shadowOffset: { width: 3, height: 3 }, shadowRadius: 10,
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
    backgroundColor: "rgba(127,119,221,0.12)", borderWidth: 1, borderColor: "rgba(127,119,221,0.25)",
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
    shadowColor: "#000", shadowOpacity: 0.14, shadowOffset: { width: 2, height: 4 }, shadowRadius: 10,
    elevation: 3,
  },
  shelfCoverImg: { width: 80, height: 116, borderRadius: 8 },
  shelfTitle: { fontSize: 10, color: colors.espresso2, lineHeight: 14, fontWeight: "500" },
  addCard: {
    width: 80, height: 116, borderRadius: 8,
    borderWidth: 1.5, borderColor: "rgba(127,119,221,0.55)", borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", marginRight: 10,
    backgroundColor: "rgba(127,119,221,0.08)",
  },
  addPlus: { fontSize: 26, color: colors.terra2 },

  // AI promo
  aiPromo: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: "rgba(127,119,221,0.1)",
    borderWidth: 1, borderColor: "rgba(127,119,221,0.25)",
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

  // ── Profile panel ──────────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,10,18,0.65)",
  },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    width: PANEL_W,
    height: "100%",
    backgroundColor: colors.cream2,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowOffset: { width: -4, height: 0 },
    shadowRadius: 20,
    elevation: 20,
  },

  // Panel header (gradient section)
  panelHeader: {
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 52,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  panelAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(127,119,221,0.25)",
    borderWidth: 2.5,
    borderColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  panelAvatarText: {
    fontSize: 26,
    fontWeight: "700",
    color: "#f0eef8",
  },
  panelName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: colors.espresso,
    marginBottom: 8,
    textAlign: "center",
  },
  panelBadge: {
    backgroundColor: "rgba(127,119,221,0.15)",
    borderWidth: 1,
    borderColor: "rgba(127,119,221,0.3)",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  panelBadgeText: {
    fontSize: 11,
    color: colors.terra2,
    fontWeight: "600",
  },

  // Stats strip
  panelStats: {
    flexDirection: "row",
    backgroundColor: colors.parchment,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.cream3,
    paddingVertical: 16,
  },
  panelStat: {
    flex: 1,
    alignItems: "center",
  },
  panelStatV: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: colors.espresso,
  },
  panelStatL: {
    fontSize: 10,
    color: colors.char3,
    marginTop: 2,
  },
  panelStatDivider: {
    width: 1,
    backgroundColor: colors.cream3,
    marginVertical: 4,
  },

  // Menu rows
  panelMenu: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  panelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.cream3,
  },
  panelRowIcon: {
    fontSize: 18,
    width: 24,
    textAlign: "center",
  },
  panelRowLabel: {
    fontSize: 14,
    color: colors.espresso,
    fontWeight: "500",
  },

  panelDivider: {
    height: 1,
    backgroundColor: colors.cream3,
    marginTop: 8,
    marginBottom: 8,
  },

  // Log out
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 40,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "rgba(180,60,60,0.1)",
    borderWidth: 1,
    borderColor: "rgba(180,60,60,0.25)",
    borderRadius: 12,
    justifyContent: "center",
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e88080",
  },
});
