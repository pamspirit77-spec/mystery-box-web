-- V25: Admin box settings save fix.
-- Run once in Supabase SQL Editor.
-- Only affects public.box_settings write path and the admin save RPC.

create or replace function public.admin_save_box_settings_direct(
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
  v_item jsonb;
  v_rewards jsonb := '[]'::jsonb;
  v_rate numeric;
  v_total numeric := 0;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'not_admin';
  end if;
  if p_id not in ('box1','box2','box3','box4','box5') then raise exception 'invalid_box_id'; end if;
  if nullif(trim(coalesce(p_name,'')),'') is null then raise exception 'box_name_required'; end if;
  if p_price is null or p_price < 0 then raise exception 'invalid_box_price'; end if;
  if jsonb_typeof(coalesce(p_rewards,'[]'::jsonb)) <> 'array' then raise exception 'rewards_must_be_array'; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_rewards,'[]'::jsonb)) loop
    if nullif(trim(coalesce(v_item->>'id','')),'') is null then raise exception 'reward_id_required'; end if;
    if nullif(trim(coalesce(v_item->>'name','')),'') is null then raise exception 'reward_name_required'; end if;
    begin
      v_rate := coalesce(nullif(trim(v_item->>'drop_rate'),'')::numeric,0);
    exception when invalid_text_representation then
      raise exception 'invalid_drop_rate';
    end;
    if v_rate < 0 then raise exception 'invalid_drop_rate'; end if;
    v_total := v_total + v_rate;
    v_rewards := v_rewards || jsonb_build_array(jsonb_build_object(
      'id',trim(v_item->>'id'),
      'name',trim(v_item->>'name'),
      'rarity',coalesce(nullif(trim(v_item->>'rarity'),''),coalesce(nullif(trim(p_rarity),''),'COMMON')),
      'drop_rate',v_rate,
      'image_url',coalesce(v_item->>'image_url','')
    ));
  end loop;

  if jsonb_array_length(v_rewards)=0 then raise exception 'at_least_one_reward_required'; end if;
  if v_total <= 0 then raise exception 'drop_rate_total_must_be_positive'; end if;

  update public.box_settings
  set name=trim(p_name),
      en=coalesce(p_en,''),
      price=p_price,
      rarity=coalesce(nullif(trim(p_rarity),''),'COMMON'),
      color=coalesce(p_color,9080486),
      accent=coalesce(p_accent,7119497),
      icon=coalesce(nullif(p_icon,''),'🎁'),
      rewards=v_rewards,
      updated_at=now(),
      updated_by=auth.uid()
  where id=p_id
  returning * into v_row;

  if not found then raise exception 'box_not_found'; end if;
  return v_row;
end;
$$;

revoke all on function public.admin_save_box_settings_direct(text,text,text,integer,text,bigint,bigint,text,jsonb) from public;
grant execute on function public.admin_save_box_settings_direct(text,text,text,integer,text,bigint,bigint,text,jsonb) to authenticated;

-- Fallback path used only if the RPC is unavailable.
create or replace function public.box_settings_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.box_settings_is_admin() from public;
grant execute on function public.box_settings_is_admin() to authenticated;

drop policy if exists "box_settings_admin_update" on public.box_settings;
create policy "box_settings_admin_update"
on public.box_settings for update
to authenticated
using (public.box_settings_is_admin())
with check (public.box_settings_is_admin());

grant update on public.box_settings to authenticated;
notify pgrst, 'reload schema';
