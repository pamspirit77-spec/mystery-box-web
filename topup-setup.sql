-- Mystery Box 3D — Top-up / Admin migration
-- Run this AFTER supabase-setup.sql.
-- Uses guest browser UUIDs because the current game has no visible login screen.
-- For real production money, add proper user authentication/KYC/business payment compliance.

create table if not exists public.guest_wallets (
  guest_key uuid primary key,
  username text not null,
  coins bigint not null default 24 check (coins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topup_requests (
  id uuid primary key default gen_random_uuid(),
  guest_key uuid not null references public.guest_wallets(guest_key) on delete cascade,
  player_name text not null,
  method text not null check (method in ('wallet','card')),
  amount integer not null check (
    amount >= 10 and (method = 'wallet' or amount in (50,90,150,300,500,1000))
  ),
  wallet_link text,
  card_code text,
  image_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists topup_requests_status_created_idx
on public.topup_requests(status, created_at desc);
create index if not exists topup_requests_guest_created_idx
on public.topup_requests(guest_key, created_at desc);

alter table public.guest_wallets enable row level security;
alter table public.topup_requests enable row level security;
alter table public.admin_users enable row level security;

-- Admin check. SECURITY DEFINER is used so clients cannot bypass the admin table.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- No direct client SELECT/UPDATE is granted on guest wallets.
-- The browser uses the narrowly-scoped RPC functions below.

drop policy if exists "topup_insert_anon" on public.topup_requests;
create policy "topup_insert_anon"
on public.topup_requests for insert
to anon, authenticated
with check (
  amount >= 10
  and (method = 'wallet' or amount in (50,90,150,300,500,1000))
  and (
    (method = 'wallet' and wallet_link is not null and wallet_link ~* '^https?://')
    or
    (method = 'card' and card_code ~ '^[0-9]{14}$' and image_path is not null)
  )
);

drop policy if exists "topup_admin_select" on public.topup_requests;
create policy "topup_admin_select"
on public.topup_requests for select
to authenticated
using (public.is_admin());

drop policy if exists "admin_self_select" on public.admin_users;
create policy "admin_self_select"
on public.admin_users for select
to authenticated
using (auth.uid() = user_id);

-- Private storage bucket for card proof images.
insert into storage.buckets (id, name, public)
values ('topup-proofs', 'topup-proofs', false)
on conflict (id) do update set public = false;

drop policy if exists "topup_proof_upload" on storage.objects;
create policy "topup_proof_upload"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'topup-proofs');

drop policy if exists "topup_proof_admin_read" on storage.objects;
create policy "topup_proof_admin_read"
on storage.objects for select
to authenticated
using (bucket_id = 'topup-proofs' and public.is_admin());

-- Create/load the current browser's guest wallet.
create or replace function public.get_guest_wallet(p_guest_key uuid, p_username text)
returns table(coins bigint, username text)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.guest_wallets(guest_key, username)
  values (p_guest_key, left(coalesce(nullif(trim(p_username), ''), 'Player'), 40))
  on conflict (guest_key) do update set username = excluded.username, updated_at = now();

  return query
  select g.coins, g.username
  from public.guest_wallets g
  where g.guest_key = p_guest_key;
end;
$$;

grant execute on function public.get_guest_wallet(uuid,text) to anon, authenticated;

create or replace function public.spend_guest_coins(p_guest_key uuid, p_amount integer)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare new_coins bigint;
begin
  if p_amount <= 0 or p_amount > 1000000 then
    raise exception 'invalid coin amount';
  end if;

  update public.guest_wallets
  set coins = coins - p_amount, updated_at = now()
  where guest_key = p_guest_key and coins >= p_amount
  returning coins into new_coins;

  if new_coins is null then raise exception 'เหรียญไม่เพียงพอ'; end if;
  return new_coins;
end;
$$;

grant execute on function public.spend_guest_coins(uuid,integer) to anon, authenticated;

create or replace function public.get_my_topup_requests(p_guest_key uuid)
returns table(
  id uuid,
  method text,
  amount integer,
  status text,
  admin_note text,
  created_at timestamptz,
  approved_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, method, amount, status, admin_note, created_at, approved_at
  from public.topup_requests
  where guest_key = p_guest_key
  order by created_at desc
  limit 30;
$$;

grant execute on function public.get_my_topup_requests(uuid) to anon, authenticated;

create or replace function public.get_topup_status(p_request_id uuid, p_guest_key uuid)
returns table(status text, amount integer, method text, admin_note text)
language sql
security definer
set search_path = public
as $$
  select status, amount, method, admin_note
  from public.topup_requests
  where id = p_request_id and guest_key = p_guest_key;
$$;

grant execute on function public.get_topup_status(uuid,uuid) to anon, authenticated;

-- Approve = verify the real payment first, then atomically add coins and mark the request approved.
create or replace function public.approve_topup(p_request_id uuid, p_note text default '')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.topup_requests%rowtype;
  new_coins bigint;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;

  select * into r
  from public.topup_requests
  where id = p_request_id
  for update;

  if r.id is null then raise exception 'top-up request not found'; end if;
  if r.status <> 'pending' then raise exception 'request already processed'; end if;

  insert into public.guest_wallets(guest_key, username)
  values (r.guest_key, r.player_name)
  on conflict (guest_key) do nothing;

  update public.guest_wallets
  set coins = coins + r.amount, updated_at = now()
  where guest_key = r.guest_key
  returning coins into new_coins;

  update public.topup_requests
  set status = 'approved', admin_note = nullif(left(coalesce(p_note,''),500),''), approved_by = auth.uid(), approved_at = now()
  where id = r.id;

  return new_coins;
end;
$$;

grant execute on function public.approve_topup(uuid,text) to authenticated;

create or replace function public.reject_topup(p_request_id uuid, p_note text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare changed integer;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  update public.topup_requests
  set status = 'rejected', admin_note = nullif(left(coalesce(p_note,''),500),''), approved_by = auth.uid(), approved_at = now()
  where id = p_request_id and status = 'pending';
  get diagnostics changed = row_count;
  if changed = 0 then raise exception 'request not found or already processed'; end if;
  return true;
end;
$$;

grant execute on function public.reject_topup(uuid,text) to authenticated;
