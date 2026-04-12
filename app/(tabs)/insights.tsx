import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import Svg, { G, Path, Circle, Text as SvgText } from "react-native-svg";
import { supabase } from "../../src/lib/supabase";
import { useAppStore } from "../../src/store";
import { colors, moodConfig } from "../../src/design/tokens";
import { BookCover } from "../../src/components/BookCover";
import { Book, MoodLog } from "../../src/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface GenreCount { genre: string; count: number }

export default function InsightsScreen() {
  const { userId } = useAppStore();
  const [readBooks, setReadBooks] = useState<Book[]>([]);
  const [abandonedBooks, setAbandonedBooks] = useState<Book[]>([]);
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [genreCounts, setGenreCounts] = useState<GenreCount[]>([]);
  const [booksThisYear, setBooksThisYear] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

    // Read books this year
    const { data: read } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "read")
      .gte("date_finished", yearStart)
      .order("date_finished", { ascending: false });
    setReadBooks((read ?? []) as Book[]);
    setBooksThisYear(read?.length ?? 0);

    // Total pages
    const pages = (read ?? []).reduce((sum, b) => sum + (b.total_pages ?? 0), 0);
    setTotalPages(pages);

    // Abandoned books
    const { data: abandoned } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "abandoned")
      .order("date_added", { ascending: false });
    setAbandonedBooks((abandoned ?? []) as Book[]);

    // Mood logs
    const { data: moods } = await supabase
      .from("mood_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    setMoodLogs((moods ?? []) as MoodLog[]);

    // Genre breakdown
    const allBooks = [...(read ?? []), ...(abandoned ?? [])];
    const genreMap: Record<string, number> = {};
    allBooks.forEach((b) => {
      (b.genre ?? []).forEach((g: string) => {
        genreMap[g] = (genreMap[g] ?? 0) + 1;
      });
    });
    const sorted = Object.entries(genreMap)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    setGenreCounts(sorted);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Mood distribution
  const moodDist: Record<string, number> = {};
  moodLogs.forEach((m) => { moodDist[m.mood] = (moodDist[m.mood] ?? 0) + 1; });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Insights</Text>
      <Text style={styles.subheading}>{new Date().getFullYear()} Reading Year</Text>

      {/* Top stats */}
      <View style={styles.statsRow}>
        <StatCard value={booksThisYear} label="books read" emoji="📚" />
        <StatCard value={totalPages.toLocaleString()} label="pages read" emoji="📄" />
        <StatCard value={moodLogs.length} label="check-ins" emoji="🎭" />
      </View>

      {/* Genre breakdown */}
      {genreCounts.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Genres You've Read</Text>
          {genreCounts.map((g, i) => (
            <View key={g.genre} style={styles.genreRow}>
              <Text style={styles.genreLabel}>{g.genre}</Text>
              <View style={styles.genreBarContainer}>
                <View
                  style={[
                    styles.genreBar,
                    {
                      width: `${(g.count / genreCounts[0].count) * 100}%`,
                      opacity: 1 - i * 0.12,
                    },
                  ]}
                />
              </View>
              <Text style={styles.genreCount}>{g.count}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Mood distribution */}
      {Object.keys(moodDist).length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Reading Moods</Text>
          {Object.entries(moodDist)
            .sort((a, b) => b[1] - a[1])
            .map(([mood, count]) => (
              <View key={mood} style={styles.moodDistRow}>
                <Text style={styles.moodEmoji}>{moodConfig[mood]?.emoji}</Text>
                <Text style={styles.moodLabel}>{moodConfig[mood]?.label}</Text>
                <View style={styles.moodBarContainer}>
                  <View
                    style={[
                      styles.moodBar,
                      {
                        width: `${(count / moodLogs.length) * 100}%`,
                        backgroundColor: moodConfig[mood]?.color ?? colors.roseAccent,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.moodCount}>{count}</Text>
              </View>
            ))}
        </View>
      )}

      {/* Year in Reading timeline */}
      {readBooks.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Year in Reading</Text>
          {readBooks.map((book) => (
            <View key={book.id} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <BookCover uri={book.cover_url} title={book.title} width={44} height={66} borderRadius={4} />
              <View style={styles.timelineInfo}>
                <Text style={styles.timelineTitle} numberOfLines={1}>{book.title}</Text>
                <Text style={styles.timelineAuthor} numberOfLines={1}>{book.author}</Text>
                {book.date_finished && (
                  <Text style={styles.timelineDate}>
                    Finished {formatDate(book.date_finished)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Abandoned shelf */}
      {abandonedBooks.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Abandoned Shelf</Text>
          <Text style={styles.cardSubtitle}>
            Books you put down — no judgement, just data.
          </Text>
          {abandonedBooks.map((book) => (
            <View key={book.id} style={styles.abandonedItem}>
              <BookCover uri={book.cover_url} title={book.title} width={44} height={66} borderRadius={4} />
              <View style={styles.abandonedInfo}>
                <Text style={styles.timelineTitle} numberOfLines={1}>{book.title}</Text>
                <Text style={styles.timelineAuthor}>{book.author}</Text>
                <Text style={styles.abandonedPage}>
                  Stopped at page {book.current_page ?? "?"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {readBooks.length === 0 && moodLogs.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={styles.emptyTitle}>Your reading story starts here</Text>
          <Text style={styles.emptySubtitle}>
            Once you start reading and logging moods, your insights will appear here.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function StatCard({ value, label, emoji }: { value: number | string; label: string; emoji: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  heading: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: colors.inkPrimary,
    marginBottom: 4,
  },
  subheading: { fontSize: 15, color: colors.inkMuted, marginBottom: 24 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  statEmoji: { fontSize: 22, marginBottom: 4 },
  statValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: colors.roseAccent,
  },
  statLabel: { fontSize: 10, color: colors.inkMuted, textAlign: "center", marginTop: 2 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: colors.inkPrimary,
    marginBottom: 4,
  },
  cardSubtitle: { fontSize: 12, color: colors.inkMuted, marginBottom: 14 },
  genreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  genreLabel: { width: 80, fontSize: 12, color: colors.inkPrimary },
  genreBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bgSurface,
    borderRadius: 999,
    overflow: "hidden",
  },
  genreBar: { height: 8, backgroundColor: colors.roseAccent, borderRadius: 999 },
  genreCount: { width: 24, fontSize: 12, color: colors.inkMuted, textAlign: "right" },
  moodDistRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  moodEmoji: { fontSize: 18, width: 24 },
  moodLabel: { width: 90, fontSize: 12, color: colors.inkPrimary },
  moodBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bgSurface,
    borderRadius: 999,
    overflow: "hidden",
  },
  moodBar: { height: 8, borderRadius: 999 },
  moodCount: { width: 24, fontSize: 12, color: colors.inkMuted, textAlign: "right" },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgSurface,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.roseAccent,
  },
  timelineInfo: { flex: 1 },
  timelineTitle: { fontSize: 13, fontWeight: "600", color: colors.inkPrimary },
  timelineAuthor: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  timelineDate: { fontSize: 11, color: colors.roseAccent, marginTop: 3 },
  abandonedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  abandonedInfo: { flex: 1 },
  abandonedPage: { fontSize: 11, color: colors.inkMuted, marginTop: 3 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: colors.inkPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: "center",
    lineHeight: 22,
  },
});
