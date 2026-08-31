-- Mystery Box 3D — FINAL box settings save fix
-- Run this file ONCE in Supabase SQL Editor.
-- This changes ONLY the Admin save path for public.box_settings.

create or replace function public.admin_save_all_box_settings(p_boxes jsonb)
returns setof public.box_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_box jsonb;
  v_item jsonb;
  v_row public.box_settings;
  v_rewards jsonb;
  v_rate numeric;
  v_total numeric;
  v_id text;
  v_name text;
  v_en text;
  v_price integer;
  v_rarity text;
  v_color bigint;
  v_accent bigint;
  v_icon text;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  if jsonb_typeof(coalesce(p_boxes,'[]'::jsonb)) <> 'array' then
    raise exception 'boxes_must_be_array';
  end if;

  if jsonb_array_length(p_boxes) <> 5 then
    raise exception 'exactly_5_boxes_required';
  end if;

  -- Validate the complete payload BEFORE changing the database.
  for v_box in select value from jsonb_array_elements(p_boxes) loop
    v_id := trim(coalesce(v_box->>'id',''));
    v_name := trim(coalesce(v_box->>'name',''));
    v_en := coalesce(v_box->>'en','');
    v_price := coalesce((v_box->>'price')::integer,0);
    v_rarity := coalesce(nullif(trim(v_box->>'rarity'),''),'COMMON');
    v_color := coalesce((v_box->>'color')::bigint,9080486);
    v_accent := coalesce((v_box->>'accent')::bigint,7119497);
    v_icon := coalesce(nullif(v_box->>'icon',''),'🎁');

    if v_id not in ('box1','box2','box3','box4','box5') then
      raise exception 'invalid_box_id: %',v_id;
    end if;
    if v_name = '' then raise exception 'box_name_required: %',v_id; end if;
    if v_price < 0 then raise exception 'invalid_box_price: %',v_id; end if;
    if jsonb_typeof(coalesce(v_box->'rewards','[]'::jsonb)) <> 'array' then
      raise exception 'rewards_must_be_array: %',v_id;
    end if;

    v_total := 0;
    if jsonb_array_length(coalesce(v_box->'rewards','[]'::jsonb)) = 0 then
      raise exception 'at_least_one_reward_required: %',v_id;
    end if;

    for v_item in select value from jsonb_array_elements(v_box->'rewards') loop
      if trim(coalesce(v_item->>'id','')) = '' then raise exception 'reward_id_required: %',v_id; end if;
      if trim(coalesce(v_item->>'name','')) = '' then raise exception 'reward_name_required: %',v_id; end if;
      begin
        v_rate := coalesce(nullif(trim(v_item->>'drop_rate'),'')::numeric,0);
      exception when invalid_text_representation then
        raise exception 'invalid_drop_rate: %',v_id;
      end;
      if v_rate < 0 then raise exception 'invalid_drop_rate: %',v_id; end if;
      v_total := v_total + v_rate;
    end loop;

    if abs(v_total - 100) > 0.001 then
      raise exception 'drop_rate_total_must_be_100: % = %',v_id,v_total;
    end if;
  end loop;

  -- All validation passed. Replace all five rows atomically.
  for v_box in select value from jsonb_array_elements(p_boxes) loop
    v_id := trim(v_box->>'id');
    v_name := trim(v_box->>'name');
    v_en := coalesce(v_box->>'en','');
    v_price := coalesce((v_box->>'price')::integer,0);
    v_rarity := coalesce(nullif(trim(v_box->>'rarity'),''),'COMMON');
    v_color := coalesce((v_box->>'color')::bigint,9080486);
    v_accent := coalesce((v_box->>'accent')::bigint,7119497);
    v_icon := coalesce(nullif(v_box->>'icon',''),'🎁');

    v_rewards := '[]'::jsonb;
    for v_item in select value from jsonb_array_elements(v_box->'rewards') loop
      v_rate := coalesce(nullif(trim(v_item->>'drop_rate'),'')::numeric,0);
      v_rewards := v_rewards || jsonb_build_array(jsonb_build_object(
        'id',trim(v_item->>'id'),
        'name',trim(v_item->>'name'),
        'rarity',coalesce(nullif(trim(v_item->>'rarity'),''),v_rarity),
        'drop_rate',v_rate,
        'image_url',coalesce(v_item->>'image_url','')
      ));
    end loop;

    insert into public.box_settings
      (id,name,en,price,rarity,color,accent,icon,rewards,updated_at,updated_by)
    values
      (v_id,v_name,v_en,v_price,v_rarity,v_color,v_accent,v_icon,v_rewards,now(),auth.uid())
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
      updated_by=auth.uid();
  end loop;

  return query
    select * from public.box_settings
    where id in ('box1','box2','box3','box4','box5')
    order by id;
end;
$$;

revoke all on function public.admin_save_all_box_settings(jsonb) from public;
grant execute on function public.admin_save_all_box_settings(jsonb) to authenticated;

-- Keep player/admin reads available.
alter table public.box_settings enable row level security;
drop policy if exists "box_settings_public_read" on public.box_settings;
create policy "box_settings_public_read"
on public.box_settings for select
to anon, authenticated
using (true);

grant select on public.box_settings to anon, authenticated;

notify pgrst,'reload schema';
