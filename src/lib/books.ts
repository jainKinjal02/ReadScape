import { supabase } from "./supabase";
import { Book, BookStatus, GoogleBook, Mood, MoodLog } from "../types";

// ─── Supabase ────────────────────────────────────────────────────────────────

export async function fetchUserBooks(userId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .order("date_added", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Thrown when a book is already in the reader's library. Carries that copy. */
export class AlreadyInLibraryError extends Error {
  constructor(public book: Book) {
    super(`"${book.title}" is already in your library.`);
    this.name = "AlreadyInLibraryError";
  }
}

/**
 * The reader's existing copy of a search result, if they have one.
 *
 * One book is one entry: it moves Want -> Reading -> Read rather than being
 * added again for each status. Matched by catalogue id, or failing that by
 * title and author, because the same book turns up under several catalogue
 * entries (editions, translations) and adding a second edition of a book
 * already on the shelf is the duplicate a reader actually runs into.
 */
export function findInLibrary(books: Book[], result: GoogleBook): Book | null {
  const byId = books.find((b) => b.google_books_id && b.google_books_id === result.id);
  if (byId) return byId;

  const title = normalise(result.volumeInfo.title ?? "");
  if (!title) return null;
  const wantAuthor = tokens((result.volumeInfo.authors ?? []).join(" "));

  return (
    books.find((b) => {
      if (normalise(b.title) !== title) return false;
      const gotAuthor = tokens(b.author ?? "");
      // Same title and no author on one side is still the same book often
      // enough; same title with different authors is not.
      if (wantAuthor.size === 0 || gotAuthor.size === 0) return true;
      return [...wantAuthor].some((t) => gotAuthor.has(t));
    }) ?? null
  );
}

/**
 * The fields to write when a book moves to `status`, given where it is now.
 *
 * Dates record what actually happened in the app: starting to read stamps the
 * start, finishing stamps the finish. A book added straight to Read gets no
 * finish date, because it may have been read years ago and today's date would
 * put it in this year's stats and this week's streak. Moving a book back out
 * of Read clears its finish date, so a mis-tap doesn't count as finishing.
 */
export function statusChange(
  book: Pick<Book, "date_started" | "date_finished">,
  status: BookStatus
): Pick<Book, "status"> & Partial<Pick<Book, "date_started" | "date_finished">> {
  const now = new Date().toISOString();
  const patch: Pick<Book, "status"> & Partial<Pick<Book, "date_started" | "date_finished">> = { status };
  if (status === "reading" && !book.date_started) patch.date_started = now;
  if (status === "read" && !book.date_finished) patch.date_finished = now;
  if (status !== "read" && book.date_finished) patch.date_finished = null;
  return patch;
}

export async function addBookToLibrary(
  userId: string,
  googleBook: GoogleBook,
  status: BookStatus = "want_to_read"
): Promise<Book> {
  // The screen checks its own copy of the library first; this catches the
  // same book added from another device, or from a screen that is out of date.
  const { data: existing, error: existingError } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .eq("google_books_id", googleBook.id)
    .limit(1);
  if (existingError) throw existingError;
  if (existing?.[0]) throw new AlreadyInLibraryError(existing[0]);

  const info = googleBook.volumeInfo;
  // Google Books sometimes returns http — force https
  const cover =
    (info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null)
      ?.replace("http://", "https://") ?? null;

  const { data, error } = await supabase
    .from("books")
    .insert({
      user_id: userId,
      title: info.title,
      author: info.authors?.join(", ") ?? null,
      cover_url: cover,
      genre: mapGenres(info.categories ?? []),
      status,
      total_pages: info.pageCount ?? null,
      current_page: 0,
      synopsis: info.description ?? null,
      google_books_id: googleBook.id,
      date_started: status === "reading" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBook(bookId: string): Promise<void> {
  const { error } = await supabase.from("books").delete().eq("id", bookId);
  if (error) throw error;
}

export async function toggleFavorite(bookId: string, isFavorite: boolean): Promise<void> {
  const { error } = await supabase
    .from("books")
    .update({ is_favorite: isFavorite })
    .eq("id", bookId);
  if (error) throw error;
}

export async function updateBookStatus(
  bookId: string,
  change: ReturnType<typeof statusChange>
): Promise<void> {
  const { error } = await supabase
    .from("books")
    .update(change)
    .eq("id", bookId);
  if (error) throw error;
}

export async function updateBookGenre(
  bookId: string,
  genre: string[]
): Promise<void> {
  const { error } = await supabase
    .from("books")
    .update({ genre })
    .eq("id", bookId);
  if (error) throw error;
}

export async function updateBookRating(
  bookId: string,
  rating: number
): Promise<void> {
  const { error } = await supabase
    .from("books")
    .update({ rating })
    .eq("id", bookId);
  if (error) throw error;
}

export async function updateCurrentPage(
  bookId: string,
  page: number
): Promise<void> {
  const { error } = await supabase
    .from("books")
    .update({ current_page: page })
    .eq("id", bookId);
  if (error) throw error;
}

export async function markBookFinished(
  bookId: string,
  totalPages: number
): Promise<void> {
  const { error } = await supabase
    .from("books")
    .update({
      status: "read",
      current_page: totalPages,
      date_finished: new Date().toISOString(),
    })
    .eq("id", bookId);
  if (error) throw error;
}

// ─── Mood logs ─────────────────────────────────────────────────────────────

export async function fetchMoodLogs(userId: string): Promise<MoodLog[]> {
  const { data, error } = await supabase
    .from("mood_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function logMood(
  userId: string,
  bookId: string,
  mood: Mood,
  page: number | null = null,
  note: string | null = null
): Promise<void> {
  const { error } = await supabase
    .from("mood_logs")
    .insert({ user_id: userId, book_id: bookId, mood, page, note });
  if (error) throw error;
}

// ─── Quotes ──────────────────────────────────────────────────────────────────

import { Quote, Note } from "../types";

export async function fetchQuotes(bookId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Everything the reader has kept, across every book. The per-book fetchers
// above power the book screen; these power the Notes tab.
export async function fetchAllQuotes(userId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllNotes(userId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addQuote(
  userId: string,
  bookId: string,
  text: string,
  page: number | null = null
): Promise<Quote> {
  const { data, error } = await supabase
    .from("quotes")
    .insert({ user_id: userId, book_id: bookId, text, page })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteQuote(quoteId: string): Promise<void> {
  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
  if (error) throw error;
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export async function fetchNotes(bookId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addNote(
  userId: string,
  bookId: string,
  text: string,
  audio: { path: string; durationMs: number } | null = null
): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      book_id: bookId,
      text,
      ...(audio && { audio_path: audio.path, duration_ms: audio.durationMs }),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) throw error;
}

// ─── Open Library API (replaces Google Books — no key, always free) ──────────
// Docs: https://openlibrary.org/dev/docs/api

export type CoverSize = "S" | "M" | "L";

export function coverUrl(coverId: number | string, size: CoverSize = "L"): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg?default=false`;
}

/**
 * fetch with a deadline. Open Library is usually quick but occasionally
 * stalls, and without this the search spinner runs forever with no way out.
 * AbortController rather than AbortSignal.timeout, which Hermes does not
 * reliably provide.
 */
async function fetchWithTimeout(url: string, ms = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
const tokens = (s: string) => new Set(normalise(s).split(/\s+/).filter(Boolean));

/**
 * Find a cover for a book that has none.
 *
 * Open Library's `title=` search fragments across a lot of thin work records —
 * summaries, study guides, editions with no artwork — and the exact-title match
 * frequently has no cover at all while a real edition does. A general `q=`
 * search surfaces the editions that actually have artwork.
 *
 * The match guard matters more than the query. Taking the first result with a
 * cover turns "Lost Lambs" into "Little lost lamb" by Margaret Wise Brown —
 * and a confidently wrong cover is worse than no cover. So:
 *   - if we know the author, the author must match
 *   - if we do not, the titles must contain one another
 *
 * Returns null rather than guessing.
 */
export async function resolveCoverUrl(
  title: string,
  author?: string | null
): Promise<string | null> {
  if (!title.trim()) return null;

  const query = [title, author ?? ""].join(" ").trim();
  const url =
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}` +
    `&fields=title,author_name,cover_i&limit=10`;

  let docs: any[] = [];
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    docs = (await res.json())?.docs ?? [];
  } catch {
    return null;
  }

  const wantTitle = tokens(title);
  const wantAuthor = tokens(author ?? "");

  for (const doc of docs) {
    if (!doc?.cover_i) continue;

    if (wantAuthor.size > 0) {
      const gotAuthor = tokens((doc.author_name ?? []).join(" "));
      if (![...wantAuthor].some((t) => gotAuthor.has(t))) continue;
      return coverUrl(doc.cover_i, "L");
    }

    const gotTitle = tokens(doc.title ?? "");
    const contains = (a: Set<string>, b: Set<string>) => [...a].every((t) => b.has(t));
    if (wantTitle.size > 0 && (contains(wantTitle, gotTitle) || contains(gotTitle, wantTitle))) {
      return coverUrl(doc.cover_i, "L");
    }
  }

  return null;
}

/**
 * Several covers for the same book, to choose between.
 *
 * Open Library exposes covers two ways and they disagree:
 *   /b/id/{cover_i}      the work's representative cover, picked by Open
 *                        Library — often the original-language edition
 *   /b/isbn/{isbn}       one specific edition
 *
 * For "Butter" those give the Japanese artwork and the English artwork
 * respectively, and even the ISBN-10 and ISBN-13 of the same edition return
 * different images. There is no rule that reliably picks the one a reader
 * means, so offer the options rather than guess at them.
 */
export async function resolveCoverCandidates(
  title: string,
  author?: string | null,
  limit = 8
): Promise<string[]> {
  if (!title.trim()) return [];

  const query = [title, author ?? ""].join(" ").trim();
  const url =
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}` +
    `&fields=title,author_name,cover_i,isbn&limit=10`;

  let docs: any[] = [];
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    docs = (await res.json())?.docs ?? [];
  } catch {
    return [];
  }

  const wantTitle = tokens(title);
  const wantAuthor = tokens(author ?? "");
  const out: string[] = [];

  const matches = (doc: any) => {
    if (wantAuthor.size > 0) {
      const gotAuthor = tokens((doc.author_name ?? []).join(" "));
      return [...wantAuthor].some((t) => gotAuthor.has(t));
    }
    const gotTitle = tokens(doc.title ?? "");
    const contains = (a: Set<string>, b: Set<string>) => [...a].every((t) => b.has(t));
    return wantTitle.size > 0 && (contains(wantTitle, gotTitle) || contains(gotTitle, wantTitle));
  };

  for (const doc of docs) {
    if (!matches(doc)) continue;
    if (doc.cover_i) out.push(coverUrl(doc.cover_i, "L"));
    // A handful of editions per work is plenty; the list is for choosing
    // from, not for browsing every printing ever made.
    for (const isbn of (doc.isbn ?? []).slice(0, 4)) {
      out.push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`);
    }
    if (out.length >= limit) break;
  }

  return [...new Set(out)].slice(0, limit);
}

export async function updateBookCover(bookId: string, coverUrl: string): Promise<void> {
  const { error } = await supabase
    .from("books")
    .update({ cover_url: coverUrl })
    .eq("id", bookId);
  if (error) throw error;
}

// Letters outside the Latin alphabets (Hangul, kana, kanji, Cyrillic, …).
const NON_LATIN = /[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\s]/;

export async function searchBooks(query: string): Promise<GoogleBook[]> {
  if (!query.trim()) return [];

  // A general search, not a title-only one. Title search returns matches in
  // no useful order: "The Vegetarian" gave three cookbooks before Han Kang's
  // novel, which did not appear at all, and "1984" buried Orwell. General
  // search ranks by relevance and also finds books by their author's name.
  //
  // It reports each work under its original-language title (채식주의자, バター),
  // so `lang=en` plus the editions fields fetch the best English edition. Its
  // title is only used when the work's own title is in another script: an
  // edition title is one printing's spelling ("Pride & Prejudice", "Nineteen
  // eighty-four"), while the work title is the book's usual name.
  const fields = [
    "key", "title", "author_name", "cover_i", "number_of_pages_median", "subject",
    "editions", "editions.title", "editions.cover_i",
  ].join(",");
  const url =
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}` +
    `&lang=en&fields=${fields}&limit=20`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Open Library returned ${res.status}`);
  const json = await res.json();

  return (json.docs ?? [])
    .map((doc: any) => {
      const edition = doc.editions?.docs?.[0];
      const foreign = typeof doc.title === "string" && NON_LATIN.test(doc.title);
      if (!foreign || !edition?.title) return mapOpenLibraryDoc(doc);
      // The English edition's cover too: the work's representative cover is
      // usually the original-language artwork.
      return mapOpenLibraryDoc({
        ...doc,
        title: edition.title,
        cover_i: edition.cover_i ?? doc.cover_i,
      });
    })
    .filter((b: GoogleBook) => b.volumeInfo.title);
}

function mapOpenLibraryDoc(doc: any): GoogleBook {
  const coverId = doc.cover_i;
  return {
    id: doc.key ?? String(Math.random()),
    volumeInfo: {
      title: doc.title ?? "Unknown title",
      authors: doc.author_name ?? [],
      pageCount: doc.number_of_pages_median ?? undefined,
      categories: doc.subject?.slice(0, 8) ?? [],
      // Open Library's search endpoint does not return descriptions; the
      // field is optional, so leave it absent rather than explicitly null.
      description: undefined,
      imageLinks: coverId
        ? {
            // -L (~500px), not -M (~180px): a 122pt hero cover on a 3x screen
            // needs ~366px, so -M was always being upscaled.
            //
            // default=false matters more than it looks. Without it Open Library
            // answers 200 with a blank placeholder image for books it has no
            // cover for, so onError never fires and the reader sees an empty
            // rectangle instead of the title-initials fallback. With it, the
            // request 404s and the fallback does its job.
            thumbnail: coverUrl(coverId, "L"),
            smallThumbnail: coverUrl(coverId, "M"),
          }
        : undefined,
    },
  };
}

// Keep old name as alias so nothing else breaks if referenced elsewhere
export const searchGoogleBooks = searchBooks;

// ─── Genre mapping ────────────────────────────────────────────────────────────

const GENRE_MAP: [string, string][] = [
  ["fantasy", "Fantasy"],
  ["science fiction", "Sci-Fi"],
  ["sci-fi", "Sci-Fi"],
  ["thriller", "Thriller"],
  ["mystery", "Thriller"],
  ["suspense", "Thriller"],
  ["horror", "Horror"],
  ["romance", "Romance"],
  ["love stories", "Romance"],
  ["self-help", "Self-Help"],
  ["self help", "Self-Help"],
  ["personal development", "Self-Help"],
  ["motivational", "Self-Help"],
  ["history", "History"],
  ["historical", "History"],
  ["biography", "Biography"],
  ["autobiography", "Biography"],
  ["memoir", "Biography"],
  ["dystopian", "Dystopian"],
  ["dystopia", "Dystopian"],
  ["fiction", "Fiction"],
];

function mapGenres(categories: string[]): string[] {
  const mapped = new Set<string>();
  const lower = categories.map((c) => c.toLowerCase());
  for (const [keyword, genre] of GENRE_MAP) {
    if (lower.some((c) => c.includes(keyword))) mapped.add(genre);
  }
  return mapped.size > 0 ? Array.from(mapped) : ["Fiction"];
}
