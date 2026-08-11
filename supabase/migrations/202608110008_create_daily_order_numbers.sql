create table if not exists public.daily_order_counters (
  order_date date primary key,
  last_number integer not null check (last_number > 0),
  updated_at timestamptz not null default now()
);

alter table public.daily_order_counters enable row level security;

create or replace function public.assign_daily_order_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_date date := (timezone('Asia/Seoul', now()))::date;
  next_number integer;
begin
  insert into public.daily_order_counters (order_date, last_number, updated_at)
  values (business_date, 1, now())
  on conflict (order_date) do update
    set last_number = public.daily_order_counters.last_number + 1,
        updated_at = now()
  returning last_number into next_number;

  new.order_number := 'A-' || to_char(business_date, 'YYYYMMDD') || '-' || next_number::text;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'orders_assign_daily_number'
      and tgrelid = 'public.orders'::regclass
  ) then
    create trigger orders_assign_daily_number
    before insert on public.orders
    for each row execute function public.assign_daily_order_number();
  end if;
end
$$;
