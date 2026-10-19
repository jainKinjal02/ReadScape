import { supabase } from "./supabase";
import { findInLibrary } from "./books";
import { Book, BookStatus, GoogleBook } from "../types";

/**
 * Importing a reader's Goodreads library.
 *
 * Goodreads closed its developer API in December 2020, so nothing can read or
 * write a Goodreads account directly. What every reading app does instead is
 * take the CSV that Goodreads exports (My Books -> Import and export ->
 * Export Library on goodreads.com). This turns that file into ReadScape books.
 */

export const GOODREADS_EXPORT_URL = "https://www.goodreads.com/review/import";

/** One book from the export, already mapped to ReadScape's terms. */
export interface GoodreadsBook {
  goodreadsId: string;
  title: string;
  author: string | null;
  status: BookStatus;
  rating: number | null;
  totalPages: number | null;
  dateFinished: string | null;
  dateAdded: string | null;
  shelves: string[];
  favorite: boolean;
  review: string | null;
}

/** A book already on the shelf that Goodreads now says something different about. */
export interface GoodreadsUpdate {
  book: Book;
  changes: Partial<Pick<Book, "status" | "rating" | "date_started" | "date_finished" | "current_page">>;
  /** For the summary, e.g. "Reading → Put down", "rated 4". */
  describe: string[];
}

export interface ImportPlan {
  toAdd: GoodreadsBook[];
  /** Already on the shelf, with changes from Goodreads to apply. */
  toUpdate: GoodreadsUpdate[];
  /** Already on the shelf and already the same. */
  alreadyInLibrary: GoodreadsBook[];
  /** Listed more than once in the export (two editions); only the first is added. */
  repeated: GoodreadsBook[];
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/**
 * RFC 4180 CSV: quoted fields may hold commas, line breaks (reviews often do)
 * and doubled quotes. Splitting on commas and newlines breaks on the first
 * multi-line review.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  // A UTF-8 byte-order mark would otherwise end up in the first header name.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

/** Thrown when the chosen file is not a Goodreads export. */
export class NotAGoodreadsExportError extends Error {
  constructor() {
    super("That file doesn't look like a Goodreads export.");
    this.name = "NotAGoodreadsExportError";
  }
}

const EXCLUSIVE: Record<string, BookStatus> = {
  read: "read",
  "currently-reading": "reading",
  "to-read": "want_to_read",
};

// Goodreads only has three built-in shelves; readers who stop a book make
// their own, under many names.
const ABANDONED = /\b(dnf|did-not-finish|abandon|gave-up|unfinished|stopped)/i;
const FAVORITE = /\bfavou?rites?\b/i;

/** Goodreads dates are "2024/03/15". */
function toIsoDate(value: string): string | null {
  const m = value.trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, 12)).toISOString();
}

/** "Mistborn: The Final Empire (Mistborn, #1)" -> "Mistborn: The Final Empire". */
function withoutSeries(title: string): string {
  return title.replace(/\s*\([^()]*#\s*\d+(\.\d+)?\)\s*$/, "").trim() || title.trim();
}

/** Reviews come as HTML fragments: <br/> for line breaks, the odd <i>. */
function reviewText(html: string): string | null {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

/** "science-fiction" -> "Science Fiction". */
function shelfName(shelf: string): string {
  return shelf
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function parseGoodreadsExport(text: string): GoodreadsBook[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new NotAGoodreadsExportError();

  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const idx = {
    id: col("Book Id"),
    title: col("Title"),
    author: col("Author"),
    rating: col("My Rating"),
    pages: col("Number of Pages"),
    dateRead: col("Date Read"),
    dateAdded: col("Date Added"),
    shelves: col("Bookshelves"),
    exclusive: col("Exclusive Shelf"),
    review: col("My Review"),
    privateNotes: col("Private Notes"),
  };
  if (idx.title < 0 || idx.exclusive < 0) throw new NotAGoodreadsExportError();

  const get = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

  return rows
    .filter((row) => get(row, idx.title))
    .map((row) => {
      const exclusive = get(row, idx.exclusive).toLowerCase();
      const status: BookStatus =
        EXCLUSIVE[exclusive] ?? (ABANDONED.test(exclusive) ? "abandoned" : "want_to_read");

      const shelves = get(row, idx.shelves)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && !(s in EXCLUSIVE) && s !== exclusive);
      const favorite = shelves.some((s) => FAVORITE.test(s));

      const rating = Number(get(row, idx.rating)) || 0;
      const pages = Number(get(row, idx.pages)) || 0;

      const notes = [reviewText(get(row, idx.review)), reviewText(get(row, idx.privateNotes))]
        .filter(Boolean)
        .join("\n\n");

      return {
        goodreadsId: get(row, idx.id),
        title: withoutSeries(get(row, idx.title)),
        author: get(row, idx.author) || null,
        status,
        rating: rating >= 1 && rating <= 5 ? rating : null,
        totalPages: pages > 0 ? pages : null,
        // Only a book Goodreads says was finished gets a finish date: a stray
        // date on a to-read book would put it in this year's stats.
        dateFinished: status === "read" ? toIsoDate(get(row, idx.dateRead)) : null,
        dateAdded: toIsoDate(get(row, idx.dateAdded)),
        shelves: shelves.filter((s) => !FAVORITE.test(s) && !ABANDONED.test(s)).map(shelfName),
        favorite,
        review: notes || null,
      };
    });
}

// ─── Planning and importing ──────────────────────────────────────────────────

const goodreadsKey = (id: string) => `goodreads:${id}`;

/**
 * Splits the export into books to add and books already on the shelf, by
 * Goodreads id (a previous import) or by title and author (added by hand).
 * Importing the same file twice therefore adds nothing the second time.
 */
export function planImport(books: GoodreadsBook[], library: Book[]): ImportPlan {
  const plan: ImportPlan = { toAdd: [], toUpdate: [], alreadyInLibrary: [], repeated: [] };
  const seen = new Set<string>();

  for (const gb of books) {
    const asResult: GoogleBook = {
      id: goodreadsKey(gb.goodreadsId),
      volumeInfo: { title: gb.title, authors: gb.author ? [gb.author] : [] },
    };
    // Goodreads can list the same title twice (two editions); keep the first.
    const dupKey = `${gb.title.toLowerCase()}|${(gb.author ?? "").toLowerCase()}`;
    const existing = findInLibrary(library, asResult);
    if (existing) {
      const update = diffFromGoodreads(existing, gb);
      if (update) plan.toUpdate.push(update);
      else plan.alreadyInLibrary.push(gb);
    } else if (seen.has(dupKey)) {
      plan.repeated.push(gb);
    } else {
      seen.add(dupKey);
      plan.toAdd.push(gb);
    }
  }
  return plan;
}

const STATUS_WORDS: Record<BookStatus, string> = {
  want_to_read: "Want to read",
  reading: "Reading",
  read: "Read",
  abandoned: "Put down",
};

/** "23 Aug 2026" (UTC, matching how Goodreads dates are stored). */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * What Goodreads says that the shelf doesn't, for a book already there.
 *
 * Importing again is how a reader who still uses Goodreads keeps Readscape in
 * step, so the shelf, rating and finish date follow Goodreads. Only what
 * Goodreads actually records is applied: an unrated book on Goodreads leaves
 * a Readscape rating alone, and a missing read date doesn't erase one.
 */
export function diffFromGoodreads(book: Book, gb: GoodreadsBook): GoodreadsUpdate | null {
  const changes: GoodreadsUpdate["changes"] = {};
  const describe: string[] = [];

  if (gb.status !== book.status) {
    changes.status = gb.status;
    describe.push(`${STATUS_WORDS[book.status]} → ${STATUS_WORDS[gb.status]}`);
    if (gb.status === "reading" && !book.date_started) changes.date_started = new Date().toISOString();
    if (gb.status !== "read" && book.date_finished) changes.date_finished = null;
    if (gb.status === "read" && book.total_pages) changes.current_page = book.total_pages;
  }
  if (gb.status === "read" && gb.dateFinished) {
    const same =
      book.date_finished && book.date_finished.slice(0, 10) === gb.dateFinished.slice(0, 10);
    if (!same) {
      changes.date_finished = gb.dateFinished;
      describe.push(`finished ${shortDate(gb.dateFinished)}`);
    }
  }
  if (gb.rating != null && gb.rating !== (book.rating == null ? null : Number(book.rating))) {
    changes.rating = gb.rating;
    describe.push(`rated ${gb.rating}`);
  }

  return Object.keys(changes).length > 0 ? { book, changes, describe } : null;
}

/** Apply the planned updates. Returns the books as they now are. */
export async function applyGoodreadsUpdates(updates: GoodreadsUpdate[]): Promise<Book[]> {
  const out: Book[] = [];
  for (const u of updates) {
    const { error } = await supabase.from("books").update(u.changes).eq("id", u.book.id);
    if (error) throw error;
    out.push({ ...u.book, ...u.changes } as Book);
  }
  return out;
}

const BATCH = 100;

/**
 * Adds the planned books, and a note holding each one's Goodreads review.
 * Batched so a 1,000-book library is a handful of requests, not a thousand.
 * Covers are left empty: the library's cover backfill finds them a few at a
 * time, which keeps a big import from hammering Open Library.
 */
export async function importGoodreadsBooks(
  userId: string,
  books: GoodreadsBook[],
  onProgress?: (done: number, total: number) => void
): Promise<Book[]> {
  const added: Book[] = [];

  for (let i = 0; i < books.length; i += BATCH) {
    const chunk = books.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("books")
      .insert(
        chunk.map((b) => ({
          user_id: userId,
          title: b.title,
          author: b.author,
          cover_url: null,
          genre: b.shelves,
          status: b.status,
          total_pages: b.totalPages,
          current_page: b.status === "read" && b.totalPages ? b.totalPages : 0,
          rating: b.rating,
          google_books_id: goodreadsKey(b.goodreadsId),
          is_favorite: b.favorite,
          date_finished: b.dateFinished,
          ...(b.dateAdded && { date_added: b.dateAdded }),
        }))
      )
      .select();
    if (error) throw error;

    const rows = (data ?? []) as Book[];
    added.push(...rows);

    const byKey = new Map(rows.map((r) => [r.google_books_id, r.id]));
    const notes = chunk
      .filter((b) => b.review && byKey.has(goodreadsKey(b.goodreadsId)))
      .map((b) => ({
        user_id: userId,
        book_id: byKey.get(goodreadsKey(b.goodreadsId))!,
        text: b.review!,
      }));
    if (notes.length > 0) {
      const { error: notesError } = await supabase.from("notes").insert(notes);
      if (notesError) throw notesError;
    }

    onProgress?.(Math.min(i + BATCH, books.length), books.length);
  }

  return added;
}
