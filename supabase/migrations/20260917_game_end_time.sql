-- Games get an optional end time alongside game_date (the start time).
-- Run this in the Supabase SQL editor (or via `supabase db push`).

alter table games add column end_date timestamptz;
