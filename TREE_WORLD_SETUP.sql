-- Mystery Box 3D — Tree World migration
-- Run this once in Supabase SQL Editor.
-- This migration only creates the player tree state table and RLS policies.
-- It does not alter Mystery Box tables or existing box data.

create table if not exists public.player_tree_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  planted boolean not null default false,
  growth integer not null default 0 check (growth >= 0 and growth <= 1000),
  items jsonb not null default '{"normal_water":10,"special_water":10,"normal_fertilizer":10,"special_fertilizer":10}'::jsonb,
  claimed_milestones integer[] not null default '{}'::integer[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_tree_state enable row level security;

drop policy if exists "tree_select_own" on public.player_tree_state;
create policy "tree_select_own" on public.player_tree_state
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "tree_insert_own" on public.player_tree_state;
create policy "tree_insert_own" on public.player_tree_state
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "tree_update_own" on public.player_tree_state;
create policy "tree_update_own" on public.player_tree_state
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists player_tree_state_updated_idx
on public.player_tree_state(updated_at desc);
