-- GymBro cloud backup.
-- One row per (user, kind). The app stays local-first: the phone is the source
-- of truth while offline and this table is a merged backup synced on demand.
--   kind = 'profile'          data = { profile, updatedAt }
--   kind = 'custom_routines'  data = { items, deleted, updatedAt }
--   kind = 'history'          data = { items, deleted, updatedAt }

create table if not exists public.user_data (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('profile', 'custom_routines', 'history')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.user_data enable row level security;

-- Each athlete can only see and change their own rows.
-- `(select auth.uid())` is evaluated once per query instead of once per row.
create policy "user_data_select_own" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "user_data_insert_own" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "user_data_update_own" on public.user_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_data_delete_own" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);
