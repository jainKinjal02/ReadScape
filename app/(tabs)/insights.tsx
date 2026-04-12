import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { colors } from "../../src/design/tokens";
import { STATS, MOOD_ARC, GENRE_STATS } from "../../src/data/mockData";

const BG = "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&q=80";

export default function InsightsScreen() {
  return (
    <View style={{ flex: 1 }}>
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.insHdr}>
          <Text style={styles.insTitle}>Reading insights</Text>
          <Text style={styles.insSub}>Your {new Date().getFullYear()} journey so far</Text>
        </View>

        <View style={styles.body}>
          {/* Big stats 2×2 */}
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

          {/* Mood arc */}
          <View style={styles.secHdr}>
            <Text style={styles.secTitle}>Mood arc — Midnight Library</Text>
          </View>
          <View style={styles.moodArcCard}>
            <Text style={styles.arcSub}>How your feeling changed through the book</Text>
            <View style={styles.arcBars}>
              {MOOD_ARC.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.arcBar,
                    {
                      height: `${(item.score / 5) * 100}%`,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.arcXlbls}>
              {MOOD_ARC.map((item, i) => (
                <Text key={i} style={styles.arcXlbl}>{item.chapter}</Text>
              ))}
            </View>
            {/* Legend */}
            <View style={styles.arcLegend}>
              <LegendItem color="#c9bdb5" label="Slow" />
              <LegendItem color="#7a9e7e" label="Curious" />
              <LegendItem color="#c97c5a" label="Hooked" />
              <LegendItem color="#a85e3e" label="Loving it" />
            </View>
          </View>

          {/* Genre breakdown */}
          <View style={styles.secHdr}>
            <Text style={styles.secTitle}>Genres you love</Text>
          </View>
          <View style={styles.genreCard}>
            {GENRE_STATS.map((g, i) => (
              <View key={g.name} style={[styles.genreRow, i === GENRE_STATS.length - 1 && { marginBottom: 0 }]}>
                <Text style={styles.genreName}>{g.name}</Text>
                <View style={styles.genreBarBg}>
                  <View style={[styles.genreBarFill, { width: `${g.pct}%`, backgroundColor: g.color }]} />
                </View>
                <Text style={styles.genreCnt}>{g.count}</Text>
              </View>
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

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
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

  // Big stats
  bigStatRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  bigStat: {
    width: "47%", backgroundColor: colors.parchment,
    borderWidth: 1, borderColor: colors.cream3, borderRadius: 14, padding: 16,
  },
  bigStatV: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 28, color: colors.espresso },
  bigStatL: { fontSize: 11, color: colors.char3, marginTop: 2 },
  bigStatS: { fontSize: 11, color: colors.terracotta, marginTop: 4, fontWeight: "500" },

  secHdr: { paddingHorizontal: 20, marginBottom: 8 },
  secTitle: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 16, color: colors.espresso },

  // Mood arc
  moodArcCard: {
    backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 14, padding: 14, marginHorizontal: 20, marginBottom: 16,
  },
  arcSub: { fontSize: 11, color: colors.char3, marginBottom: 12 },
  arcBars: { height: 64, flexDirection: "row", gap: 5, alignItems: "flex-end" },
  arcBar: { flex: 1, borderRadius: 3 },
  arcXlbls: { flexDirection: "row", gap: 5, marginTop: 5 },
  arcXlbl: { flex: 1, fontSize: 9, color: colors.char3, textAlign: "center" },
  arcLegend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 10, color: colors.char3 },

  // Genre
  genreCard: {
    backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.cream3,
    borderRadius: 14, padding: 14, marginHorizontal: 20, marginBottom: 16,
  },
  genreRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  genreName: { fontSize: 12, color: colors.espresso, width: 80, fontWeight: "500" },
  genreBarBg: { flex: 1, backgroundColor: colors.cream3, borderRadius: 4, height: 6 },
  genreBarFill: { height: 6, borderRadius: 4 },
  genreCnt: { fontSize: 11, color: colors.char3, width: 20, textAlign: "right" },

  // Year wrap
  wrapCTA: {
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: "rgba(201,124,90,0.08)", borderWidth: 1, borderColor: "rgba(201,124,90,0.2)",
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
