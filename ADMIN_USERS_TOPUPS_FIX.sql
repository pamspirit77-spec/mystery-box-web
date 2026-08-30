-- Mystery Box Admin: users + topups fix for the EXISTING schema.
-- Does not delete tables or rows. Run this whole file in Supabase SQL Editor.

-- Admin check
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id=auth.uid()
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ============================================================
-- TOP-UP LIST FOR ADMIN
-- Existing columns: id bigint, user_id uuid, method, amount,
-- wallet_link, card_code, proof_image, status, admin_id,
-- admin_note, created_at, reviewed_at.
-- ============================================================
drop function if exists public.admin_list_topups();
create function public.admin_list_topups()
returns table (
  id bigint,
  user_id uuid,
  username text,
  method text,
  amount integer,
  wallet_link text,
  card_code text,
  proof_image text,
  status text,
  admin_id uuid,
  admin_note text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
  select t.id,
         t.user_id,
         coalesce(p.username,'ไม่ทราบชื่อ')::text,
         t.method,
         t.amount::integer,
         t.wallet_link,
         t.card_code,
         t.proof_image,
         t.status,
         t.admin_id,
         t.admin_note,
         t.created_at,
         t.reviewed_at
  from public.topup_requests t
  left join public.profiles p on p.id=t.user_id
  order by case when t.status='pending' then 0 else 1 end,
           t.created_at desc;
end;
$$;
revoke all on function public.admin_list_topups() from public;
grant execute on function public.admin_list_topups() to authenticated;

-- ============================================================
-- ALL USERS WITH REAL PAGINATION
-- 20 users per page from the database, so it can continue to
-- page 1,2,3,... without loading every player into the browser.
-- Email comes from auth.users and is only exposed through this
-- SECURITY DEFINER admin-only RPC.
-- ============================================================
drop function if exists public.admin_list_users();

drop function if exists public.admin_list_users(integer, integer, text);

create function public.admin_list_users(
  p_page integer default 1,
  p_page_size integer default 20,
  p_search text default ''
)
returns table (
  id uuid,
  username text,
  coins bigint,
  email text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql security definer set search_path=public
as $$
declare
  v_page integer := greatest(coalesce(p_page,1),1);
  v_size integer := least(greatest(coalesce(p_page_size,20),1),100);
  v_search text := lower(trim(coalesce(p_search,'')));
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  return query
  with base as (
    select p.id,
           coalesce(p.username,'ไม่มีชื่อ')::text as username,
           p.coins,
           coalesce(u.email,'')::text as email,
           p.created_at
    from public.profiles p
    left join auth.users u on u.id=p.id
    where v_search='' or
      lower(coalesce(p.username,'')) like '%'||v_search||'%' or
      lower(coalesce(u.email,'')) like '%'||v_search||'%' or
      lower(p.id::text) like '%'||v_search||'%'
  )
  select b.id,b.username,b.coins,b.email,b.created_at,
         count(*) over()::bigint as total_count
  from base b
  order by b.created_at desc, b.id desc
  offset (v_page-1)*v_size
  limit v_size;
end;
$$;
revoke all on function public.admin_list_users(integer,integer,text) from public;
grant execute on function public.admin_list_users(integer,integer,text) to authenticated;

-- ============================================================
-- COIN ADJUSTMENT (keep existing behavior)
-- ============================================================
drop function if exists public.admin_adjust_coins(uuid,bigint);
create function public.admin_adjust_coins(p_user_id uuid, p_delta bigint)
returns bigint
language plpgsql security definer set search_path=public
as $$
declare v_new bigint;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_delta=0 or abs(p_delta)>1000000 then raise exception 'invalid_delta'; end if;
  update public.profiles
    set coins=greatest(0,coins+p_delta), updated_at=now()
    where id=p_user_id
    returning coins into v_new;
  if v_new is null then raise exception 'profile_not_found'; end if;
  return v_new;
end;
$$;
revoke all on function public.admin_adjust_coins(uuid,bigint) from public;
grant execute on function public.admin_adjust_coins(uuid,bigint) to authenticated;

notify pgrst,'reload schema';
