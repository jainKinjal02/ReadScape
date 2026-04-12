# ReadScape — App Plan & Architecture

> A personal reading tracker that treats reading as an emotional journey, not a task list.
> The core differentiator: **Mood Arc** — a chart showing how your feelings about a book changed page by page.

---

## Vision

Most reading apps (Goodreads, StoryGraph) treat books like items on a to-do list. ReadScape is different — it's a reading *journal*. Every time you pick up a book, you log how you're feeling. Over time, your Mood Arc shows you the emotional journey of the story as you experienced it. That's something nobody else does.

---

## Theme — Soft Linen

Clean, minimal, Muji-like. Books are the visual star.

| Token | Value | Notes |
|---|---|---|
| `bgPrimary` | `#F7F4EF` | Off-white linen background |
| `bgCard` | `#FFFFFF` | Card surfaces |
| `bgSurface` | `#EDEAE4` | Subtle grey for chips/bars |
| `inkPrimary` | `#2D2D2D` | Charcoal text |
| `inkMuted` | `#7A7A7A` | Secondary text |
| `roseAccent` | `#C4899A` | Dusty rose — primary accent |
| `roseSoft` | `#E8C5CF` | Soft blush — selected states |

---

## Tech Stack

| Layer | Tech | Why |
|---|---|---|
| Framework | React Native + Expo (managed) | Single codebase for iOS + Android. No Xcode/Android Studio needed during dev. |
| Navigation | Expo Router (file-based) | Same mental model as Next.js — files in `app/` = routes. |
| Styling | NativeWind v4 | Tailwind class names on RN components. No StyleSheet boilerplate. |
| Animations | React Native Reanimated + Moti | 60fps animations on the UI thread. Moti API is similar to Framer Motion. |
| Backend + DB | Supabase | Postgres + Auth + Storage + Edge Functions. No server to manage. |
| State | Zustand | Lightweight global state. Simpler than Redux. |
| Book Data | Google Books API | Free cover images + metadata. No API key needed for basic search. |
| AI | Anthropic Claude API via Supabase Edge Function | API key lives server-side only — never in the app bundle. |
| Photos | expo-image-picker + Supabase Storage | Camera/gallery access. S3-compatible object storage. |
| Auth tokens | expo-secure-store | iOS Keychain / Android Keystore — encrypted. Never AsyncStorage for tokens. |
| Fonts | Playfair Display via @expo-google-fonts | Serif font for literary feel. |

---

## Architecture

```
Mobile App (React Native + Expo)
    │
    ├── Google Books API   (direct call — free, no key)
    │
    └── Supabase
          ├── Auth          (signup, login, session tokens in Keychain)
          ├── PostgreSQL     (all user data with RLS)
          ├── Storage        (book photos)
          └── Edge Functions
                └── ai-companion  ──► Anthropic Claude API
```

**Why Supabase instead of local storage?**
LocalStorage doesn't exist in React Native. AsyncStorage does, but it's unencrypted and device-local. Supabase gives cloud sync across devices + Row Level Security (RLS) that enforces data isolation at the database level.

**Why Edge Function for AI?**
The Anthropic API key must never ship inside the app bundle — anyone can extract strings from a compiled binary. The Edge Function keeps the key server-side.

---

## 8 Screens

### 1. Landing (`app/index.tsx`)
- Cycling atmospheric book photography (crossfade every 4.5s)
- Scrolling book shelf with Open Library covers
- Hero text, CTA → Onboarding
- Redirects to Home if already logged in

### 2. Onboarding (`app/onboarding.tsx`)
- Step 1: Email + password (Supabase Auth signUp/signIn)
- Step 2: Name + reading goal (books per year)
- Step 3: Favorite genres (multi-select chips)
- Creates `user_profiles` row on completion

### 3. Home Dashboard (`app/(tabs)/home.tsx`)
- Currently Reading card with progress bar + last mood
- Quick mood picker (5 chips) → writes to `mood_logs`
- Reading streak counter (calculated from daily mood logs)
- Stats: books this year, streak, want-to-read count
- Want to Read horizontal shelf
- "Continue Reading" → Reading Session

### 4. Library (`app/(tabs)/library.tsx`)
- Cover-first 3-column grid
- Filter tabs: All / Reading / Read / Want to Read / Abandoned
- Search bar (filters locally by title/author)
- "Add Book" → Google Books search modal → adds to Supabase

### 5. Reading Session (`app/session/[id].tsx`) ← emotional core
- Blurred book cover background (expo-blur)
- Current page input
- 5 mood options (including "Finished!")
- Optional note ("what's on your mind?")
- Quote capture with page number
- Save → writes mood_log, updates book.current_page

### 6. Book Detail (`app/book/[id].tsx`)
- Hero with book cover gradient
- 4 tabs: Overview / Notes / Quotes / Mood Arc
- **Mood Arc**: SVG line chart — X=page, Y=mood score (1-5) — signature feature
- Overview: progress bar, status picker, synopsis, genres, star rating
- Notes: journal entries per book
- Quotes: quote cards with page numbers

### 7. AI Companion (`app/(tabs)/ai.tsx`)
- Context pill: currently reading book + page + last mood
- 3 mode tabs: Chat / Define / Recommend
- Calls Supabase Edge Function (not Anthropic directly)
- Starter prompts when chat is empty
- Real-time typing indicator

### 8. Insights (`app/(tabs)/insights.tsx`)
- Year stats: books read, pages, check-ins
- Genre breakdown (horizontal bar chart)
- Mood distribution (coloured bars)
- Year in Reading timeline
- Abandoned shelf with stop page

---

## Database Schema

```sql
user_profiles   — name, reading_goal, favorite_genres
books           — title, author, cover_url, genre[], status, pages, progress, rating
mood_logs       — book_id, page, mood, note, session_duration
quotes          — book_id, text, page
notes           — book_id, text
photos          — book_id, storage_path, caption
```

Every table has `user_id uuid references auth.users` + Row Level Security enabled.

Full SQL is in `supabase/schema.sql`.

---

## Project Structure

```
ReadScape/
├── app/
│   ├── _layout.tsx           # Root layout, font loading, auth guard
│   ├── index.tsx             # Landing screen
│   ├── onboarding.tsx        # Auth + profile setup
│   ├── (tabs)/
│   │   ├── _layout.tsx       # Tab bar config
│   │   ├── home.tsx          # Home dashboard
│   │   ├── library.tsx       # Book library
│   │   ├── ai.tsx            # AI companion
│   │   └── insights.tsx      # Reading insights
│   ├── book/[id].tsx         # Book detail (Overview/Notes/Quotes/Mood Arc)
│   └── session/[id].tsx      # Reading session check-in (modal)
├── src/
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client (SecureStore adapter)
│   │   └── googleBooks.ts    # Google Books API search
│   ├── store/index.ts        # Zustand global state
│   ├── types/index.ts        # TypeScript types for all entities
│   ├── design/tokens.ts      # Theme colors, mood config, spacing
│   └── components/
│       ├── BookCover.tsx     # Reusable cover image with fallback
│       └── MoodChip.tsx      # Reusable mood selection chip
├── supabase/
│   ├── schema.sql            # Full database schema + RLS policies
│   └── functions/
│       └── ai-companion/
│           └── index.ts      # Deno Edge Function → Anthropic API
├── PLAN.md                   # This file
├── .env.example              # Environment variable template
├── tailwind.config.js        # NativeWind + theme tokens
├── babel.config.js           # NativeWind + Reanimated plugins
└── metro.config.js           # NativeWind metro wrapper
```

---

## Setup Guide

### 1. Install dependencies
```bash
npm install
```

### 2. Create Supabase project
1. Go to [supabase.com](https://supabase.com) → New project
2. Open SQL Editor → paste contents of `supabase/schema.sql` → Run
3. Go to Storage → New bucket: `book-photos` (public)
4. Copy your Project URL + anon key from Settings → API

### 3. Set environment variables
```bash
cp .env.example .env.local
# Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### 4. Deploy the AI Edge Function
```bash
npx supabase login
npx supabase link --project-ref your-project-id
npx supabase functions deploy ai-companion
# Set the Anthropic API key:
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### 5. Run on your device
```bash
npx expo start
# Scan QR code with Expo Go app
```

### 6. Production build (when ready)
```bash
npx eas build --platform ios
npx eas build --platform android
```

---

## End-to-End Verification Checklist

- [ ] Sign up → onboarding completes → lands on Home
- [ ] Search Google Books → cover loads → add to library
- [ ] Tap "Continue Reading" → log mood + page → returns to Home
- [ ] Open Book Detail → Mood Arc shows logged point on chart
- [ ] AI Companion → send message → Claude responds with book context
- [ ] Insights shows streak, genre chart, year timeline
- [ ] Sign out → sign back in → all data intact (cloud, not local)
- [ ] Test on both iOS and Android via Expo Go

---

## What to Build Next

- **Book photos tab**: expo-image-picker → upload to Supabase Storage → gallery view
- **Push notifications**: Daily reading reminder ("You haven't read today!")
- **Widgets**: iOS/Android home screen widget showing current book + streak
- **Social**: Optional public reading profile / year-in-books shareable card
- **EAS Build + App Store submission**
