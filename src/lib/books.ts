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

// ─── Open Library API (replaces Google Books — no key, always free) ──────────
// Docs: https://openlibrary.org/dev/docs/api

export async function searchBooks(query: string): Promise<GoogleBook[]> {
  if (!query.trim()) return [];
  const url =
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}` +
    `&limit=20&fields=key,title,author_name,cover_i,number_of_pages_median,subject`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Library returned ${res.status}`);
  const json = await res.json();
  return (json.docs ?? []).map(mapOpenLibraryDoc).filter((b: GoogleBook) => b.volumeInfo.title);
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
