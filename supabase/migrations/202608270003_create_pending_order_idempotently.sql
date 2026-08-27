-- 사용자별 잠금 안에서 결제 대기 주문을 생성해 동시 요청도 한 건으로 합칩니다.
create or replace function public.create_pending_payment_order(
  p_user_id uuid,
  p_request_id text,
  p_total_amount integer,
  p_pickup_at timestamptz,
  p_pickup_type text
)
returns table(order_id uuid, order_number text, was_created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_number text;
begin
  if p_user_id is null
    or p_request_id !~ '^[A-Za-z0-9_-]{16,100}$'
    or p_total_amount < 100
    or p_pickup_type not in ('asap', 'scheduled') then
    raise exception 'INVALID_PAYMENT_REQUEST';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select id, public.orders.order_number
  into v_order_id, v_order_number
  from public.orders
  where user_id = p_user_id
    and checkout_request_id = p_request_id
  limit 1;

  if found then
    return query select v_order_id, v_order_number, false;
    return;
  end if;

  update public.orders
  set status = 'cancelled',
      payment_status = 'cancelled',
      cancellation_reason = '새 결제 요청으로 자동 취소',
      cancelled_at = now()
  where user_id = p_user_id
    and status = 'payment_pending'
    and payment_status in ('pending', 'failed');

  insert into public.orders (
    user_id, status, payment_status, total_amount,
    pickup_at, pickup_type, checkout_request_id
  ) values (
    p_user_id, 'payment_pending', 'pending', p_total_amount,
    p_pickup_at, p_pickup_type, p_request_id
  )
  returning id, public.orders.order_number
  into v_order_id, v_order_number;

  return query select v_order_id, v_order_number, true;
end;
$$;

revoke all on function public.create_pending_payment_order(uuid, text, integer, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.create_pending_payment_order(uuid, text, integer, timestamptz, text)
  to service_role;

