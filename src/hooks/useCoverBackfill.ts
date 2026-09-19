import { useEffect, useRef } from "react";
import { useAppStore } from "../store";
import { resolveCoverUrl, updateBookCover } from "../lib/books";

// Open Library is a free, donation-funded service. Backfill politely: a few
// books per pass, one request at a time, with a pause between.
const PER_PASS = 6;
const GAP_MS = 700;

/**
 * Finds books saved without a cover and fills one in.
 *
 * A book ends up with no cover when the search result the reader picked had no
 * `cover_i` — common, because Open Library's title search is full of thin work
 * records that carry no artwork even when a real edition of the same book does.
 *
 * Results are written back to the row, so this is a one-time cost per book
 * rather than a lookup on every render. Books that genuinely have no cover
 * anywhere are remembered for the session so we stop asking about them.
 */
export function useCoverBackfill() {
  const userId = useAppStore((s) => s.userId);
  const books = useAppStore((s) => s.books);
  const updateBook = useAppStore((s) => s.updateBook);

  // Survives re-renders so a failed lookup is not retried in a loop.
  const attempted = useRef<Set<string>>(new Set());
  const running = useRef(false);

  useEffect(() => {
    if (!userId || running.current) return;

    const missing = books
      .filter((b) => !b.cover_url && !attempted.current.has(b.id))
      .slice(0, PER_PASS);
    if (missing.length === 0) return;

    running.current = true;
    let cancelled = false;

    (async () => {
      for (const book of missing) {
        if (cancelled) break;
        attempted.current.add(book.id);
        try {
          const url = await resolveCoverUrl(book.title, book.author);
          if (url && !cancelled) {
            await updateBookCover(book.id, url);
            updateBook({ ...book, cover_url: url });
          }
        } catch {
          // Leave the initials fallback in place; try again next launch.
        }
        if (!cancelled) await new Promise((r) => setTimeout(r, GAP_MS));
      }
      running.current = false;
    })();

    return () => {
      cancelled = true;
      running.current = false;
    };
  }, [userId, books, updateBook]);
}
