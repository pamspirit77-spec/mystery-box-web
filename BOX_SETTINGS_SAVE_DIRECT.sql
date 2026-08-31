-- Mystery Box 3D — FINAL direct save fix for Admin box settings
-- Run this ONCE in Supabase SQL Editor.
-- Only changes write access for public.box_settings.

create or replace function public.box_settings_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  );
$$;

revoke all on function public.box_settings_is_admin() from public;
grant execute on function public.box_settings_is_admin() to authenticated;

drop policy if exists "box_settings_admin_insert" on public.box_settings;
create policy "box_settings_admin_insert"
on public.box_settings
for insert
to authenticated
with check (public.box_settings_is_admin());

drop policy if exists "box_settings_admin_update" on public.box_settings;
create policy "box_settings_admin_update"
on public.box_settings
for update
to authenticated
using (public.box_settings_is_admin())
with check (public.box_settings_is_admin());

-- Keep public read so the player game can load the active box settings.
drop policy if exists "box_settings_public_read" on public.box_settings;
create policy "box_settings_public_read"
on public.box_settings
for select
to anon, authenticated
using (true);

grant select on public.box_settings to anon, authenticated;
grant insert, update on public.box_settings to authenticated;

notify pgrst, 'reload schema';
