-- Remove development bootstrap paths before production use. Existing rows in
-- admin_users are preserved; new administrators must be added deliberately.
revoke all on function public.claim_first_admin() from public, anon, authenticated;
drop function if exists public.claim_first_admin();

-- The old simulator trusted item names and prices supplied by the client.
revoke all on function public.create_test_order(jsonb) from public, anon, authenticated;

-- Payment confirmation is claimed before contacting Toss. This prevents a
-- cancellation and a successful charge from racing each other.
alter table public.orders
  drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check check (
    payment_status in ('pending', 'confirming', 'paid', 'cancelled', 'refunded', 'failed')
  );

-- Cancellation is handled only by cancel-payment, which verifies ownership or
-- admin membership and performs the Toss refund before finalizing the order.
revoke all on function public.request_order_cancel(uuid, text) from public, anon, authenticated;

-- Keep user-controlled profile metadata small and predictable before storing it.
create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.member_profiles (user_id, nickname, created_at)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'nickname'), ''), '힘내개 손님'), 40),
    new.created_at
  )
  on conflict (user_id) do update set
    nickname = excluded.nickname;
  return new;
end;
$$;

update public.member_profiles
set nickname = left(nickname, 40)
where length(nickname) > 40;

-- Trigger functions are invoked by PostgreSQL itself and should not be exposed
-- as callable API functions.
revoke all on function public.handle_new_member() from public, anon, authenticated;
revoke all on function public.assign_daily_order_number() from public, anon, authenticated;

-- menu-images is already a public bucket, so public URLs continue to work
-- without a broad SELECT policy that also permits listing every object.
drop policy if exists "public can read menu images" on storage.objects;

-- Admin clients may read orders, but all state changes must pass through a
-- narrowly scoped function so payment and ownership fields cannot be changed.
drop policy if exists "admins can update all orders" on public.orders;

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
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ADMIN_ACCESS_DENIED';
  end if;

  select status
  into v_current_status
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

  return p_next_status;
end;
$$;

revoke all on function public.advance_order_status(uuid, text, text) from public, anon;
grant execute on function public.advance_order_status(uuid, text, text) to authenticated;

-- Member status and notes are already changed through update_member_management.
-- Removing the table-wide update policy prevents arbitrary profile edits.
drop policy if exists "admins can update member profiles" on public.member_profiles;

-- Notification readers may only mark their own rows as read. They must not be
-- able to rewrite notification titles, bodies, statuses, or order references.
drop policy if exists "customers can mark own notifications read" on public.order_notifications;

create or replace function public.mark_order_notification_read(
  p_notification_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'LOGIN_REQUIRED';
  end if;

  update public.order_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = auth.uid();

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.mark_all_order_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'LOGIN_REQUIRED';
  end if;

  update public.order_notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.mark_order_notification_read(bigint) from public, anon;
revoke all on function public.mark_all_order_notifications_read() from public, anon;
grant execute on function public.mark_order_notification_read(bigint) to authenticated;
grant execute on function public.mark_all_order_notifications_read() to authenticated;

-- A device token belongs to only the currently signed-in account. Reassigning
-- it on login prevents a shared phone from receiving the previous user's push.
delete from public.push_tokens older
using public.push_tokens newer
where older.expo_push_token = newer.expo_push_token
  and (older.updated_at, older.id) < (newer.updated_at, newer.id);

create unique index if not exists push_tokens_token_idx
  on public.push_tokens (expo_push_token);

drop policy if exists "customers can insert own push tokens" on public.push_tokens;
drop policy if exists "customers can update own push tokens" on public.push_tokens;

create or replace function public.register_push_token(
  p_expo_push_token text,
  p_platform text,
  p_device_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'LOGIN_REQUIRED';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'INVALID_PLATFORM';
  end if;
  if length(p_expo_push_token) > 255
    or p_expo_push_token !~ '^(Exponent|Expo)PushToken\[[^]]+\]$' then
    raise exception 'INVALID_PUSH_TOKEN';
  end if;

  insert into public.push_tokens (
    user_id, expo_push_token, platform, device_name, updated_at
  ) values (
    auth.uid(), p_expo_push_token, p_platform, left(p_device_name, 200), now()
  )
  on conflict (expo_push_token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    device_name = excluded.device_name,
    updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(
  p_expo_push_token text
)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens
  where user_id = auth.uid()
    and expo_push_token = p_expo_push_token;
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Allow a signed-in customer to remove only their own device token on logout.
drop policy if exists "customers can delete own push tokens" on public.push_tokens;
create policy "customers can delete own push tokens"
on public.push_tokens for delete to authenticated
using (user_id = (select auth.uid()));
