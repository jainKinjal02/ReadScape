import { supabase } from "./supabase";
import { Book, BookStatus, GoogleBook } from "../types";

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

export async function addBookToLibrary(
  userId: string,
  googleBook: GoogleBook,
  status: BookStatus = "want_to_read"
): Promise<Book> {
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
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBookStatus(
  bookId: string,
  status: BookStatus
): Promise<void> {
  const { error } = await supabase
    .from("books")
    .update({ status })
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
  text: string
): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: userId, book_id: bookId, text })
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

export async function searchBooks(query: string): Promise<GoogleBook[]> {
  if (!query.trim()) return [];
  const fields = "key,title,author_name,cover_i,number_of_pages_median,subject";

  // Title-specific search gives the most accurate results for book names
  const titleUrl =
    `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}` +
    `&fields=${fields}&limit=20`;

  const res = await fetch(titleUrl);
  if (!res.ok) throw new Error(`Open Library returned ${res.status}`);
  const json = await res.json();
  let docs: any[] = json.docs ?? [];

  // If title search gives fewer than 4 hits the user might be searching by author —
  // run a general search and merge in any new results.
  if (docs.length < 4) {
    try {
      const generalRes = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=${fields}&limit=15`
      );
      if (generalRes.ok) {
        const generalJson = await generalRes.json();
        const existing = new Set(docs.map((d: any) => d.key));
        const extra = (generalJson.docs ?? []).filter((d: any) => !existing.has(d.key));
        docs = [...docs, ...extra];
      }
    } catch {
      // General search is best-effort — ignore failures
    }
  }

  return docs.map(mapOpenLibraryDoc).filter((b: GoogleBook) => b.volumeInfo.title);
}

function mapOpenLibraryDoc(doc: any): GoogleBook {
  const coverId = doc.cover_i;
  return {
    id: doc.key ?? String(Math.random()),
    volumeInfo: {
      title: doc.title ?? "Unknown title",
      authors: doc.author_name ?? [],
      pageCount: doc.number_of_pages_median ?? null,
      categories: doc.subject?.slice(0, 8) ?? [],
      description: null,
      imageLinks: coverId
        ? {
            thumbnail: `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`,
            smallThumbnail: `https://covers.openlibrary.org/b/id/${coverId}-S.jpg`,
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
