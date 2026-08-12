alter table public.order_items
  add column if not exists lightly boolean not null default false;

comment on column public.order_items.lightly is 'Customer requested a lighter coffee flavor';
