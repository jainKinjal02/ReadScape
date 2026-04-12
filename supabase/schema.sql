-- ReadScape Database Schema
-- Run this in the Supabase SQL editor: supabase.com → Your Project → SQL Editor

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

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  book_id uuid references books on delete cascade not null,
  storage_path text not null,
  caption text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Each user can only see and modify their own data.
-- This is enforced at the database level — not just the app level.
-- ============================================================

alter table user_profiles enable row level security;
alter table books enable row level security;
alter table mood_logs enable row level security;
alter table quotes enable row level security;
alter table notes enable row level security;
alter table photos enable row level security;

-- Policies: users can only CRUD their own rows
create policy "Users manage own profile" on user_profiles
  for all using (auth.uid() = user_id);

create policy "Users manage own books" on books
  for all using (auth.uid() = user_id);

create policy "Users manage own mood logs" on mood_logs
  for all using (auth.uid() = user_id);

create policy "Users manage own quotes" on quotes
  for all using (auth.uid() = user_id);

create policy "Users manage own notes" on notes
  for all using (auth.uid() = user_id);

create policy "Users manage own photos" on photos
  for all using (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET (run this separately or via Supabase dashboard)
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('book-photos', 'book-photos', true);
-- create policy "Users upload own photos" on storage.objects for insert with check (auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "Public read book photos" on storage.objects for select using (bucket_id = 'book-photos');
