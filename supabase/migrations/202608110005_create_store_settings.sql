create table if not exists public.store_settings (
  id smallint primary key default 1 check (id = 1),
  store_name text not null default '힘내개 본점',
  business_status text not null default 'open' check (business_status in ('open', 'paused', 'closed')),
  notice text not null default '',
  phone text not null default '',
  address text not null default '',
  open_time time not null default '09:00',
  close_time time not null default '20:00',
  pickup_min integer not null default 10 check (pickup_min between 1 and 120),
  pickup_max integer not null default 15 check (pickup_max between 1 and 180),
  pickup_guide text not null default '준비가 끝나면 알림을 보내드려요.',
  updated_at timestamptz not null default now(),
  check (pickup_max >= pickup_min)
);

insert into public.store_settings (id) values (1)
on conflict (id) do nothing;

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at
before update on public.store_settings
for each row execute function public.set_updated_at();

alter table public.store_settings enable row level security;

drop policy if exists "everyone can read store settings" on public.store_settings;
create policy "everyone can read store settings"
on public.store_settings for select to anon, authenticated
using (true);

drop policy if exists "admins can update store settings" on public.store_settings;
create policy "admins can update store settings"
on public.store_settings for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "admins can insert store settings" on public.store_settings;
create policy "admins can insert store settings"
on public.store_settings for insert to authenticated
with check ((select public.is_admin()));

do $$
begin
  alter publication supabase_realtime add table public.store_settings;
exception when duplicate_object then null;
end $$;

