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

// ─── Google Books API ─────────────────────────────────────────────────────────

export async function searchGoogleBooks(query: string): Promise<GoogleBook[]> {
  if (!query.trim()) return [];
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
    query
  )}&maxResults=15&langRestrict=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Google Books request failed");
  const json = await res.json();
  return (json.items ?? []) as GoogleBook[];
}

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
