-- Mystery Box 3D — direct Admin save fix
-- Run this ONCE in Supabase SQL Editor.
-- Only changes RLS for public.box_settings.

alter table public.box_settings enable row level security;

drop policy if exists "box_settings_admin_insert" on public.box_settings;
create policy "box_settings_admin_insert"
on public.box_settings
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "box_settings_admin_update" on public.box_settings;
create policy "box_settings_admin_update"
on public.box_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "box_settings_public_read" on public.box_settings;
create policy "box_settings_public_read"
on public.box_settings
for select
to anon, authenticated
using (true);

notify pgrst, 'reload schema';
