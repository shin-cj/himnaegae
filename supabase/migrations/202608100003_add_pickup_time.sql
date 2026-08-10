alter table public.orders
  add column if not exists pickup_at timestamptz,
  add column if not exists pickup_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_pickup_type_check'
  ) then
    alter table public.orders
      add constraint orders_pickup_type_check
      check (pickup_type is null or pickup_type in ('asap', 'scheduled'));
  end if;
end $$;

comment on column public.orders.pickup_at is 'Customer requested pickup date and time';
comment on column public.orders.pickup_type is 'asap or scheduled';
