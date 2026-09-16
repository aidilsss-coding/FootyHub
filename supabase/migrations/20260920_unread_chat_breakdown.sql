-- Per-chat unread counts (as opposed to get_unread_chat_count()'s single
-- app-wide total from 20260919) so the chat list can badge each individual
-- DM conversation / game chat row with how many messages are unread in it.
-- Only rows with at least one unread message come back — the client treats
-- anything missing as zero.

create or replace function get_unread_chat_breakdown()
returns table(kind text, ref_id text, unread_count int)
language sql
stable
as $$
  with my_games as (
    select game_id from bookings where user_id = auth.uid()
    union
    select id as game_id from games where organizer_id = auth.uid()
  ),
  dm_counts as (
    select c.id as conv_id, count(*)::int as n
    from conversations c
    join direct_messages dm on dm.conversation_id = c.id
    where (c.user_one = auth.uid() or c.user_two = auth.uid())
      and dm.sender_id <> auth.uid()
      and (
        (c.user_one = auth.uid() and dm.created_at > c.user_one_last_read_at)
        or (c.user_two = auth.uid() and dm.created_at > c.user_two_last_read_at)
      )
    group by c.id
  ),
  game_counts as (
    select m.game_id, count(*)::int as n
    from messages m
    join my_games mg on mg.game_id = m.game_id
    left join game_chat_reads r on r.game_id = m.game_id and r.user_id = auth.uid()
    where m.user_id <> auth.uid()
      and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
    group by m.game_id
  )
  select 'dm'::text, conv_id::text, n from dm_counts
  union all
  select 'game'::text, game_id::text, n from game_counts;
$$;

grant execute on function get_unread_chat_breakdown() to authenticated;
