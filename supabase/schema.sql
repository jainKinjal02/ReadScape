-- ReadScape Database Schema
-- Run this ENTIRE file in the Supabase SQL editor:
--   supabase.com → Your Project → SQL Editor → New query → paste → Run
--
-- Safe to re-run: every statement is idempotent.

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists user_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  name text,
  reading_goal int default 12,
  favorite_genres text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  author text,
  cover_url text,
  genre text[] default '{}',
  status text check (status in ('reading', 'read', 'want_to_read', 'abandoned')) default 'want_to_read',
  total_pages int,
  current_page int default 0,
  rating int check (rating between 1 and 5),
  synopsis text,
  google_books_id text,
  date_added timestamptz default now(),
  date_started timestamptz,
  date_finished timestamptz
);

create table if not exists mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  book_id uuid references books on delete cascade not null,
  page int,
  mood text check (mood in ('loving_it', 'getting_into_it', 'struggling', 'taking_a_break', 'finished')) not null,
  note text,
  session_duration_mins int,
  created_at timestamptz default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  book_id uuid references books on delete cascade not null,
  text text not null,
  page int,
  created_at timestamptz default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  book_id uuid references books on delete cascade not null,
  text text not null,
  created_at timestamptz default now()
);

-- NOTE: photos.book_id is intentionally NULLABLE.
-- Standalone gallery photos (src/lib/gallery.ts → uploadGalleryPhoto) insert
-- book_id: null, and fetchGalleryPhotos filters on `.is("book_id", null)`.
-- A NOT NULL here causes error 23502 on every gallery upload.
create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  book_id uuid references books on delete cascade,
  storage_path text not null,
  caption text,
  created_at timestamptz default now()
);

-- If the table already existed with a NOT NULL book_id, relax it.
alter table photos alter column book_id drop not null;

-- ============================================================
-- ROW LEVEL SECURITY
-- Each user can only see and modify their own data.
-- Enforced at the database level — not just in the app.
-- ============================================================

alter table user_profiles enable row level security;
alter table books        enable row level security;
alter table mood_logs    enable row level security;
alter table quotes       enable row level security;
alter table notes        enable row level security;
alter table photos       enable row level security;

-- IMPORTANT: a `for all` policy needs BOTH clauses.
--   using      → governs SELECT / UPDATE / DELETE (which rows are visible)
--   with check → governs INSERT / UPDATE (which rows may be written)
-- With `using` alone, every INSERT fails with "new row violates row-level
-- security policy" — the app can read but never write.

drop policy if exists "Users manage own profile" on user_profiles;
create policy "Users manage own profile" on user_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own books" on books;
create policy "Users manage own books" on books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own mood logs" on mood_logs;
create policy "Users manage own mood logs" on mood_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own quotes" on quotes;
create policy "Users manage own quotes" on quotes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own notes" on notes;
create policy "Users manage own notes" on notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own photos" on photos;
create policy "Users manage own photos" on photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET
-- Public because src/lib/gallery.ts uses getPublicUrl() — a private
-- bucket makes those URLs return 403.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('book-photos', 'book-photos', true)
on conflict (id) do update set public = true;

-- Storage RLS is SEPARATE from table RLS: it lives on storage.objects.
--
-- Upload paths are `gallery/<user-id>/<timestamp>.<ext>`, so:
--   (storage.foldername(name))[1] = 'gallery'
--   (storage.foldername(name))[2] = the owning user's id
-- Checking [1] against auth.uid() (as an older draft of this file did) can
-- never match and blocks every upload.

drop policy if exists "Users upload own photos" on storage.objects;
create policy "Users upload own photos" on storage.objects
  for insert with check (
    bucket_id = 'book-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Public read book photos" on storage.objects;
create policy "Public read book photos" on storage.objects
  for select using (bucket_id = 'book-photos');

drop policy if exists "Users delete own photos" on storage.objects;
create policy "Users delete own photos" on storage.objects
  for delete using (
    bucket_id = 'book-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ============================================================
-- AI USAGE RATE LIMITING
-- Backs supabase/functions/ai-companion. Without this the function is an
-- open, metered endpoint: the anon key that authorises it ships inside the
-- app bundle, so anyone can extract it and spend our Anthropic credits.
-- ============================================================

create table if not exists ai_usage (
  user_id uuid references auth.users on delete cascade not null,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

-- RLS on with NO policies: end users can never read or write this table.
-- Only the service role (which bypasses RLS) touches it, from the Edge Function.
alter table ai_usage enable row level security;

-- Atomically increment today's counter and report whether the caller is still
-- within budget. Doing this in one statement avoids the read-then-write race
-- that would let concurrent requests slip past the limit.
create or replace function increment_ai_usage(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into ai_usage (user_id, day, count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, day)
    do update set count = ai_usage.count + 1
  returning count into new_count;

  return new_count <= p_limit;
end;
$$;

-- Only the service role may call this; end users must not self-serve quota.
revoke all on function increment_ai_usage(uuid, int) from public, anon, authenticated;
