-- Personal (1:1) direct messaging, alongside the existing per-game group chat.
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- One row per pair of users. user_one/user_two are always stored in a
-- consistent order (lexicographically sorted uuid) so a given pair can
-- never end up with two separate conversation rows.
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_one uuid references auth.users(id) on delete cascade,
  user_two uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_one, user_two)
);

create table direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

alter table conversations enable row level security;
alter table direct_messages enable row level security;

-- conversations -----------------------------------------------------------
-- Only the two people in a conversation can see or create it.
create policy "conversations_select_participant"
  on conversations for select
  using (auth.uid() = user_one or auth.uid() = user_two);

create policy "conversations_insert_participant"
  on conversations for insert
  with check (auth.uid() = user_one or auth.uid() = user_two);

-- direct_messages -----------------------------------------------------------
-- Only participants in the parent conversation can read or send messages.
create policy "direct_messages_select_participant"
  on direct_messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = direct_messages.conversation_id
        and (c.user_one = auth.uid() or c.user_two = auth.uid())
    )
  );

create policy "direct_messages_insert_participant"
  on direct_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = direct_messages.conversation_id
        and (c.user_one = auth.uid() or c.user_two = auth.uid())
    )
  );
