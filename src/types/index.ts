export type BookStatus = "reading" | "read" | "want_to_read" | "abandoned";

export type Mood =
  | "loving_it"
  | "getting_into_it"
  | "struggling"
  | "taking_a_break"
  | "finished";

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  genre: string[];
  status: BookStatus;
  total_pages: number | null;
  current_page: number;
  rating: number | null;
  is_favorite: boolean;
  synopsis: string | null;
  google_books_id: string | null;
  date_added: string;
  date_started: string | null;
  date_finished: string | null;
}

export interface MoodLog {
  id: string;
  user_id: string;
  book_id: string;
  page: number | null;
  mood: Mood;
  note: string | null;
  session_duration_mins: number | null;
  created_at: string;
}

export interface Quote {
  id: string;
  user_id: string;
  book_id: string;
  text: string;
  page: number | null;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  book_id: string;
  text: string;
  created_at: string;
}

export interface Photo {
  id: string;
  user_id: string;
  book_id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

export interface GoogleBook {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
}
