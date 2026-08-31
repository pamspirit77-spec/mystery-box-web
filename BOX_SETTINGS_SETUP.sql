-- Mystery Box 3D — Admin box/reward management
-- Run this once in Supabase SQL Editor.

create table if not exists public.box_settings (
  id text primary key check (id in ('box1','box2','box3','box4','box5')),
  name text not null,
  en text not null default '',
  price integer not null default 1 check (price >= 0),
  rarity text not null default 'COMMON',
  color bigint not null default 9080486,
  accent bigint not null default 7119497,
  icon text not null default '🎁',
  rewards jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.box_settings enable row level security;

-- Players can read the active box configuration. Only the admin RPC can write it.
drop policy if exists "box_settings_public_read" on public.box_settings;
create policy "box_settings_public_read"
on public.box_settings for select
using (true);

insert into public.box_settings (id,name,en,price,rarity,color,accent,icon,rewards)
values
('box1','กล่องธรรมดา','Food Box',1,'COMMON',9080486,7119497,'🍔',
 '[{"id":"box1-item1","name":"ชุดอาหารพรีเมียม","rarity":"COMMON","drop_rate":25,"image_url":""},{"id":"box1-item2","name":"ขนมนำเข้า","rarity":"COMMON","drop_rate":25,"image_url":""},{"id":"box1-item3","name":"เครื่องดื่ม","rarity":"COMMON","drop_rate":25,"image_url":""},{"id":"box1-item4","name":"บะหมี่พิเศษ","rarity":"COMMON","drop_rate":25,"image_url":""}]'::jsonb),
('box2','กล่องหายาก','Fashion Box',2,'UNCOMMON',2277376,4849904,'👕',
 '[{"id":"box2-item1","name":"เสื้อยืดแฟชั่น","rarity":"UNCOMMON","drop_rate":25,"image_url":""},{"id":"box2-item2","name":"หมวก","rarity":"UNCOMMON","drop_rate":25,"image_url":""},{"id":"box2-item3","name":"กระเป๋า","rarity":"UNCOMMON","drop_rate":25,"image_url":""},{"id":"box2-item4","name":"รองเท้า","rarity":"UNCOMMON","drop_rate":25,"image_url":""}]'::jsonb),
('box3','กล่องแรร์','Utility Box',3,'RARE',2443487,3716095,'◉',
 '[{"id":"box3-item1","name":"หูฟัง","rarity":"RARE","drop_rate":25,"image_url":""},{"id":"box3-item2","name":"แก้วเก็บอุณหภูมิ","rarity":"RARE","drop_rate":25,"image_url":""},{"id":"box3-item3","name":"อุปกรณ์โต๊ะ","rarity":"RARE","drop_rate":25,"image_url":""},{"id":"box3-item4","name":"ของใช้พรีเมียม","rarity":"RARE","drop_rate":25,"image_url":""}]'::jsonb),
('box4','กล่องอีพิค','Big Prize',4,'EPIC',9641722,12617724,'🎁',
 '[{"id":"box4-item1","name":"บัตรของขวัญ","rarity":"EPIC","drop_rate":25,"image_url":""},{"id":"box4-item2","name":"สินค้า Limited","rarity":"EPIC","drop_rate":25,"image_url":""},{"id":"box4-item3","name":"ของสะสม","rarity":"EPIC","drop_rate":25,"image_url":""},{"id":"box4-item4","name":"รางวัลพิเศษ","rarity":"EPIC","drop_rate":25,"image_url":""}]'::jsonb),
('box5','กล่องเลเจนด์','Legend Box',5,'LEGENDARY',14251010,16638297,'♛',
 '[{"id":"box5-item1","name":"iPhone 15 Pro Max","rarity":"LEGENDARY","drop_rate":25,"image_url":""},{"id":"box5-item2","name":"AirPods Pro 2","rarity":"LEGENDARY","drop_rate":25,"image_url":""},{"id":"box5-item3","name":"รางวัลใหญ่","rarity":"LEGENDARY","drop_rate":25,"image_url":""},{"id":"box5-item4","name":"สินค้า Rare","rarity":"LEGENDARY","drop_rate":25,"image_url":""}]'::jsonb)
on conflict (id) do nothing;

-- Storage bucket for reward images. Public read is intentional because the player website
-- must display uploaded reward images without exposing admin credentials.
insert into storage.buckets (id, name, public)
values ('box-reward-images','box-reward-images',true)
on conflict (id) do update set public=true;

drop policy if exists "box_reward_images_admin_insert" on storage.objects;
create policy "box_reward_images_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'box-reward-images'
  and public.is_admin()
);

drop policy if exists "box_reward_images_admin_update" on storage.objects;
create policy "box_reward_images_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'box-reward-images' and public.is_admin())
with check (bucket_id = 'box-reward-images' and public.is_admin());

drop policy if exists "box_reward_images_admin_delete" on storage.objects;
create policy "box_reward_images_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'box-reward-images' and public.is_admin());

-- Admin: fetch all five boxes.
drop function if exists public.admin_list_box_settings();
create function public.admin_list_box_settings()
returns setof public.box_settings
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query select * from public.box_settings order by id;
end;
$$;

-- Admin: replace a single box configuration. Rewards are normalized and validated.
drop function if exists public.admin_save_box_settings(text,text,text,integer,text,bigint,bigint,text,jsonb);
create function public.admin_save_box_settings(
  p_id text,
  p_name text,
  p_en text,
  p_price integer,
  p_rarity text,
  p_color bigint,
  p_accent bigint,
  p_icon text,
  p_rewards jsonb
)
returns public.box_settings
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.box_settings;
  v_rewards jsonb := '[]'::jsonb;
  v_item jsonb;
  v_total numeric := 0;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_id not in ('box1','box2','box3','box4','box5') then raise exception 'invalid_box_id'; end if;
  if nullif(trim(coalesce(p_name,'')),'') is null then raise exception 'box_name_required'; end if;
  if p_price is null or p_price < 0 then raise exception 'invalid_box_price'; end if;
  if jsonb_typeof(coalesce(p_rewards,'[]'::jsonb)) <> 'array' then raise exception 'rewards_must_be_array'; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_rewards,'[]'::jsonb)) loop
    if nullif(trim(coalesce(v_item->>'id','')),'') is null then raise exception 'reward_id_required'; end if;
    if nullif(trim(coalesce(v_item->>'name','')),'') is null then raise exception 'reward_name_required'; end if;
    if coalesce((v_item->>'drop_rate')::numeric,0) < 0 then raise exception 'invalid_drop_rate'; end if;
    v_total := v_total + coalesce((v_item->>'drop_rate')::numeric,0);
    v_rewards := v_rewards || jsonb_build_array(jsonb_build_object(
      'id', trim(v_item->>'id'),
      'name', trim(v_item->>'name'),
      'rarity', coalesce(nullif(trim(v_item->>'rarity'),''), p_rarity),
      'drop_rate', coalesce((v_item->>'drop_rate')::numeric,0),
      'image_url', coalesce(v_item->>'image_url','')
    ));
  end loop;

  if jsonb_array_length(v_rewards) = 0 then raise exception 'at_least_one_reward_required'; end if;
  if v_total <= 0 then raise exception 'drop_rate_total_must_be_positive'; end if;

  insert into public.box_settings(id,name,en,price,rarity,color,accent,icon,rewards,updated_at,updated_by)
  values (p_id,trim(p_name),coalesce(p_en,''),p_price,coalesce(nullif(trim(p_rarity),''),'COMMON'),
          coalesce(p_color,9080486),coalesce(p_accent,7119497),coalesce(nullif(p_icon,''),'🎁'),v_rewards,now(),auth.uid())
  on conflict (id) do update set
    name=excluded.name,
    en=excluded.en,
    price=excluded.price,
    rarity=excluded.rarity,
    color=excluded.color,
    accent=excluded.accent,
    icon=excluded.icon,
    rewards=excluded.rewards,
    updated_at=now(),
    updated_by=auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_list_box_settings() from public;
grant execute on function public.admin_list_box_settings() to authenticated;
revoke all on function public.admin_save_box_settings(text,text,text,integer,text,bigint,bigint,text,jsonb) from public;
grant execute on function public.admin_save_box_settings(text,text,text,integer,text,bigint,bigint,text,jsonb) to authenticated;

grant select on public.box_settings to anon, authenticated;
notify pgrst, 'reload schema';
