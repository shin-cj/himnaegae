create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '힘내개 손님',
  status text not null default 'active' check (status in ('active', 'blocked')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
    coalesce(nullif(trim(new.raw_user_meta_data->>'nickname'), ''), '힘내개 손님'),
    new.created_at
  )
  on conflict (user_id) do update set
    nickname = excluded.nickname;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_member on auth.users;
create trigger on_auth_user_created_create_member
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.handle_new_member();

insert into public.member_profiles (user_id, nickname, created_at)
select
  id,
  coalesce(nullif(trim(raw_user_meta_data->>'nickname'), ''), '힘내개 손님'),
  created_at
from auth.users
on conflict (user_id) do nothing;

drop trigger if exists member_profiles_set_updated_at on public.member_profiles;
create trigger member_profiles_set_updated_at
before update on public.member_profiles
for each row execute function public.set_updated_at();

alter table public.member_profiles enable row level security;

drop policy if exists "members can read own profile" on public.member_profiles;
create policy "members can read own profile"
on public.member_profiles for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "admins can read member profiles" on public.member_profiles;
create policy "admins can read member profiles"
on public.member_profiles for select to authenticated
using ((select public.is_admin()));

drop policy if exists "admins can update member profiles" on public.member_profiles;
create policy "admins can update member profiles"
on public.member_profiles for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

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
    u.email::text,
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
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ACCESS_DENIED';
  end if;
  if p_status not in ('active', 'blocked') then
    raise exception 'INVALID_MEMBER_STATUS';
  end if;

  update public.member_profiles
  set status = p_status, admin_note = left(coalesce(p_admin_note, ''), 500)
  where user_id = p_user_id;
end;
$$;

revoke all on function public.get_admin_members() from public, anon;
revoke all on function public.update_member_management(uuid, text, text) from public, anon;
grant execute on function public.get_admin_members() to authenticated;
grant execute on function public.update_member_management(uuid, text, text) to authenticated;

create or replace function public.enforce_active_member_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.member_profiles
    where user_id = new.user_id and status = 'blocked'
  ) then
    raise exception 'MEMBER_BLOCKED';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_require_active_member on public.orders;
create trigger orders_require_active_member
before insert on public.orders
for each row execute function public.enforce_active_member_order();
