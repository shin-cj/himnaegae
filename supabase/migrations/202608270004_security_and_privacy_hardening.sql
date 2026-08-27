-- Final production-facing authorization and privacy baseline.

-- Consent is recorded with database time. Existing users are prompted in-app
-- instead of being silently marked as having agreed.
create table if not exists public.privacy_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  policy_version text not null,
  agreed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint privacy_consents_policy_version_length_check
    check (char_length(policy_version) between 8 and 40)
);

alter table public.privacy_consents enable row level security;

drop policy if exists "members can read own privacy consent" on public.privacy_consents;
create policy "members can read own privacy consent"
on public.privacy_consents for select to authenticated
using (user_id = (select auth.uid()));

create or replace function public.accept_privacy_policy(p_policy_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'LOGIN_REQUIRED';
  end if;
  if p_policy_version <> '2026-08-27' then
    raise exception 'INVALID_POLICY_VERSION';
  end if;

  insert into public.privacy_consents (user_id, policy_version, agreed_at, updated_at)
  values (auth.uid(), p_policy_version, now(), now())
  on conflict (user_id) do update set
    policy_version = excluded.policy_version,
    agreed_at = excluded.agreed_at,
    updated_at = now();
end;
$$;

revoke all on function public.accept_privacy_policy(text) from public, anon;
grant execute on function public.accept_privacy_policy(text) to authenticated;

-- New members who agreed during sign-up receive a server-timestamped record.
create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text := trim(coalesce(new.raw_user_meta_data->>'nickname', ''));
begin
  if char_length(v_nickname) not between 2 and 40 then
    v_nickname := '힘내개 손님';
  end if;

  insert into public.member_profiles (user_id, nickname, created_at)
  values (new.id, v_nickname, new.created_at)
  on conflict (user_id) do update set
    nickname = case
      when public.member_profiles.status = 'withdrawn' then public.member_profiles.nickname
      else excluded.nickname
    end;

  if new.raw_user_meta_data->>'privacy_consent' = 'true'
    and new.raw_user_meta_data->>'privacy_policy_version' = '2026-08-27' then
    insert into public.privacy_consents (user_id, policy_version, agreed_at, updated_at)
    values (new.id, '2026-08-27', now(), now())
    on conflict (user_id) do update set
      policy_version = excluded.policy_version,
      agreed_at = excluded.agreed_at,
      updated_at = now();
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_member() from public, anon, authenticated;

create or replace function public.handle_member_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    update public.member_profiles
    set nickname = '탈퇴한 회원',
        status = 'withdrawn',
        admin_note = '',
        withdrawn_at = coalesce(withdrawn_at, now())
    where user_id = new.id;

    delete from public.push_tokens where user_id = new.id;
    delete from public.privacy_consents where user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.handle_member_withdrawal() from public, anon, authenticated;

-- Logout from all devices removes every push destination through a narrow RPC.
create or replace function public.unregister_all_push_tokens()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if auth.uid() is null then
    raise exception 'LOGIN_REQUIRED';
  end if;

  delete from public.push_tokens where user_id = auth.uid();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.unregister_all_push_tokens() from public, anon;
grant execute on function public.unregister_all_push_tokens() to authenticated;

drop policy if exists "customers can delete own push tokens" on public.push_tokens;

-- Remove obsolete client-callable payment paths entirely.
drop function if exists public.create_test_order(jsonb);
drop function if exists public.request_order_cancel(uuid, text);

-- Defense-in-depth constraints for user-controlled text and device data.
alter table public.orders
  drop constraint if exists orders_cancellation_reason_length_check;
alter table public.orders
  add constraint orders_cancellation_reason_length_check
  check (cancellation_reason is null or char_length(cancellation_reason) <= 500);

alter table public.order_items
  drop constraint if exists order_items_menu_name_length_check;
alter table public.order_items
  add constraint order_items_menu_name_length_check
  check (char_length(menu_name) between 1 and 100);

alter table public.push_tokens
  drop constraint if exists push_tokens_value_length_check;
alter table public.push_tokens
  add constraint push_tokens_value_length_check
  check (char_length(expo_push_token) between 20 and 255);

alter table public.member_profiles
  drop constraint if exists member_profiles_admin_note_length_check;
alter table public.member_profiles
  add constraint member_profiles_admin_note_length_check
  check (char_length(admin_note) <= 500);

-- Table privileges are reduced to the exact operations used by each client.
revoke all on table public.orders, public.order_items, public.member_profiles,
  public.admin_users, public.push_tokens, public.order_notifications,
  public.daily_order_counters, public.privacy_consents
from anon, authenticated;

grant select on table public.orders, public.order_items, public.member_profiles,
  public.order_notifications, public.privacy_consents
to authenticated;

revoke all on table public.menus, public.store_settings from anon, authenticated;
grant select on table public.menus, public.store_settings to anon, authenticated;
grant insert, update, delete on table public.menus to authenticated;
grant insert, update on table public.store_settings to authenticated;

-- Explicitly retain only the intended RPC surface.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.advance_order_status(uuid, text, text) from public, anon;
grant execute on function public.advance_order_status(uuid, text, text) to authenticated;

revoke all on function public.mark_order_notification_read(bigint) from public, anon;
revoke all on function public.mark_all_order_notifications_read() from public, anon;
grant execute on function public.mark_order_notification_read(bigint) to authenticated;
grant execute on function public.mark_all_order_notifications_read() to authenticated;

revoke all on function public.register_push_token(text, text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

revoke all on function public.get_admin_members() from public, anon;
revoke all on function public.update_member_management(uuid, text, text) from public, anon;
grant execute on function public.get_admin_members() to authenticated;
grant execute on function public.update_member_management(uuid, text, text) to authenticated;

revoke all on function public.create_pending_payment_order(uuid, text, integer, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.create_pending_payment_order(uuid, text, integer, timestamptz, text)
  to service_role;
