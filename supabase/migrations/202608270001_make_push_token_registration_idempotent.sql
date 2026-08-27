-- 같은 기기 토큰을 여러 번 등록해도 오류 없이 최신 정보로 갱신합니다.
create or replace function public.register_push_token(
  p_expo_push_token text,
  p_platform text,
  p_device_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'LOGIN_REQUIRED';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'INVALID_PLATFORM';
  end if;
  if length(p_expo_push_token) > 255
    or p_expo_push_token !~ '^(Exponent|Expo)PushToken\[[^]]+\]$' then
    raise exception 'INVALID_PUSH_TOKEN';
  end if;

  insert into public.push_tokens (
    user_id, expo_push_token, platform, device_name, updated_at
  ) values (
    auth.uid(), p_expo_push_token, p_platform, left(p_device_name, 200), now()
  )
  on conflict do nothing;

  update public.push_tokens
  set user_id = auth.uid(),
      platform = p_platform,
      device_name = left(p_device_name, 200),
      updated_at = now()
  where expo_push_token = p_expo_push_token;
end;
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
