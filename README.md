# ReadScape

A reading tracker that remembers how a book *felt*, not just that you finished it.

Every tracker records status and stars. ReadScape logs a mood with each reading
session, then surfaces it everywhere — on the book, in the library grid, and as
a frequency chart of how your year actually read.

Built with React Native (Expo) and Supabase.

---

## Features

- **Library** — search Open Library, track status (reading / read / waiting /
  put down), mark favourites, tag genres
- **Reading sessions** — log your page, a mood, a note and a quote in one pass
- **Moods** — the thing no other tracker shows: how each book felt, chapter by
  chapter
- **Quotes & notes** — passages kept with a highlighter, shareable as an image
- **Cozy corner** — photos of your books out in the world
- **Insights** — how long each book kept you, which moods recurred, your year
- **AI companion** — ask about the book you're reading, powered by Claude
  through a Supabase Edge Function, so the API key never reaches the app

## Design

Paper, ink and one highlighter. The app contributes nothing else — every other
colour on screen comes from the book covers, so the shelf changes colour as
your reading does. Fraunces for display, Archivo for interface, Literata for
anything meant to be read.

## Stack

| | |
|---|---|
| App | Expo SDK 54, React Native 0.81, expo-router |
| State | Zustand |
| Backend | Supabase — Postgres, Auth, Storage, Edge Functions |
| AI | Claude via `@anthropic-ai/sdk` in a Deno Edge Function |
| Book data | Open Library |

## Running it

```bash
npm install --legacy-peer-deps
cp .env.example .env.local     # fill in your Supabase URL and anon key
npx expo start --clear
```

`--legacy-peer-deps` is required: `react-dom` is pulled in transitively as an
optional peer and wants a React newer than the one Expo SDK 54 pins.

`EXPO_PUBLIC_*` variables are inlined into the bundle at build time, so after
editing `.env.local` you need a Metro restart — a reload is not enough.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL editor — it creates the tables, row
   level security policies, the `book-photos` storage bucket, and the AI rate
   limit table. It is idempotent, so it is safe to re-run.
3. Authentication → Providers → enable Email; add Google if you want it, with
   `https://<ref>.supabase.co/auth/v1/callback` as the redirect URI
4. Authentication → URL Configuration → add `readscape://**`, `exp://**` and
   `http://localhost:8081/**`

### The AI companion

```bash
supabase link --project-ref <your-ref>
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai-companion
```

The function verifies the caller's JWT before doing any work. The Supabase
gateway accepts the anon key, which ships inside the app bundle and can be
extracted — so the anon key alone is not proof of a signed-in user. It also
rate limits per user per day (`AI_DAILY_LIMIT`, default 20) and fails closed.

## Web

The app also builds for web:

```bash
npx expo start --web
```

Auth storage is platform-switched — SecureStore on native, `localStorage` on
web, since SecureStore does not exist in a browser.

## Project layout

```
app/              expo-router routes; (tabs)/ is the four-tab shell
src/design/       colour, type and spacing tokens — the whole theme
src/lib/          Supabase client, data access, auth, errors
src/components/   shared UI
supabase/         schema.sql and the ai-companion Edge Function
scripts/          asset generator (icon, splash, favicon) via resvg
```

## Regenerating app artwork

```bash
node scripts/generate-assets.cjs
```

Renders the icon, splash, adaptive icon and favicon from SVG, using the real
Fraunces and Archivo font files so the splash wordmark matches the UI exactly.
