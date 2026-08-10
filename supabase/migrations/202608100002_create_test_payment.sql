-- Development-only payment simulator. Replace this function with a real
-- payment-verifying Edge Function before production launch.
create or replace function public.create_test_order(p_items jsonb)
returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_total integer;
begin
  if v_user_id is null then
    raise exception 'LOGIN_REQUIRED';
  end if;

  if jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 30 then
    raise exception 'INVALID_CART';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item
    where nullif(trim(item->>'menu_name'), '') is null
      or (item->>'menu_id')::integer < 1
      or (item->>'temperature') not in ('HOT', 'ICE')
      or (item->>'quantity')::integer not between 1 and 30
      or (item->>'unit_price')::integer not between 0 and 1000000
  ) then
    raise exception 'INVALID_ITEM';
  end if;

  select sum((item->>'unit_price')::integer * (item->>'quantity')::integer)
  into v_total
  from jsonb_array_elements(p_items) as item;

  insert into public.orders (
    user_id, status, payment_status, total_amount, payment_method, paid_at
  ) values (
    v_user_id, 'paid', 'paid', v_total, 'TEST', now()
  )
  returning id, public.orders.order_number into v_order_id, v_order_number;

  update public.orders
  set payment_key = 'test_' || replace(v_order_id::text, '-', '')
  where id = v_order_id;

  insert into public.order_items (
    order_id, menu_id, menu_name, temperature, extra_shot,
    soy_milk, personal_tumbler, quantity, unit_price
  )
  select
    v_order_id,
    (item->>'menu_id')::integer,
    trim(item->>'menu_name'),
    item->>'temperature',
    coalesce((item->>'extra_shot')::boolean, false),
    coalesce((item->>'soy_milk')::boolean, false),
    coalesce((item->>'personal_tumbler')::boolean, false),
    (item->>'quantity')::integer,
    (item->>'unit_price')::integer
  from jsonb_array_elements(p_items) as item;

  return query select v_order_id, v_order_number;
end;
$$;

revoke all on function public.create_test_order(jsonb) from public;
revoke all on function public.create_test_order(jsonb) from anon;
grant execute on function public.create_test_order(jsonb) to authenticated;
