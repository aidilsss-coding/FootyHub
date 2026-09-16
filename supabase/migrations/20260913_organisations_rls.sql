-- RLS policies for the organisations feature.
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- Without these, every insert/update from the app fails with:
--   "new row violates row-level security policy for table ..."
-- because RLS is on by default with no policies, which blocks everything.

alter table organisations enable row level security;
alter table organisation_members enable row level security;
alter table leader_requests enable row level security;

-- organisations ---------------------------------------------------------
-- Anyone can view organisations (org profile pages are public).
create policy "organisations_select_all"
  on organisations for select
  using (true);

-- Any logged-in user can create an organisation, but only as themselves.
create policy "organisations_insert_self"
  on organisations for insert
  with check (founder_id = auth.uid());

-- organisation_members ---------------------------------------------------
-- Anyone can view membership lists (needed for the org page + role checks).
create policy "organisation_members_select_all"
  on organisation_members for select
  using (true);

-- A user can only ever insert a membership row for themselves —
-- covers both "founder row on org creation" and "join organisation".
create policy "organisation_members_insert_self"
  on organisation_members for insert
  with check (profile_id = auth.uid());

-- A leader/founder of the same organisation can update another member's
-- row (this is how approving a leader request promotes someone else).
create policy "organisation_members_update_by_leadership"
  on organisation_members for update
  using (
    exists (
      select 1 from organisation_members me
      where me.organisation_id = organisation_members.organisation_id
        and me.profile_id = auth.uid()
        and me.role in ('leader', 'founder')
    )
  );

-- leader_requests ---------------------------------------------------------
-- A user can see their own requests, and leaders/founders can see all
-- requests for organisations they lead.
create policy "leader_requests_select_own_or_leadership"
  on leader_requests for select
  using (
    requester_id = auth.uid()
    or exists (
      select 1 from organisation_members me
      where me.organisation_id = leader_requests.organisation_id
        and me.profile_id = auth.uid()
        and me.role in ('leader', 'founder')
    )
  );

-- A user can only ever request leadership for themselves.
create policy "leader_requests_insert_self"
  on leader_requests for insert
  with check (requester_id = auth.uid());

-- Only a leader/founder of that organisation can approve/reject a request.
create policy "leader_requests_update_by_leadership"
  on leader_requests for update
  using (
    exists (
      select 1 from organisation_members me
      where me.organisation_id = leader_requests.organisation_id
        and me.profile_id = auth.uid()
        and me.role in ('leader', 'founder')
    )
  );
