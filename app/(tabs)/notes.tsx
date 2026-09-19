import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useCallback, useState } from "react";
import {
  useWindowDimensions,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, fonts } from "../../src/design/tokens";
import { useAppStore } from "../../src/store";
import { fetchAllNotes, fetchAllQuotes } from "../../src/lib/books";
import { Note, Quote } from "../../src/types";

type Filter = "all" | "quotes" | "thoughts";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Quotes", value: "quotes" },
  { label: "Thoughts", value: "thoughts" },
];

// One list, two sources. A quote and a note are different things to write
// down but the same thing to look back on, so they interleave by date.
type Entry =
  | { kind: "quote"; id: string; bookId: string; text: string; page: number | null; at: string }
  | { kind: "note"; id: string; bookId: string; text: string; at: string };

// Quotes carry the highlighter, as they do on the book screen. The range is
// derived rather than stored — see QuoteBody in app/book/[id].tsx.
function markRange(text: string): [number, number] {
  if (text.length < 40) return [0, text.length];
  const from = text.indexOf(" ", Math.floor(text.length * 0.18));
  const to = text.indexOf(" ", Math.floor(text.length * 0.68));
  return [from === -1 ? 0 : from + 1, to === -1 ? text.length : to];
}

function stripQuoteMarks(text: string): string {
  return text.trim().replace(/^["“”']+/, "").replace(/["“”']+$/, "").trim();
}

export default function NotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const gutter = Math.round(Math.min(30, Math.max(18, winW * 0.065)));

  const userId = useAppStore((s) => s.userId);
  const books = useAppStore((s) => s.books);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  // Refetch on focus: quotes and notes are written on the book screen, and a
  // tab is never unmounted between visits.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      setLoading(true);
      Promise.all([fetchAllQuotes(userId), fetchAllNotes(userId)])
        .then(([q, n]) => {
          if (cancelled) return;
          setQuotes(q);
          setNotes(n);
        })
        .catch(() => {
          // Non-fatal — the empty state stands in.
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [userId])
  );

  const titleFor = (bookId: string) =>
    books.find((b) => b.id === bookId)?.title ?? "A book";

  const entries: Entry[] = [
    ...quotes.map((q) => ({
      kind: "quote" as const,
      id: q.id,
      bookId: q.book_id,
      text: q.text,
      page: q.page ?? null,
      at: q.created_at,
    })),
    ...notes.map((n) => ({
      kind: "note" as const,
      id: n.id,
      bookId: n.book_id,
      text: n.text,
      at: n.created_at,
    })),
  ]
    .filter((e) =>
      filter === "all" ? true : filter === "quotes" ? e.kind === "quote" : e.kind === "note"
    )
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: insets.top + 10,
          paddingBottom: 28 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>Notes</Text>
        <Text style={styles.sub}>Everything you kept</Text>

        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.tab, filter === f.value && styles.tabActive]}
              onPress={() => setFilter(f.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, filter === f.value && styles.tabTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && entries.length === 0 ? (
          <ActivityIndicator color={colors.pencil} style={{ marginTop: 40 }} />
        ) : entries.length === 0 ? (
          <Text style={styles.empty}>
            {filter === "quotes"
              ? "No quotes yet. Open a book and keep a passage that moved you."
              : filter === "thoughts"
              ? "No thoughts yet. Notes you write on a book collect here."
              : "Nothing kept yet. Quotes and notes from your books gather here."}
          </Text>
        ) : (
          entries.map((e, i) => (
            <TouchableOpacity
              key={`${e.kind}-${e.id}`}
              style={[styles.note, i === entries.length - 1 && styles.noteLast]}
              onPress={() => router.push(`/book/${e.bookId}`)}
              activeOpacity={0.75}
            >
              <View style={styles.from}>
                <Text style={styles.fromTitle} numberOfLines={1}>{titleFor(e.bookId)}</Text>
                <Text style={styles.fromMeta}>
                  {e.kind === "quote"
                    ? e.page
                      ? `page ${e.page}`
                      : "a quote"
                    : "a thought"}
                </Text>
              </View>

              {e.kind === "quote" ? (
                <QuoteLine text={e.text} index={i} />
              ) : (
                <Text style={styles.thought}>{e.text}</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function QuoteLine({ text, index }: { text: string; index: number }) {
  const clean = stripQuoteMarks(text);
  const [from, to] = markRange(clean);
  const markStyle = index % 2 === 0 ? styles.mark : styles.markAlt;
  return (
    <Text style={styles.quote}>
      {"“"}
      {clean.slice(0, from)}
      <Text style={markStyle}>{clean.slice(from, to)}</Text>
      {clean.slice(to)}
      {"”"}
    </Text>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.pencil, marginTop: 5 },

  filters: {
    flexDirection: "row",
    gap: 17,
    marginTop: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  tab: { paddingBottom: 9, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: colors.ink },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.pencil },
  tabTextActive: { color: colors.ink },

  note: { paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: colors.rule },
  noteLast: { borderBottomWidth: 0 },
  from: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 9,
  },
  fromTitle: { flex: 1, fontFamily: fonts.display, fontSize: 12.5, color: colors.ink },
  fromMeta: { fontFamily: fonts.body, fontSize: 10.5, color: colors.pencil },

  quote: { fontFamily: fonts.reading, fontSize: 13.5, lineHeight: 22, color: colors.ink },
  mark: { backgroundColor: colors.mark, color: colors.ink },
  markAlt: { backgroundColor: colors.blush, color: colors.ink },

  // A thought is the reader's own voice, not the author's — set in the
  // interface face so it does not masquerade as a quotation.
  thought: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.ink },

  empty: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.pencil,
    lineHeight: 19,
    paddingTop: 26,
  },
});
