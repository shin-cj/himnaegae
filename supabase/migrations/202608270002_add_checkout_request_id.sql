-- 한 번의 결제 시작 요청이 여러 번 도착해도 주문은 하나만 생성합니다.
alter table public.orders
  add column if not exists checkout_request_id text;

create unique index if not exists orders_user_checkout_request_idx
  on public.orders (user_id, checkout_request_id);

