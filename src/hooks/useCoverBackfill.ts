import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store";
import { resolveCoverUrl, updateBookCover } from "../lib/books";

// Open Library is a free, donation-funded service. Backfill politely: a few
// books per pass, one request at a time, with a pause between.
const PER_PASS = 6;
const GAP_MS = 700;
const MAX_TRIES = 4;
const RETRY_MS = 15000;

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

  // Books settled this session: a cover found, or Open Library answered and
  // has none. Not retried. Books whose lookup failed (slow or unreachable,
  // common right after a big import) go in `failures` and are retried on
  // later passes, a few times, instead of waiting for the next launch.
  const attempted = useRef<Set<string>>(new Set());
  const failures = useRef<Map<string, number>>(new Map());
  const [retryTick, setRetryTick] = useState(0);
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
      let anyFailed = false;
      for (const book of missing) {
        if (cancelled) break;
        try {
          const url = await resolveCoverUrl(book.title, book.author);
          attempted.current.add(book.id);
          failures.current.delete(book.id);
          if (url && !cancelled) {
            await updateBookCover(book.id, url);
            updateBook({ ...book, cover_url: url });
          }
        } catch {
          const n = (failures.current.get(book.id) ?? 0) + 1;
          failures.current.set(book.id, n);
          if (n >= MAX_TRIES) attempted.current.add(book.id); // give up until next launch
          else anyFailed = true;
        }
        if (!cancelled) await new Promise((r) => setTimeout(r, GAP_MS));
      }
      running.current = false;
      // Come back for the ones that failed once Open Library has had a moment.
      if (anyFailed && !cancelled) setTimeout(() => setRetryTick((t) => t + 1), RETRY_MS);
    })();

    return () => {
      cancelled = true;
      running.current = false;
    };
  }, [userId, books, updateBook, retryTick]);
}
