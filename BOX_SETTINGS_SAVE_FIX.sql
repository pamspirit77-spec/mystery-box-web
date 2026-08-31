-- Mystery Box 3D — reliable admin save for box/reward settings
-- Run this ONCE in Supabase SQL Editor.
-- This only changes the box_settings admin save path and its RLS policies.

alter table public.box_settings enable row level security;

-- Public/player read: the game must be able to read the active box settings.
drop policy if exists "box_settings_public_read" on public.box_settings;
create policy "box_settings_public_read"
on public.box_settings
for select
to anon, authenticated
using (true);

-- Keep direct writes available only to authenticated admins as a fallback.
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

-- Reliable server-side save path used by the Admin page.
create or replace function public.admin_save_box_settings_v2(
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.box_settings;
  v_total numeric := 0;
  v_item jsonb;
  v_rewards jsonb := '[]'::jsonb;
  v_rate numeric;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_id not in ('box1','box2','box3','box4','box5') then raise exception 'invalid_box_id'; end if;
  if nullif(trim(coalesce(p_name,'')),'') is null then raise exception 'box_name_required'; end if;
  if p_price is null or p_price < 0 then raise exception 'invalid_box_price'; end if;
  if jsonb_typeof(coalesce(p_rewards,'[]'::jsonb)) <> 'array' then raise exception 'rewards_must_be_array'; end if;

  for v_item in select value from jsonb_array_elements(p_rewards) loop
    if nullif(trim(coalesce(v_item->>'id','')),'') is null then raise exception 'reward_id_required'; end if;
    if nullif(trim(coalesce(v_item->>'name','')),'') is null then raise exception 'reward_name_required'; end if;
    begin
      v_rate := coalesce(nullif(trim(v_item->>'drop_rate'), '')::numeric, 0);
    exception when invalid_text_representation then
      raise exception 'invalid_drop_rate';
    end;
    if v_rate < 0 then raise exception 'invalid_drop_rate'; end if;
    v_total := v_total + v_rate;
    v_rewards := v_rewards || jsonb_build_array(jsonb_build_object(
      'id', trim(v_item->>'id'),
      'name', trim(v_item->>'name'),
      'rarity', coalesce(nullif(trim(v_item->>'rarity'),''), coalesce(nullif(trim(p_rarity),''),'COMMON')),
      'drop_rate', v_rate,
      'image_url', coalesce(v_item->>'image_url','')
    ));
  end loop;

  if jsonb_array_length(v_rewards) = 0 then raise exception 'at_least_one_reward_required'; end if;
  if abs(v_total - 100) > 0.001 then
    raise exception 'drop_rate_total_must_be_100: %', v_total;
  end if;

  insert into public.box_settings
    (id,name,en,price,rarity,color,accent,icon,rewards,updated_at,updated_by)
  values
    (p_id,trim(p_name),coalesce(p_en,''),p_price,
     coalesce(nullif(trim(p_rarity),''),'COMMON'),
     coalesce(p_color,9080486),coalesce(p_accent,7119497),
     coalesce(nullif(p_icon,''),'🎁'),v_rewards,now(),auth.uid())
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

revoke all on function public.admin_save_box_settings_v2(text,text,text,integer,text,bigint,bigint,text,jsonb) from public;
grant execute on function public.admin_save_box_settings_v2(text,text,text,integer,text,bigint,bigint,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
