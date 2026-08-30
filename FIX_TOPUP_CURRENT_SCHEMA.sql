-- Mystery Box 3D — FIX for the CURRENT authenticated topup_requests schema
-- IMPORTANT: This version does NOT use guest_key and does NOT delete any old game systems.
-- Run this file in Supabase SQL Editor.

-- 1) Make sure the columns used by the current game exist.
alter table public.topup_requests
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.topup_requests
  add column if not exists wallet_link text;

alter table public.topup_requests
  add column if not exists card_code text;

alter table public.topup_requests
  add column if not exists proof_path text;

-- 2) Remove ONLY old CHECK constraints that force a proof image.
--    We keep the table, rows, indexes and all unrelated systems.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.topup_requests'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%proof_path%'
  LOOP
    EXECUTE format('ALTER TABLE public.topup_requests DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- 3) Remove an old method constraint only if it is named differently.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.topup_requests'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%method%'
      AND pg_get_constraintdef(c.oid) ILIKE '%wallet%'
      AND pg_get_constraintdef(c.oid) ILIKE '%card%'
  LOOP
    EXECUTE format('ALTER TABLE public.topup_requests DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- 4) Current payment validation:
--    Wallet = valid http/https link
--    TrueMoney = exactly 14 digits
--    Proof image is OPTIONAL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.topup_requests'::regclass
      AND conname = 'topup_requests_payment_check_current'
  ) THEN
    ALTER TABLE public.topup_requests
      ADD CONSTRAINT topup_requests_payment_check_current CHECK (
        (
          method = 'wallet'
          AND wallet_link IS NOT NULL
          AND wallet_link ~* '^https?://'
          AND card_code IS NULL
        )
        OR
        (
          method = 'card'
          AND card_code IS NOT NULL
          AND card_code ~ '^[0-9]{14}$'
          AND wallet_link IS NULL
        )
      );
  END IF;
END $$;

-- 5) RLS: logged-in player can submit and view only their own requests.
alter table public.topup_requests enable row level security;

drop policy if exists "topup_insert_own" on public.topup_requests;
create policy "topup_insert_own"
on public.topup_requests
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "topup_select_own" on public.topup_requests;
create policy "topup_select_own"
on public.topup_requests
for select to authenticated
using (auth.uid() = user_id OR public.is_admin());

-- 6) Admin list. Uses only columns in the current authenticated schema.
create or replace function public.admin_list_topups()
returns table (
  id uuid,
  user_id uuid,
  username text,
  method text,
  amount integer,
  wallet_link text,
  card_code text,
  proof_path text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz
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
  select
    t.id,
    t.user_id,
    coalesce(p.username, 'ผู้เล่น') as username,
    t.method,
    t.amount,
    t.wallet_link,
    t.card_code,
    t.proof_path,
    t.status,
    t.created_at,
    t.reviewed_at
  from public.topup_requests t
  left join public.profiles p on p.id = t.user_id
  order by t.created_at desc;
end;
$$;

grant execute on function public.admin_list_topups() to authenticated;

-- 7) Admin approval: atomically adds coins to the logged-in user's profile.
create or replace function public.admin_review_topup(
  p_topup_id uuid,
  p_approve boolean
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount integer;
  v_user_id uuid;
  v_status text;
  v_new_balance bigint;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select amount, user_id, status
    into v_amount, v_user_id, v_status
  from public.topup_requests
  where id = p_topup_id
  for update;

  if v_status is null then
    raise exception 'topup_not_found';
  end if;

  if v_status <> 'pending' then
    raise exception 'already_reviewed';
  end if;

  if p_approve then
    update public.profiles
       set coins = coins + v_amount,
           updated_at = now()
     where id = v_user_id
     returning coins into v_new_balance;

    if v_new_balance is null then
      raise exception 'profile_not_found';
    end if;

    update public.topup_requests
       set status = 'approved',
           reviewed_by = auth.uid(),
           reviewed_at = now()
     where id = p_topup_id;

    return v_new_balance;
  else
    update public.topup_requests
       set status = 'rejected',
           reviewed_by = auth.uid(),
           reviewed_at = now()
     where id = p_topup_id;

    return coalesce(
      (select coins from public.profiles where id = v_user_id),
      0
    );
  end if;
end;
$$;

grant execute on function public.admin_review_topup(uuid, boolean) to authenticated;

-- 8) Refresh PostgREST schema cache.
notify pgrst, 'reload schema';
