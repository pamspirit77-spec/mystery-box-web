-- Fix only authenticated player coin spending.
-- Run once in Supabase SQL Editor. This does not delete or alter existing tables/data.

create or replace function public.spend_my_coins(p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance bigint;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  update public.profiles
     set coins = coins - p_amount,
         updated_at = now()
   where id = auth.uid()
     and coins >= p_amount
   returning coins into v_new_balance;

  if v_new_balance is null then
    if not exists (select 1 from public.profiles where id = auth.uid()) then
      raise exception 'profile_not_found';
    end if;
    raise exception 'เหรียญไม่เพียงพอ';
  end if;

  return v_new_balance;
end;
$$;

revoke all on function public.spend_my_coins(bigint) from public;
grant execute on function public.spend_my_coins(bigint) to authenticated;
