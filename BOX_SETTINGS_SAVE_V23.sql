-- Mystery Box 3D — V23 box settings save/storage policy fix
-- Run once in Supabase SQL Editor. Only affects box_settings and its image bucket.

alter table public.box_settings enable row level security;

drop policy if exists "box_settings_admin_update" on public.box_settings;
create policy "box_settings_admin_update"
on public.box_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "box_settings_admin_insert" on public.box_settings;
create policy "box_settings_admin_insert"
on public.box_settings for insert
to authenticated
with check (public.is_admin());

grant select, update, insert on public.box_settings to authenticated;
grant select on public.box_settings to anon;

insert into storage.buckets (id,name,public) values ('box-reward-images','box-reward-images',true)
on conflict (id) do update set public=true;

drop policy if exists "box_reward_images_admin_insert" on storage.objects;
create policy "box_reward_images_admin_insert" on storage.objects for insert to authenticated
with check (bucket_id='box-reward-images' and public.is_admin());

drop policy if exists "box_reward_images_admin_update" on storage.objects;
create policy "box_reward_images_admin_update" on storage.objects for update to authenticated
using (bucket_id='box-reward-images' and public.is_admin())
with check (bucket_id='box-reward-images' and public.is_admin());

drop policy if exists "box_reward_images_admin_delete" on storage.objects;
create policy "box_reward_images_admin_delete" on storage.objects for delete to authenticated
using (bucket_id='box-reward-images' and public.is_admin());

drop policy if exists "box_reward_images_public_read" on storage.objects;
create policy "box_reward_images_public_read" on storage.objects for select to public
using (bucket_id='box-reward-images');

notify pgrst,'reload schema';
