-- Mystery Box: Reward claim workflow
-- Adds only the reward-claim workflow. Existing tables/functions are kept intact.
-- Run this whole file once in Supabase SQL Editor.

create table if not exists public.reward_claim_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.reward_claim_requests enable row level security;

drop policy if exists "reward_claim_select_own" on public.reward_claim_requests;
create policy "reward_claim_select_own"
on public.reward_claim_requests
for select to authenticated
using (auth.uid() = user_id);

create index if not exists reward_claim_requests_status_created_idx
on public.reward_claim_requests(status, created_at desc);

create index if not exists reward_claim_requests_user_created_idx
on public.reward_claim_requests(user_id, created_at desc);

-- Player submits a claim atomically:
-- 1) reads the player's current inventory
-- 2) copies the requested item(s) into the claim snapshot
-- 3) removes only those items from the player's inventory
--
-- p_item_ids = NULL or [] means "claim all".
-- Item IDs are compared as text so existing numeric IDs are supported.
create or replace function public.create_reward_claim(p_item_ids jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_inventory jsonb := '[]'::jsonb;
  v_claim_items jsonb := '[]'::jsonb;
  v_remaining jsonb := '[]'::jsonb;
  v_claim_id uuid;
  v_want_all boolean := p_item_ids is null
    or jsonb_typeof(p_item_ids) <> 'array'
    or jsonb_array_length(p_item_ids) = 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select coalesce(items, '[]'::jsonb)
    into v_inventory
  from public.player_inventory
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'ไม่มีรางวัลในคลัง';
  end if;

  if jsonb_array_length(v_inventory) = 0 then
    raise exception 'ไม่มีรางวัลในคลัง';
  end if;

  if v_want_all then
    v_claim_items := v_inventory;
    v_remaining := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(item), '[]'::jsonb)
      into v_claim_items
    from jsonb_array_elements(v_inventory) item
    where (item->>'id') in (
      select jsonb_array_elements_text(p_item_ids)
    );

    if jsonb_array_length(v_claim_items) = 0 then
      raise exception 'ไม่พบรางวัลที่ต้องการขอรับ';
    end if;

    select coalesce(jsonb_agg(item), '[]'::jsonb)
      into v_remaining
    from jsonb_array_elements(v_inventory) item
    where not ((item->>'id') in (
      select jsonb_array_elements_text(p_item_ids)
    ));
  end if;

  insert into public.reward_claim_requests(user_id, items)
  values (v_user_id, v_claim_items)
  returning id into v_claim_id;

  update public.player_inventory
  set items = v_remaining, updated_at = now()
  where user_id = v_user_id;

  return v_claim_id;
end;
$$;

revoke all on function public.create_reward_claim(jsonb) from public;
grant execute on function public.create_reward_claim(jsonb) to authenticated;

-- Admin list with player username/email and the exact reward snapshot.
create or replace function public.admin_list_reward_claims()
returns table (
  id uuid,
  user_id uuid,
  username text,
  email text,
  items jsonb,
  status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  return query
  select r.id,
         r.user_id,
         coalesce(p.username, 'ไม่มีชื่อ')::text,
         coalesce(u.email, '')::text,
         r.items,
         r.status,
         r.reviewed_by,
         r.reviewed_at,
         r.created_at
  from public.reward_claim_requests r
  left join public.profiles p on p.id = r.user_id
  left join auth.users u on u.id = r.user_id
  order by case when r.status='pending' then 0 else 1 end,
           r.created_at desc;
end;
$$;

revoke all on function public.admin_list_reward_claims() from public;
grant execute on function public.admin_list_reward_claims() to authenticated;

-- Admin approve/reject.
-- Approve: closes the request; rewards stay out of inventory.
-- Reject: puts the exact claimed snapshot back into the player's inventory.
create or replace function public.admin_review_reward_claim(
  p_claim_id uuid,
  p_approve boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_status text;
  v_items jsonb := '[]'::jsonb;
  v_current jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select user_id, status, items
    into v_user_id, v_status, v_items
  from public.reward_claim_requests
  where id = p_claim_id
  for update;

  if v_user_id is null then
    raise exception 'claim_not_found';
  end if;

  if v_status <> 'pending' then
    raise exception 'already_reviewed';
  end if;

  if p_approve then
    update public.reward_claim_requests
    set status='approved',
        reviewed_by=auth.uid(),
        reviewed_at=now()
    where id=p_claim_id;
    return 'approved';
  end if;

  -- Rejection returns the claimed rewards to the player's current inventory.
  -- This preserves any new rewards the player may have won after submitting
  -- the earlier claim.
  select coalesce(items, '[]'::jsonb)
    into v_current
  from public.player_inventory
  where user_id=v_user_id
  for update;

  if not found then
    insert into public.player_inventory(user_id, items, updated_at)
    values (v_user_id, v_items, now());
  else
    update public.player_inventory
    set items = coalesce(v_current, '[]'::jsonb) || coalesce(v_items, '[]'::jsonb),
        updated_at=now()
    where user_id=v_user_id;
  end if;

  update public.reward_claim_requests
  set status='rejected',
      reviewed_by=auth.uid(),
      reviewed_at=now()
  where id=p_claim_id;

  return 'rejected';
end;
$$;

revoke all on function public.admin_review_reward_claim(uuid, boolean) from public;
grant execute on function public.admin_review_reward_claim(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
