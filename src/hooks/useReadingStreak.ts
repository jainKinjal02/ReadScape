import { useEffect } from "react";
import { useAppStore } from "../store";
import { fetchMoodLogs } from "../lib/books";
import { computeStreak } from "../lib/streak";

// Derives the reading streak from real activity (logged sessions + finished
// books) and writes it into the store. Recomputes whenever the user's books
// change — e.g. after a session logs progress or a book is marked finished.
export function useReadingStreak() {
  const userId = useAppStore((s) => s.userId);
  const books = useAppStore((s) => s.books);
  const setStreak = useAppStore((s) => s.setStreak);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const logs = await fetchMoodLogs(userId);
        if (cancelled) return;
        const activity = [
          ...logs.map((l) => l.created_at),
          ...books.filter((b) => b.date_finished).map((b) => b.date_finished),
        ];
        setStreak(computeStreak(activity));
      } catch {
        // Non-fatal — leave the existing streak value in place
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, books, setStreak]);
}
