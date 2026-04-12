import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Svg, { Path, Polyline, Circle, Line } from "react-native-svg";
import { colors } from "../../src/design/tokens";
import { CoverImage } from "../../src/components/CoverImage";
import {
  CURRENT_BOOK,
  SAMPLE_QUOTES,
  SAMPLE_NOTES,
  MOOD_ARC,
} from "../../src/data/mockData";

type Tab = "quotes" | "notes" | "reading_log";
const { width: W } = Dimensions.get("window");

export default function BookDetailScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("quotes");
  const [rating, setRating] = useState(CURRENT_BOOK.rating);

  const book = CURRENT_BOOK;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[2]}>
        {/* ── Hero blurred background ── */}
        <View style={styles.bdHero}>
          <Image
            source={{ uri: book.cover }}
            style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.25 }] }]}
            contentFit="cover"
          />
          <BlurView intensity={50} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["rgba(13,11,10,0.05)", colors.cream]}
            locations={[0, 1]}
            style={[StyleSheet.absoluteFill, { top: "35%" }]}
          />

          {/* Back button */}
          <View style={styles.bdTopRow}>
            <TouchableOpacity style={styles.bdCircleBtn} onPress={() => router.back()}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M19 12H5M12 5l-7 7 7 7"
                  stroke={colors.espresso}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bdCircleBtn}>
              <Text style={{ fontSize: 16, color: colors.terracotta }}>♡</Text>
            </TouchableOpacity>
          </View>

          {/* Floating centered cover */}
          <View style={styles.bdCoverWrap}>
            <View style={styles.bdCoverShadow}>
              <CoverImage uri={book.cover} title={book.title} style={styles.bdCoverImg} />
            </View>
          </View>
        </View>

        {/* ── Book info ── */}
        <View style={styles.bdInfo}>
          <Text style={styles.bdTitle}>{book.title}</Text>
          <Text style={styles.bdAuthor}>by {book.author}</Text>

          {/* Tags */}
          <View style={styles.bdTags}>
            {book.genre.map((g) => (
              <View key={g} style={styles.bdTag}>
                <Text style={styles.bdTagText}>{g}</Text>
              </View>
            ))}
            <View style={[styles.bdTag, styles.bdTagStatus]}>
              <Text style={[styles.bdTagText, { color: "#a85e3e" }]}>Reading</Text>
            </View>
            <View style={styles.bdTag}>
              <Text style={styles.bdTagText}>{book.totalPages} pages</Text>
            </View>
          </View>

          {/* Star rating */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)}>
                <Text style={[styles.star, s <= rating && styles.starFilled]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Synopsis */}
          <Text style={styles.synopsis} numberOfLines={3}>{book.synopsis}</Text>
        </View>

        {/* ── Progress section ── */}
        <View style={styles.bdProgSection}>
          <View style={styles.bdProgRow}>
            <Text style={styles.bdProgLabel}>Reading progress</Text>
            <Text style={styles.bdProgPct}>{book.progress}%</Text>
          </View>
          <View style={styles.progBg}>
            <View style={[styles.progFill, { width: `${book.progress}%` }]} />
          </View>
          <View style={styles.bdStatsMini}>
            <View style={styles.bdStatMini}>
              <Text style={styles.bdStatV}>{book.currentPage}</Text>
              <Text style={styles.bdStatL}>Current page</Text>
            </View>
            <View style={[styles.bdStatMini, styles.bdStatMiniMid]}>
              <Text style={styles.bdStatV}>{book.totalPages}</Text>
              <Text style={styles.bdStatL}>Total pages</Text>
            </View>
            <View style={styles.bdStatMini}>
              <Text style={styles.bdStatV}>{book.progress}%</Text>
              <Text style={styles.bdStatL}>Complete</Text>
            </View>
          </View>
        </View>

        {/* ── Tabs header (sticky) ── */}
        <View style={styles.tabRow}>
          {(["quotes", "notes", "reading_log"] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabItemText, activeTab === tab && styles.tabItemTextActive]}>
                {tab === "quotes" ? "Quotes" : tab === "notes" ? "Notes" : "Mood arc"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab content ── */}
        {activeTab === "quotes" && <QuotesTab />}
        {activeTab === "notes" && <NotesTab />}
        {activeTab === "reading_log" && <MoodArcTab />}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Bottom action bar ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomBtnSecondary}
          onPress={() => router.push("/(tabs)/session")}
        >
          <Text style={styles.bottomBtnSecondaryText}>Log session</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bottomBtnPrimary}
          onPress={() => router.push("/(tabs)/ai")}
        >
          <Text style={styles.bottomBtnPrimaryText}>Ask AI</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function QuotesTab() {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <View style={styles.tabContent}>
      {SAMPLE_QUOTES.map((q, i) => (
        <View
          key={q.id}
          style={[styles.quoteCard, i === 1 && { borderLeftColor: colors.sage }, i === 2 && { borderLeftColor: "#8b6a4a" }]}
        >
          <Text style={styles.quoteText}>"{q.text}"</Text>
          <Text style={styles.quotePage}>{q.chapter} · Page {q.page}</Text>
        </View>
      ))}
      {showAdd ? (
        <View style={styles.addCard}>
          <Text style={styles.addCardPlaceholder}>Type a passage that moved you…</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <TouchableOpacity
              style={styles.addSaveBtn}
              onPress={() => { Alert.alert("Quote saved!"); setShowAdd(false); }}
            >
              <Text style={styles.addSaveBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addCancelBtn} onPress={() => setShowAdd(false)}>
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

function NotesTab() {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <View style={styles.tabContent}>
      {SAMPLE_NOTES.map((n) => (
        <View key={n.id} style={styles.noteCard}>
          <Text style={styles.noteCardText}>{n.text}</Text>
          <Text style={styles.noteCardDate}>Apr {n.id === "n1" ? "8" : "10"}</Text>
        </View>
      ))}
      {showAdd ? (
        <View style={styles.addCard}>
          <Text style={styles.addCardPlaceholder}>Write your thought…</Text>
          <TouchableOpacity
            style={[styles.addSaveBtn, { marginTop: 12 }]}
            onPress={() => { Alert.alert("Note saved!"); setShowAdd(false); }}
          >
            <Text style={styles.addSaveBtnText}>Save Note</Text>
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

function MoodArcTab() {
  const chartW = W - 64;
  const chartH = 140;
  const PAD = 16;

  const pts = MOOD_ARC.map((item, i) => ({
    x: PAD + (i / (MOOD_ARC.length - 1)) * (chartW - PAD * 2),
    y: chartH - PAD - ((item.score - 1) / 4) * (chartH - PAD * 2),
    color: item.color,
  }));

  const MOOD_LABELS = [
    { symbol: "○", label: "Slow read", chapter: "Ch 1–2", color: "#c9bdb5" },
    { symbol: "✦", label: "Getting curious", chapter: "Ch 3–6", color: "#7a9e7e" },
    { symbol: "✦", label: "Hooked", chapter: "Ch 7–10", color: "#c97c5a" },
    { symbol: "◈", label: "Loving it", chapter: "Ch 11–Now", color: "#a85e3e" },
  ];

  return (
    <View style={styles.tabContent}>
      <Text style={styles.arcSub}>How your feeling changed through the book</Text>
      <View style={styles.chartCard}>
        <Svg width={chartW} height={chartH}>
          {/* Grid lines */}
          {[1, 2, 3, 4, 5].map((s) => {
            const y = chartH - PAD - ((s - 1) / 4) * (chartH - PAD * 2);
            return <Line key={s} x1={PAD} y1={y} x2={chartW - PAD} y2={y} stroke={colors.cream3} strokeWidth={1} />;
          })}
          {/* Line */}
          <Polyline
            points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={colors.terracotta}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Dots */}
          {pts.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={5}
              fill={p.color}
              stroke={colors.parchment}
              strokeWidth={2}
            />
          ))}
        </Svg>
        {/* Chapter labels */}
        <View style={styles.arcXlbls}>
          {MOOD_ARC.map((item, i) => (
            <Text key={i} style={styles.arcXlbl}>{item.chapter}</Text>
          ))}
        </View>
      </View>

      {/* Mood log rows */}
      {MOOD_LABELS.map((m, i) => (
        <View key={i} style={styles.logRow}>
          <View style={[styles.logDot, { backgroundColor: m.color }]} />
          <Text style={styles.logLabel}>{m.label}</Text>
          <Text style={styles.logChapter}>{m.chapter}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Hero
  bdHero: { height: 300, overflow: "hidden", position: "relative", paddingTop: 56 },
  bdTopRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 8,
  },
  bdCircleBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(26,22,18,0.9)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
    elevation: 2,
  },
  bdCoverWrap: { position: "absolute", bottom: -30, left: 0, right: 0, alignItems: "center" },
  bdCoverShadow: {
    borderRadius: 10, overflow: "hidden",
    shadowColor: "#2c1f14", shadowOpacity: 0.3, shadowOffset: { width: 0, height: 10 }, shadowRadius: 24,
    elevation: 10,
  },
  bdCoverImg: { width: 110, height: 160, borderRadius: 10 },

  // Info
  bdInfo: { paddingTop: 44, paddingHorizontal: 20, alignItems: "center", paddingBottom: 16 },
  bdTitle: {
    fontFamily: "PlayfairDisplay_700Bold", fontSize: 22,
    color: colors.espresso, textAlign: "center", marginBottom: 4,
  },
  bdAuthor: { fontSize: 13, color: colors.char3, marginBottom: 12 },
  bdTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 12 },
  bdTag: {
    paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: colors.cream3, backgroundColor: colors.cream2,
  },
  bdTagStatus: {
    backgroundColor: "rgba(201,124,90,0.1)", borderColor: "rgba(201,124,90,0.3)",
  },
  bdTagText: { fontSize: 11, color: colors.espresso2, fontWeight: "500" },
  starsRow: { flexDirection: "row", gap: 3, marginBottom: 12 },
  star: { fontSize: 18, color: colors.cream3 },
  starFilled: { color: colors.terracotta },
  synopsis: { fontSize: 12, color: colors.char3, lineHeight: 18, textAlign: "center" },

  // Progress
  bdProgSection: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 14, padding: 14,
  },
  bdProgRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  bdProgLabel: { fontSize: 12, fontWeight: "500", color: colors.espresso },
  bdProgPct: { fontSize: 12, color: colors.terracotta, fontWeight: "600" },
  progBg: { height: 4, backgroundColor: colors.cream3, borderRadius: 4 },
  progFill: { height: 4, backgroundColor: colors.terracotta, borderRadius: 4 },
  bdStatsMini: {
    flexDirection: "row", marginTop: 12,
    borderRadius: 8, overflow: "hidden",
    borderWidth: 1, borderColor: colors.cream3,
  },
  bdStatMini: { flex: 1, backgroundColor: colors.parchment, padding: 8, alignItems: "center" },
  bdStatMiniMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.cream3 },
  bdStatV: { fontSize: 13, fontWeight: "600", color: colors.espresso },
  bdStatL: { fontSize: 9, color: colors.char3, marginTop: 1 },

  // Tabs
  tabRow: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.cream3,
    backgroundColor: colors.cream, paddingHorizontal: 20,
  },
  tabItem: {
    flex: 1, paddingVertical: 11,
    borderBottomWidth: 2, borderBottomColor: "transparent",
    alignItems: "center",
  },
  tabItemActive: { borderBottomColor: colors.terracotta },
  tabItemText: { fontSize: 12, fontWeight: "500", color: colors.char3 },
  tabItemTextActive: { color: colors.terracotta },

  // Tab content
  tabContent: { paddingHorizontal: 20, paddingTop: 14 },

  // Quotes
  quoteCard: {
    borderLeftWidth: 3, borderLeftColor: colors.terracotta,
    borderTopWidth: 1, borderTopColor: colors.cream3,
    borderRightWidth: 1, borderRightColor: colors.cream3,
    borderBottomWidth: 1, borderBottomColor: colors.cream3,
    borderTopRightRadius: 10, borderBottomRightRadius: 10,
    backgroundColor: colors.parchment, padding: 12, marginBottom: 12,
  },
  quoteText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 13, color: colors.espresso, lineHeight: 20, marginBottom: 6,
  },
  quotePage: { fontSize: 11, color: colors.char3 },

  // Notes
  noteCard: {
    backgroundColor: colors.parchment, borderRadius: 12,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.cream3,
  },
  noteCardText: { fontSize: 13, color: colors.espresso, lineHeight: 19 },
  noteCardDate: { fontSize: 10, color: colors.char3, marginTop: 6 },

  // Add
  addDashedBtn: {
    borderWidth: 1.5, borderColor: colors.cream3, borderStyle: "dashed",
    borderRadius: 10, padding: 12, alignItems: "center", marginBottom: 12,
  },
  addDashedText: { fontSize: 13, color: colors.char3 },
  addCard: {
    backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  addCardPlaceholder: { fontSize: 13, color: colors.cream3, minHeight: 60 },
  addSaveBtn: {
    backgroundColor: colors.espresso, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 16, alignSelf: "flex-start",
  },
  addSaveBtnText: { color: colors.cream, fontSize: 13, fontWeight: "600" },
  addCancelBtn: {
    backgroundColor: colors.cream2, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 16, alignSelf: "flex-start",
    borderWidth: 1, borderColor: colors.cream3,
  },
  addCancelBtnText: { color: colors.char3, fontSize: 13 },

  // Mood arc
  arcSub: { fontSize: 11, color: colors.char3, marginBottom: 12 },
  chartCard: {
    backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 12, padding: 10, marginBottom: 14,
  },
  arcXlbls: { flexDirection: "row", marginTop: 6, paddingHorizontal: 8 },
  arcXlbl: { flex: 1, fontSize: 9, color: colors.char3, textAlign: "center" },
  logRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.cream3,
  },
  logDot: { width: 10, height: 10, borderRadius: 5 },
  logLabel: { flex: 1, fontSize: 13, color: colors.espresso },
  logChapter: { fontSize: 11, color: colors.char3 },

  // Bottom bar
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", gap: 10,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28,
    backgroundColor: colors.cream,
    borderTopWidth: 1, borderTopColor: colors.cream3,
  },
  bottomBtnSecondary: {
    flex: 1, backgroundColor: colors.cream2,
    borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 20, paddingVertical: 13, alignItems: "center",
  },
  bottomBtnSecondaryText: { fontSize: 13, fontWeight: "500", color: colors.espresso },
  bottomBtnPrimary: {
    flex: 1, backgroundColor: colors.espresso,
    borderRadius: 20, paddingVertical: 13, alignItems: "center",
  },
  bottomBtnPrimaryText: { fontSize: 13, fontWeight: "600", color: colors.cream },
});
