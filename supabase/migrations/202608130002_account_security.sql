-- Trigger-only functions should never be callable through the API.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_active_member_order() from public, anon, authenticated;

-- Keep profile names small and make withdrawn accounts explicit without
-- deleting order and payment records needed for store accounting.
update public.member_profiles
set nickname = '힘내개 손님'
where char_length(trim(nickname)) < 2;

alter table public.member_profiles
  drop constraint if exists member_profiles_status_check;
alter table public.member_profiles
  add constraint member_profiles_status_check
  check (status in ('active', 'blocked', 'withdrawn'));

alter table public.member_profiles
  add column if not exists withdrawn_at timestamptz;

alter table public.member_profiles
  drop constraint if exists member_profiles_nickname_length_check;
alter table public.member_profiles
  add constraint member_profiles_nickname_length_check
  check (char_length(trim(nickname)) between 2 and 40);

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
  return new;
end;
$$;

revoke all on function public.handle_new_member() from public, anon, authenticated;

-- Supabase soft deletion updates auth.users.deleted_at. An auth trigger removes
-- push destinations and anonymizes the app profile in the same transaction.
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

    delete from public.push_tokens
    where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_soft_deleted on auth.users;
create trigger on_auth_user_soft_deleted
after update of deleted_at on auth.users
for each row execute function public.handle_member_withdrawal();

revoke all on function public.handle_member_withdrawal() from public, anon, authenticated;

create or replace function public.get_admin_members()
returns table (
  user_id uuid,
  email text,
  nickname text,
  status text,
  admin_note text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  order_count bigint,
  total_spent bigint,
  last_order_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ACCESS_DENIED';
  end if;

  return query
  select
    u.id,
    case when p.status = 'withdrawn' then '탈퇴 회원' else coalesce(u.email, '')::text end,
    p.nickname,
    p.status,
    p.admin_note,
    u.created_at,
    u.last_sign_in_at,
    count(o.id) filter (where o.payment_status = 'paid'),
    coalesce(sum(o.total_amount) filter (where o.payment_status = 'paid'), 0)::bigint,
    max(o.created_at) filter (where o.payment_status = 'paid')
  from auth.users u
  join public.member_profiles p on p.user_id = u.id
  left join public.orders o on o.user_id = u.id
  group by u.id, u.email, p.nickname, p.status, p.admin_note, u.created_at, u.last_sign_in_at
  order by u.created_at desc;
end;
$$;

create or replace function public.update_member_management(
  p_user_id uuid,
  p_status text,
  p_admin_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_status text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ACCESS_DENIED';
  end if;
  if p_status not in ('active', 'blocked') then
    raise exception 'INVALID_MEMBER_STATUS';
  end if;

  select status into v_current_status
  from public.member_profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'MEMBER_NOT_FOUND';
  end if;
  if v_current_status = 'withdrawn' then
    raise exception 'WITHDRAWN_MEMBER_IMMUTABLE';
  end if;

  update public.member_profiles
  set status = p_status,
      admin_note = left(coalesce(p_admin_note, ''), 500)
  where user_id = p_user_id;
end;
$$;

revoke all on function public.get_admin_members() from public, anon;
revoke all on function public.update_member_management(uuid, text, text) from public, anon;
grant execute on function public.get_admin_members() to authenticated;
grant execute on function public.update_member_management(uuid, text, text) to authenticated;
