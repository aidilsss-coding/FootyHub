-- Read/unread tracking for chat, so the bottom-nav Chat icon can show an
-- unread badge. DMs track per-participant read timestamps directly on the
-- conversation row (only two participants, so two columns is simplest);
-- game group chats can have many participants, so they get a separate
-- per-user table instead.
--
-- Written to be safely re-runnable (drop-if-exists / if-not-exists
-- throughout) since an earlier version of this file had game_chat_reads.game_id
-- typed as uuid instead of bigint (games.id is bigint) and failed partway
-- through on first run.

alter table conversations add column if not exists user_one_last_read_at timestamptz not null default now();
alter table conversations add column if not exists user_two_last_read_at timestamptz not null default now();

-- Participants need to be able to bump their own "last read" column —
-- there was no update policy on conversations before this.
drop policy if exists "conversations_update_participant" on conversations;
create policy "conversations_update_participant"
  on conversations for update
  using (auth.uid() = user_one or auth.uid() = user_two)
  with check (auth.uid() = user_one or auth.uid() = user_two);

create table if not exists game_chat_reads (
  game_id bigint references games(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

alter table game_chat_reads enable row level security;

drop policy if exists "game_chat_reads_select_own" on game_chat_reads;
create policy "game_chat_reads_select_own"
  on game_chat_reads for select
  using (auth.uid() = user_id);

drop policy if exists "game_chat_reads_insert_own" on game_chat_reads;
create policy "game_chat_reads_insert_own"
  on game_chat_reads for insert
  with check (auth.uid() = user_id);

drop policy if exists "game_chat_reads_update_own" on game_chat_reads;
create policy "game_chat_reads_update_own"
  on game_chat_reads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Single round-trip count of everything the signed-in user hasn't read yet —
-- across their DM conversations and every game chat they're in (as host or
-- as a booked player). Runs as the caller (not security definer), scoped to
-- auth.uid() throughout, so RLS on the underlying tables still applies.
create or replace function get_unread_chat_count()
returns integer
language sql
stable
as $$
  with my_games as (
    select game_id from bookings where user_id = auth.uid()
    union
    select id as game_id from games where organizer_id = auth.uid()
  )
  select
    coalesce((
      select count(*)::int
      from direct_messages dm
      join conversations c on c.id = dm.conversation_id
      where dm.sender_id <> auth.uid()
        and (
          (c.user_one = auth.uid() and dm.created_at > c.user_one_last_read_at)
          or (c.user_two = auth.uid() and dm.created_at > c.user_two_last_read_at)
        )
    ), 0)
    +
    coalesce((
      select count(*)::int
      from messages m
      join my_games mg on mg.game_id = m.game_id
      left join game_chat_reads r on r.game_id = m.game_id and r.user_id = auth.uid()
      where m.user_id <> auth.uid()
        and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
    ), 0);
$$;

grant execute on function get_unread_chat_count() to authenticated;
