-- Mystery Box 3D — Top-up migration for authenticated users
-- Run AFTER supabase-setup.sql.
-- Players submit either a Wallet link or a 14-digit TrueMoney card code.
-- Admin approval atomically adds coins to public.profiles.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('wallet','card')),
  amount integer not null check (amount >= 10),
  wallet_link text,
  card_code text,
  proof_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (method = 'wallet' and wallet_link is not null and wallet_link ~* '^https?://' and card_code is null)
    or
    (method = 'card' and card_code is not null and card_code ~ '^[0-9]{14}$' and wallet_link is null)
  )
);


-- IMPORTANT: Existing installations may already have topup_requests without proof_path.
-- Add the column safely so the admin RPC schema matches old databases.
alter table public.topup_requests
  add column if not exists proof_path text;

alter table public.topup_requests enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "topup_insert_own" on public.topup_requests;
create policy "topup_insert_own" on public.topup_requests
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "topup_select_own" on public.topup_requests;
create policy "topup_select_own" on public.topup_requests
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "admin_users_select_own" on public.admin_users;
create policy "admin_users_select_own" on public.admin_users
for select to authenticated using (auth.uid() = user_id);

create index if not exists topup_requests_status_created_idx
on public.topup_requests(status, created_at desc);

create or replace function public.admin_list_topups()
returns table (
  id uuid, user_id uuid, username text, method text, amount integer, wallet_link text,
  card_code text, proof_path text, status text, created_at timestamptz, reviewed_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()) then
    raise exception 'not_admin';
  end if;
  return query
  select t.id, t.user_id, p.username, t.method, t.amount, t.wallet_link, t.card_code,
         t.proof_path, t.status, t.created_at, t.reviewed_at
  from public.topup_requests t
  left join public.profiles p on p.id = t.user_id
  order by t.created_at desc;
end;
$$;

create or replace function public.admin_review_topup(p_topup_id uuid, p_approve boolean)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_amount integer;
  v_user_id uuid;
  v_status text;
  v_new_balance bigint;
begin
  if not exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()) then
    raise exception 'not_admin';
  end if;

  select amount, user_id, status into v_amount, v_user_id, v_status
  from public.topup_requests where id = p_topup_id for update;

  if v_user_id is null then raise exception 'topup_not_found'; end if;
  if v_status <> 'pending' then raise exception 'already_reviewed'; end if;

  if p_approve then
    update public.profiles
    set coins = coins + v_amount, updated_at = now()
    where id = v_user_id
    returning coins into v_new_balance;

    if v_new_balance is null then raise exception 'profile_not_found'; end if;

    update public.topup_requests
    set status='approved', reviewed_by=auth.uid(), reviewed_at=now()
    where id=p_topup_id;

    return v_new_balance;
  else
    update public.topup_requests
    set status='rejected', reviewed_by=auth.uid(), reviewed_at=now()
    where id=p_topup_id;

    return (select coins from public.profiles where id=v_user_id);
  end if;
end;
$$;

revoke all on function public.admin_list_topups() from public;
grant execute on function public.admin_list_topups() to authenticated;
revoke all on function public.admin_review_topup(uuid, boolean) from public;
grant execute on function public.admin_review_topup(uuid, boolean) to authenticated;
