-- Mystery Box: persistent player inventory
-- Run once in Supabase SQL Editor.
-- Does not modify profiles, coins, topups, history, or admin data.

create table if not exists public.player_inventory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_inventory enable row level security;

drop policy if exists "player_inventory_select_own" on public.player_inventory;
drop policy if exists "player_inventory_insert_own" on public.player_inventory;
drop policy if exists "player_inventory_update_own" on public.player_inventory;

create policy "player_inventory_select_own"
on public.player_inventory
for select to authenticated
using (auth.uid() = user_id);

create policy "player_inventory_insert_own"
on public.player_inventory
for insert to authenticated
with check (auth.uid() = user_id);

create policy "player_inventory_update_own"
on public.player_inventory
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.player_inventory to authenticated;
