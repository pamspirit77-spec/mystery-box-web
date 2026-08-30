-- Mystery Box 3D — NON-DESTRUCTIVE top-up compatibility fix
-- Keeps the old guest-wallet/top-up columns and functions.
-- Adds authenticated-user fields needed by the current login system.
-- Run this ONCE in Supabase SQL Editor.

alter table public.topup_requests
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.topup_requests
  add column if not exists proof_path text;

alter table public.topup_requests
  add column if not exists player_name text;

-- Existing guest-only columns are kept, but new authenticated requests do not need them.
alter table public.topup_requests alter column guest_key drop not null;
alter table public.topup_requests alter column player_name drop not null;

-- Replace only the old payment check so a TrueMoney request can be sent without a proof image.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.topup_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%proof%'
  LOOP
    EXECUTE format('ALTER TABLE public.topup_requests DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.topup_requests'::regclass
      AND conname='topup_requests_payment_method_check_v2'
  ) THEN
    ALTER TABLE public.topup_requests
      ADD CONSTRAINT topup_requests_payment_method_check_v2 CHECK (
        (method='wallet' AND wallet_link IS NOT NULL AND wallet_link ~* '^https?://' AND card_code IS NULL)
        OR
        (method='card' AND card_code IS NOT NULL AND card_code ~ '^[0-9]{14}$' AND wallet_link IS NULL)
      );
  END IF;
END $$;

-- Authenticated players may create/read only their own new requests.
drop policy if exists "topup_insert_anon" on public.topup_requests;
drop policy if exists "topup_insert_own" on public.topup_requests;
create policy "topup_insert_own"
on public.topup_requests for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "topup_select_own" on public.topup_requests;
create policy "topup_select_own"
on public.topup_requests for select
to authenticated
using (auth.uid() = user_id OR public.is_admin());

-- Admin list works with both the old guest-wallet records and new authenticated records.
create or replace function public.admin_list_topups()
returns table (
  id uuid, user_id uuid, username text, method text, amount integer,
  wallet_link text, card_code text, proof_path text, status text,
  created_at timestamptz, reviewed_at timestamptz
)
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
  select t.id,
         t.user_id,
         coalesce(p.username, t.player_name, 'ผู้เล่น') as username,
         t.method, t.amount, t.wallet_link, t.card_code, t.proof_path,
         t.status, t.created_at,
         coalesce(t.reviewed_at, t.approved_at) as reviewed_at
  from public.topup_requests t
  left join public.profiles p on p.id=t.user_id
  order by t.created_at desc;
end;
$$;

grant execute on function public.admin_list_topups() to authenticated;

-- Approve authenticated requests -> add coins to profiles atomically.
-- Legacy guest-only requests continue to use guest_wallets, so the old system is not removed.
create or replace function public.admin_review_topup(p_topup_id uuid, p_approve boolean)
returns bigint
language plpgsql security definer set search_path=public
as $$
declare
  v_amount integer;
  v_user_id uuid;
  v_guest_key uuid;
  v_player_name text;
  v_status text;
  v_new_balance bigint;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  select amount,user_id,guest_key,player_name,status
    into v_amount,v_user_id,v_guest_key,v_player_name,v_status
  from public.topup_requests
  where id=p_topup_id for update;

  if v_status is null then raise exception 'topup_not_found'; end if;
  if v_status <> 'pending' then raise exception 'already_reviewed'; end if;

  if p_approve then
    if v_user_id is not null then
      update public.profiles
      set coins=coins+v_amount, updated_at=now()
      where id=v_user_id
      returning coins into v_new_balance;
      if v_new_balance is null then raise exception 'profile_not_found'; end if;
    elsif v_guest_key is not null then
      update public.guest_wallets
      set coins=coins+v_amount, updated_at=now()
      where guest_key=v_guest_key
      returning coins into v_new_balance;
      if v_new_balance is null then raise exception 'guest_wallet_not_found'; end if;
    else
      raise exception 'topup_owner_not_found';
    end if;

    update public.topup_requests
    set status='approved', approved_by=auth.uid(), approved_at=now(),
        reviewed_by=auth.uid(), reviewed_at=now()
    where id=p_topup_id;
    return v_new_balance;
  else
    update public.topup_requests
    set status='rejected', approved_by=auth.uid(), approved_at=now(),
        reviewed_by=auth.uid(), reviewed_at=now()
    where id=p_topup_id;
    if v_user_id is not null then
      return (select coins from public.profiles where id=v_user_id);
    end if;
    return coalesce((select coins from public.guest_wallets where guest_key=v_guest_key),0);
  end if;
end;
$$;

grant execute on function public.admin_review_topup(uuid,boolean) to authenticated;

-- Refresh PostgREST's schema cache after the ALTER TABLE statements.
notify pgrst, 'reload schema';
