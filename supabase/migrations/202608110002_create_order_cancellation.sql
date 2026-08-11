create or replace function public.request_order_cancel(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if auth.uid() is null then
    raise exception 'LOGIN_REQUIRED';
  end if;

  select status
    into current_status
    from public.orders
   where id = p_order_id
     and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if current_status = 'cancel_requested' then
    return current_status;
  end if;

  if current_status = 'payment_pending' then
    update public.orders
       set status = 'cancelled',
           payment_status = 'cancelled',
           cancelled_at = now()
     where id = p_order_id;

    return 'cancelled';
  end if;

  if current_status not in ('paid', 'accepted') then
    raise exception 'CANCELLATION_NOT_ALLOWED';
  end if;

  update public.orders
     set status = 'cancel_requested'
   where id = p_order_id;

  return 'cancel_requested';
end;
$$;

revoke all on function public.request_order_cancel(uuid) from public, anon;
grant execute on function public.request_order_cancel(uuid) to authenticated;
