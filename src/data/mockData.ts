// ─── Static mock data — remove when wiring real Supabase ───────────────────

export const CURRENT_USER = {
  name: "Krish",
  initials: "K",
  streak: 7,
  readingGoal: 20,
};

export const CURRENT_BOOK = {
  id: "1",
  title: "The Midnight Library",
  author: "Matt Haig",
  cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1602190252i/52578297.jpg",
  currentPage: 186,
  totalPages: 304,
  progress: 62,
  status: "reading",
  genre: ["Fiction", "Philosophy"],
  year: "2020",
  rating: 4,
  synopsis:
    "Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived. To see how things would be if you had made other choices. Would you have done anything different, if you had the chance to undo your regrets?",
  lastMood: { symbol: "✦", label: "Curious", color: "#a85e3e" },
  note: "A beautifully written exploration of regret and possibility. Nora's journey feels deeply personal.",
};

export const STATS = {
  booksRead: 12,
  pagesThisYear: 2847,
  quotesSaved: 38,
  streak: 7,
};

export const WANT_TO_READ = [
  {
    id: "2",
    title: "Atomic Habits",
    author: "James Clear",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1655988385i/40121378.jpg",
  },
  {
    id: "3",
    title: "Dune",
    author: "Frank Herbert",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1555447414i/44767458.jpg",
  },
  {
    id: "4",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1562784585i/23692271.jpg",
  },
  {
    id: "5",
    title: "Normal People",
    author: "Sally Rooney",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1571423190i/41057294.jpg",
  },
];

export const LIBRARY_BOOKS = [
  {
    id: "1",
    title: "The Midnight Library",
    author: "Matt Haig",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1602190252i/52578297.jpg",
    status: "reading",
  },
  {
    id: "6",
    title: "1984",
    author: "George Orwell",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1348990566i/5470.jpg",
    status: "read",
  },
  {
    id: "7",
    title: "Pride & Prejudice",
    author: "Jane Austen",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1320399351i/1885.jpg",
    status: "read",
  },
  {
    id: "2",
    title: "Atomic Habits",
    author: "James Clear",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1655988385i/40121378.jpg",
    status: "want_to_read",
  },
  {
    id: "8",
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1546071216i/5907.jpg",
    status: "read",
  },
  {
    id: "9",
    title: "Immortals of Meluha",
    author: "Amish Tripathi",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1388186168i/7913305.jpg",
    status: "read",
  },
  {
    id: "10",
    title: "Norwegian Wood",
    author: "Haruki Murakami",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1292401605i/11297.jpg",
    status: "read",
  },
  {
    id: "4",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1562784585i/23692271.jpg",
    status: "want_to_read",
  },
];

export const SAMPLE_QUOTES = [
  {
    id: "q1",
    text: "You don't have to understand life. You just have to live it.",
    page: 89,
    chapter: "Chapter 7",
  },
  {
    id: "q2",
    text: "She was not afraid of the dark. She was afraid of what the dark might contain.",
    page: 134,
    chapter: "Chapter 12",
  },
  {
    id: "q3",
    text: "It is never too late to be what you might have been.",
    page: 167,
    chapter: "Chapter 15",
  },
];

export const SAMPLE_NOTES = [
  {
    id: "n1",
    text: "A beautifully written exploration of regret and possibility. Nora's journey feels deeply personal.",
    date: "Apr 8",
  },
  {
    id: "n2",
    text: "The Midnight Library is a metaphor for the mind — all the lives we imagine but never lead.",
    date: "Apr 10",
  },
];

export const MOOD_ARC = [
  { chapter: "Ch1", score: 2, color: "#c9bdb5" },
  { chapter: "Ch3", score: 3, color: "#7a9e7e" },
  { chapter: "Ch5", score: 4, color: "#7a9e7e" },
  { chapter: "Ch7", score: 3, color: "#c97c5a" },
  { chapter: "Ch9", score: 4, color: "#c97c5a" },
  { chapter: "Ch11", score: 5, color: "#a85e3e" },
  { chapter: "Ch13", score: 5, color: "#a85e3e" },
  { chapter: "Now", score: 4, color: "#c97c5a" },
];

export const GENRE_STATS = [
  { name: "Fiction",   pct: 75, count: 6, color: "#c97c5a" },
  { name: "Self-help", pct: 38, count: 3, color: "#7a9e7e" },
  { name: "Fantasy",   pct: 25, count: 2, color: "#8b6a4a" },
  { name: "Dystopian", pct: 12, count: 1, color: "#4a3728" },
];

export const AI_MESSAGES = [
  {
    id: "1",
    role: "assistant" as const,
    text: "Hi! I know you're on page 186 of The Midnight Library and feeling curious. What's on your mind?",
  },
  {
    id: "2",
    role: "user" as const,
    text: 'What does "apocryphal" mean? Nora just used it',
  },
  {
    id: "3",
    role: "assistant" as const,
    text: "Great word to notice!\n\napocryphal (Greek · apókryphos — \"hidden, obscure\")\n\nA story widely told but likely untrue — too perfect to be real. Haig uses it to hint that Nora's memory may be one she's constructed rather than lived.",
  },
];

export const AI_RECOMMENDATIONS = [
  {
    id: "r1",
    title: "A Man Called Ove",
    author: "Fredrik Backman",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1388186168i/8490112.jpg",
    reason: "Same quiet grief and unexpected warmth as Midnight Library",
  },
  {
    id: "r2",
    title: "Normal People",
    author: "Sally Rooney",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1571423190i/41057294.jpg",
    reason: "Matches your \"moved\" and \"curious\" mood patterns",
  },
  {
    id: "r3",
    title: "The House in the Cerulean Sea",
    author: "TJ Klune",
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1603742694i/52578297.jpg",
    reason: "Cozy, meaningful — fits your weekend reading mood",
  },
];
