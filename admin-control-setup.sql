-- Mystery Box 3D — Admin Control migration
-- Run AFTER supabase-setup.sql.
-- This migration uses the authenticated profiles/topup_requests schema already used by the game.

create table if not exists public.site_settings (
  id integer primary key check (id = 1),
  maintenance_mode boolean not null default false,
  announcement text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.site_settings(id) values (1)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read"
on public.site_settings for select
to anon, authenticated
using (id = 1);

drop policy if exists "site_settings_admin_update" on public.site_settings;
create policy "site_settings_admin_update"
on public.site_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- Single secure admin check used by the dashboard and RLS policies.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Admin dashboard: all top-up requests, including username.
create or replace function public.admin_list_topups()
returns table (
  id uuid, user_id uuid, username text, method text, amount integer,
  wallet_link text, card_code text, proof_path text, status text,
  created_at timestamptz, reviewed_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()) then
    raise exception 'not_admin';
  end if;

  return query
  select t.id, t.user_id, coalesce(p.username, 'Unknown')::text,
         t.method, t.amount, t.wallet_link, t.card_code, t.proof_path,
         t.status, t.created_at, t.reviewed_at
  from public.topup_requests t
  left join public.profiles p on p.id = t.user_id
  order by t.created_at desc;
end;
$$;

revoke all on function public.admin_list_topups() from public;
grant execute on function public.admin_list_topups() to authenticated;

-- Admin dashboard: user list.
create or replace function public.admin_list_users()
returns table (
  id uuid, username text, coins bigint, email text, created_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()) then
    raise exception 'not_admin';
  end if;

  return query
  select p.id, p.username, p.coins,
         coalesce(u.email, '')::text, p.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

-- Admin can add/remove coins. Balance can never become negative.
create or replace function public.admin_adjust_coins(p_user_id uuid, p_delta bigint)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_new bigint;
begin
  if not exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()) then
    raise exception 'not_admin';
  end if;
  if p_delta = 0 or abs(p_delta) > 1000000 then
    raise exception 'invalid_delta';
  end if;

  update public.profiles
  set coins = greatest(0, coins + p_delta), updated_at = now()
  where id = p_user_id
  returning coins into v_new;

  if v_new is null then raise exception 'profile_not_found'; end if;
  return v_new;
end;
$$;

revoke all on function public.admin_adjust_coins(uuid,bigint) from public;
grant execute on function public.admin_adjust_coins(uuid,bigint) to authenticated;

-- Site settings can be read by the game without exposing admin permissions.
revoke all on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant update on table public.site_settings to authenticated;

-- Make sure only admins can read proof files.
drop policy if exists "topup_proof_select_admin" on storage.objects;
drop policy if exists "topup_proof_admin_read" on storage.objects;
create policy "topup_proof_admin_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'topup-proofs'
  and exists (select 1 from public.admin_users a where a.user_id = auth.uid())
);
