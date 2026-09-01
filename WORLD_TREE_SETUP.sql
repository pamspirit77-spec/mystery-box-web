-- World Tree system migration
-- Run once in Supabase SQL Editor.
-- This is isolated from Mystery Box, inventory, top-up and history tables.

create table if not exists public.world_tree_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  planted boolean not null default false,
  planted_at timestamptz null,
  growth integer not null default 0 check (growth >= 0 and growth <= 1000),
  items jsonb not null default '{"normalWater":25,"specialWater":15,"normalFertilizer":20,"specialFertilizer":10}'::jsonb,
  claimed_rewards jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);


alter table public.world_tree_states add column if not exists planted_at timestamptz null;

alter table public.world_tree_states enable row level security;

drop policy if exists "world_tree_select_own" on public.world_tree_states;
create policy "world_tree_select_own"
on public.world_tree_states
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "world_tree_insert_own" on public.world_tree_states;
create policy "world_tree_insert_own"
on public.world_tree_states
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "world_tree_update_own" on public.world_tree_states;
create policy "world_tree_update_own"
on public.world_tree_states
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.world_tree_states to authenticated;

create index if not exists world_tree_states_updated_idx
on public.world_tree_states(updated_at desc);
