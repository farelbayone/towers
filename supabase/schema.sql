-- Jalankan di Supabase: SQL Editor -> New query -> Run
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  board text not null check (board ~ '^[a-z0-9-]{3,60}$'),
  name text not null check (char_length(name) between 1 and 20),
  score integer not null check (score between 0 and 10000000),
  wave integer not null check (wave between 0 and 1000),
  stars integer not null check (stars between 0 and 3),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists scores_board_score on public.scores (board, score desc);

create table if not exists public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (pg_column_size(data) < 20000),
  updated_at timestamptz not null default now()
);

alter table public.scores enable row level security;
alter table public.saves enable row level security;

drop policy if exists "scores are public" on public.scores;
create policy "scores are public" on public.scores for select using (true);

-- Pemain hanya boleh menambah skor atas namanya sendiri, selalu "belum terverifikasi".
drop policy if exists "insert own score" on public.scores;
create policy "insert own score" on public.scores for insert to authenticated
  with check (auth.uid() = user_id and verified = false);

drop policy if exists "own save" on public.saves;
create policy "own save" on public.saves for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.scores to anon, authenticated;
grant insert on public.scores to authenticated;
grant select, insert, update on public.saves to authenticated;
grant all on public.scores, public.saves to service_role;
