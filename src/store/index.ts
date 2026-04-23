import { create } from "zustand";
import { Book, MoodLog } from "../types";

interface AppState {
  // Auth
  userId: string | null;
  setUserId: (id: string | null) => void;

  userName: string;
  setUserName: (name: string) => void;

  readingGoal: number;
  setReadingGoal: (goal: number) => void;

  userBio: string;
  setUserBio: (bio: string) => void;

  // Books
  books: Book[];
  setBooks: (books: Book[]) => void;
  updateBook: (book: Book) => void;
  removeBook: (bookId: string) => void;

  // Currently reading (derived: first book with status 'reading')
  currentlyReadingId: string | null;
  setCurrentlyReadingId: (id: string | null) => void;

  // Recent moods (for home dashboard)
  recentMoods: MoodLog[];
  setRecentMoods: (moods: MoodLog[]) => void;

  // Reading streak
  streak: number;
  setStreak: (streak: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userId: null,
  setUserId: (id) => set({ userId: id }),

  userName: "",
  setUserName: (name) => set({ userName: name }),

  readingGoal: 0,
  setReadingGoal: (goal) => set({ readingGoal: goal }),

  userBio: "",
  setUserBio: (bio) => set({ userBio: bio }),

  books: [],
  setBooks: (books) => set({ books }),
  updateBook: (book) =>
    set((state) => ({
      books: state.books.map((b) => (b.id === book.id ? book : b)),
    })),
  removeBook: (bookId) =>
    set((state) => ({
      books: state.books.filter((b) => b.id !== bookId),
    })),

  currentlyReadingId: null,
  setCurrentlyReadingId: (id) => set({ currentlyReadingId: id }),

  recentMoods: [],
  setRecentMoods: (moods) => set({ recentMoods: moods }),

  streak: 0,
  setStreak: (streak) => set({ streak }),
}));
