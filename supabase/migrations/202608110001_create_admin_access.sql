create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

create or replace function public.claim_first_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'LOGIN_REQUIRED';
  end if;

  lock table public.admin_users in exclusive mode;

  if exists (select 1 from public.admin_users where user_id = current_user_id) then
    return true;
  end if;

  if exists (select 1 from public.admin_users) then
    raise exception 'ADMIN_ACCESS_DENIED';
  end if;

  insert into public.admin_users (user_id) values (current_user_id);
  return true;
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.claim_first_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.claim_first_admin() to authenticated;

drop policy if exists "admins can read own role" on public.admin_users;
create policy "admins can read own role"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "admins can read all orders" on public.orders;
create policy "admins can read all orders"
on public.orders for select to authenticated
using ((select public.is_admin()));

drop policy if exists "admins can update all orders" on public.orders;
create policy "admins can update all orders"
on public.orders for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "admins can read all order items" on public.order_items;
create policy "admins can read all order items"
on public.order_items for select to authenticated
using ((select public.is_admin()));

create index if not exists orders_status_created_at_idx
  on public.orders (status, created_at desc);
