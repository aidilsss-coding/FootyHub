-- Footy Hub Home redesign — schema additions
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- See ~/Downloads/INTEGRATION.md for context.

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  game_id bigint references games(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  position int not null,
  created_at timestamptz default now(),
  unique (game_id, user_id)
);

alter table profiles add column games_played int default 0;
alter table profiles add column no_shows int default 0; -- turn-up % = 1 - no_shows/games_played
