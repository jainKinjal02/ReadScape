import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { useAppStore } from "../../src/store";
import { colors, moodConfig } from "../../src/design/tokens";
import { BookCover } from "../../src/components/BookCover";
import { MoodChip } from "../../src/components/MoodChip";
import { Book, Mood } from "../../src/types";

export default function HomeScreen() {
  const router = useRouter();
  const { userId } = useAppStore();
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [wantToRead, setWantToRead] = useState<Book[]>([]);
  const [streak, setStreak] = useState(0);
  const [booksThisYear, setBooksThisYear] = useState(0);
  const [lastMood, setLastMood] = useState<Mood | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState("");

  const fetchData = useCallback(async () => {
    if (!userId) return;

    // Fetch currently reading book
    const { data: readingBooks } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "reading")
      .order("date_started", { ascending: false })
      .limit(1);
    setCurrentBook(readingBooks?.[0] ?? null);

    // Fetch want to read
    const { data: wtrBooks } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "want_to_read")
      .limit(5);
    setWantToRead(wtrBooks ?? []);

    // Books finished this year
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const { count } = await supabase
      .from("books")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .eq("status", "read")
      .gte("date_finished", yearStart);
    setBooksThisYear(count ?? 0);

    // Last mood for current book
    if (readingBooks?.[0]) {
      const { data: moods } = await supabase
        .from("mood_logs")
        .select("mood")
        .eq("user_id", userId)
        .eq("book_id", readingBooks[0].id)
        .order("created_at", { ascending: false })
        .limit(1);
      setLastMood((moods?.[0]?.mood as Mood) ?? null);
    }

    // Calculate streak (days with at least one mood log)
    const { data: moodDates } = await supabase
      .from("mood_logs")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (moodDates) {
      const uniqueDays = new Set(
        moodDates.map((m) => m.created_at.split("T")[0])
      );
      let s = 0;
      const today = new Date();
      for (let i = 0; i < 60; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toISOString().split("T")[0];
        if (uniqueDays.has(key)) s++;
        else if (i > 0) break;
      }
      setStreak(s);
    }

    // User name
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("user_id", userId)
      .single();
    setUserName(profile?.name ?? "");
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const logMood = async (mood: Mood) => {
    if (!currentBook || !userId) return;
    await supabase.from("mood_logs").insert({
      user_id: userId,
      book_id: currentBook.id,
      page: currentBook.current_page,
      mood,
    });
    setLastMood(mood);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const progress = currentBook?.total_pages
    ? currentBook.current_page / currentBook.total_pages
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {getGreeting()}{userName ? `, ${userName}` : ""}
          </Text>
          <Text style={styles.date}>{getFormattedDate()}</Text>
        </View>
        <View style={styles.streakBadge}>
          <Text style={styles.streakNumber}>{streak}</Text>
          <Text style={styles.streakLabel}>day streak 🔥</Text>
        </View>
      </View>

      {/* Currently Reading */}
      {currentBook ? (
        <View style={styles.currentBookCard}>
          <Text style={styles.sectionTitle}>Currently Reading</Text>
          <View style={styles.bookRow}>
            <BookCover
              uri={currentBook.cover_url}
              title={currentBook.title}
              width={80}
              height={120}
            />
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle} numberOfLines={2}>
                {currentBook.title}
              </Text>
              <Text style={styles.bookAuthor} numberOfLines={1}>
                {currentBook.author}
              </Text>

              {/* Progress bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {currentBook.current_page} / {currentBook.total_pages ?? "?"} pages
                </Text>
              </View>

              {lastMood && (
                <View style={styles.lastMoodRow}>
                  <Text style={styles.lastMoodLabel}>Last feeling: </Text>
                  <Text style={styles.lastMoodEmoji}>
                    {moodConfig[lastMood].emoji} {moodConfig[lastMood].label}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.continueBtn}
                onPress={() => router.push(`/session/${currentBook.id}`)}
              >
                <Text style={styles.continueBtnText}>Continue Reading →</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick mood picker */}
          <Text style={styles.moodQuestion}>How are you feeling about it?</Text>
          <View style={styles.moodRow}>
            {(["loving_it", "getting_into_it", "struggling", "taking_a_break"] as Mood[]).map(
              (m) => (
                <MoodChip
                  key={m}
                  mood={m}
                  selected={lastMood === m}
                  onPress={() => logMood(m)}
                  size="sm"
                />
              )
            )}
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.emptyCard}
          onPress={() => router.push("/(tabs)/library")}
        >
          <Text style={styles.emptyEmoji}>📖</Text>
          <Text style={styles.emptyTitle}>Start a book</Text>
          <Text style={styles.emptySubtitle}>
            Add a book to your library to begin tracking your reading journey
          </Text>
        </TouchableOpacity>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{booksThisYear}</Text>
          <Text style={styles.statLabel}>books this year</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{streak}</Text>
          <Text style={styles.statLabel}>day streak</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{wantToRead.length}</Text>
          <Text style={styles.statLabel}>want to read</Text>
        </View>
      </View>

      {/* Want to Read shelf */}
      {wantToRead.length > 0 && (
        <View style={styles.shelfSection}>
          <View style={styles.shelfHeader}>
            <Text style={styles.sectionTitle}>Want to Read</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/library")}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={wantToRead}
            horizontal
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.shelfBook}
                onPress={() => router.push(`/book/${item.id}`)}
              >
                <BookCover
                  uri={item.cover_url}
                  title={item.title}
                  width={80}
                  height={120}
                />
                <Text style={styles.shelfBookTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </ScrollView>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: 20, paddingTop: 60, paddingBottom: 32 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  greeting: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: colors.inkPrimary,
  },
  date: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  streakBadge: {
    backgroundColor: colors.roseSoft,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  streakNumber: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: colors.roseAccent,
  },
  streakLabel: { fontSize: 10, color: colors.roseAccent },
  currentBookCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  bookRow: { flexDirection: "row", gap: 14 },
  bookInfo: { flex: 1, justifyContent: "space-between" },
  bookTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 16,
    color: colors.inkPrimary,
    marginBottom: 4,
  },
  bookAuthor: { fontSize: 13, color: colors.inkMuted, marginBottom: 8 },
  progressContainer: { marginBottom: 8 },
  progressBar: {
    height: 4,
    backgroundColor: colors.bgSurface,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.roseAccent,
    borderRadius: 999,
  },
  progressText: { fontSize: 11, color: colors.inkMuted },
  lastMoodRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  lastMoodLabel: { fontSize: 12, color: colors.inkMuted },
  lastMoodEmoji: { fontSize: 12, color: colors.inkPrimary },
  continueBtn: {
    backgroundColor: colors.roseAccent,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  continueBtnText: { color: "#FFF", fontSize: 12, fontWeight: "600" },
  moodQuestion: {
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: 16,
    marginBottom: 8,
  },
  moodRow: { flexDirection: "row", flexWrap: "wrap" },
  emptyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 18,
    color: colors.inkPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  statNumber: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: colors.roseAccent,
  },
  statLabel: { fontSize: 11, color: colors.inkMuted, textAlign: "center", marginTop: 2 },
  shelfSection: { marginBottom: 16 },
  shelfHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  seeAll: { fontSize: 13, color: colors.roseAccent, fontWeight: "600" },
  shelfBook: { marginRight: 12, width: 80 },
  shelfBookTitle: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 6,
    textAlign: "center",
  },
});
