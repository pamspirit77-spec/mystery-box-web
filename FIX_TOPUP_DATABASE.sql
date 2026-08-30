-- Mystery Box: FIX existing topup_requests schema
-- Run this ONCE in Supabase SQL Editor.
-- Fixes: "Could not find the 'proof_path' column..." and installs admin approval RPCs.

alter table public.topup_requests
  add column if not exists proof_path text;

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
  v_amount integer; v_user_id uuid; v_status text; v_new_balance bigint;
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
    set coins = coalesce(coins, 0) + v_amount, updated_at = now()
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
    return (select coalesce(coins,0) from public.profiles where id=v_user_id);
  end if;
end;
$$;

revoke all on function public.admin_list_topups() from public;
grant execute on function public.admin_list_topups() to authenticated;
revoke all on function public.admin_review_topup(uuid, boolean) from public;
grant execute on function public.admin_review_topup(uuid, boolean) to authenticated;
