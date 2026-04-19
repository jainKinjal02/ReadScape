import { useEffect, useCallback, useState } from "react";
import { useAppStore } from "../store";
import { fetchUserBooks } from "../lib/books";

export function useBooks() {
  const userId = useAppStore((s) => s.userId);
  const books = useAppStore((s) => s.books);
  const setBooks = useAppStore((s) => s.setBooks);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchUserBooks(userId);
      setBooks(data);
    } catch (e) {
      console.error("useBooks: fetch failed", e);
    } finally {
      setLoading(false);
    }
  }, [userId, setBooks]);

  useEffect(() => {
    if (userId) refresh();
  }, [userId, refresh]);

  return { books, loading, refresh };
}
