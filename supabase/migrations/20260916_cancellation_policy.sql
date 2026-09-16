-- Per-game cancellation policy. Default 24h before kickoff, adjustable by
-- whoever creates the game. Run this in the Supabase SQL editor (or via
-- `supabase db push`).

alter table games add column cancellation_hours integer not null default 24;
