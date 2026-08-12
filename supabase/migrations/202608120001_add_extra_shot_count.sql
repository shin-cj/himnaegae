alter table public.order_items
  add column if not exists extra_shot_count integer not null default 0;

update public.order_items
set extra_shot_count = 1
where extra_shot = true
  and extra_shot_count = 0;

alter table public.order_items
  drop constraint if exists order_items_extra_shot_count_check;

alter table public.order_items
  add constraint order_items_extra_shot_count_check
  check (extra_shot_count between 0 and 5);

comment on column public.order_items.extra_shot_count is 'Number of extra espresso shots, from 0 to 5';
