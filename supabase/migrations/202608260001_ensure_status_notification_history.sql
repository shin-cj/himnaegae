-- 주문 상태 변경과 알림 이력 저장을 한 트랜잭션에서 처리합니다.
-- 푸시 서비스가 일시적으로 실패해도 고객 알림센터에는 상태 변경이 남습니다.
create or replace function public.advance_order_status(
  p_order_id uuid,
  p_expected_status text,
  p_next_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_status text;
  v_user_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ADMIN_ACCESS_DENIED';
  end if;

  select status, user_id
  into v_current_status, v_user_id
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_current_status <> p_expected_status then
    raise exception 'ORDER_STATUS_CHANGED';
  end if;

  if not (
    (p_expected_status in ('paid', 'accepted') and p_next_status = 'preparing')
    or (p_expected_status = 'preparing' and p_next_status = 'ready')
    or (p_expected_status = 'ready' and p_next_status = 'picked_up')
  ) then
    raise exception 'INVALID_ORDER_TRANSITION';
  end if;

  update public.orders
  set status = p_next_status
  where id = p_order_id;

  insert into public.order_notifications (user_id, order_id, status, title, body)
  values (
    v_user_id,
    p_order_id,
    p_next_status,
    case p_next_status
      when 'preparing' then '음료를 만들고 있어요 🥤'
      when 'ready' then '픽업 준비 완료 🔔'
      when 'picked_up' then '픽업 완료'
      else '주문이 접수됐어요 ☕'
    end,
    case p_next_status
      when 'preparing' then '음료를 제조하고 있어요. 조금만 기다려주세요.'
      when 'ready' then '음료가 준비됐어요. 매장에서 픽업해주세요.'
      when 'picked_up' then '힘내개를 이용해주셔서 감사합니다.'
      else '매장에서 주문을 확인하고 있어요.'
    end
  )
  on conflict (order_id, status) do nothing;

  return p_next_status;
end;
$$;

revoke all on function public.advance_order_status(uuid, text, text) from public, anon;
grant execute on function public.advance_order_status(uuid, text, text) to authenticated;
