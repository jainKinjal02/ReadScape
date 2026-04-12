import { GoogleBook } from "../types";

const BASE_URL = "https://www.googleapis.com/books/v1/volumes";

export async function searchBooks(query: string): Promise<GoogleBook[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `${BASE_URL}?q=${encodeURIComponent(query)}&maxResults=15&printType=books`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as GoogleBook[];
}

export function getCoverUrl(book: GoogleBook): string | null {
  const links = book.volumeInfo.imageLinks;
  if (!links) return null;
  // Use HTTPS and request a larger size
  const url = links.thumbnail ?? links.smallThumbnail ?? null;
  return url ? url.replace("http://", "https://").replace("zoom=1", "zoom=2") : null;
}
