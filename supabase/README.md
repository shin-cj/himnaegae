# Supabase 함수 관리

Edge Function 소스는 모두 이 저장소의 `supabase/functions`에서 관리합니다.

## 결제·취소 안전성 검사

배포 전에 프로젝트 루트에서 Edge Function 타입 검사와 예외 처리 테스트를 실행합니다.

```powershell
npx -y deno check supabase/functions/toss-payment/index.ts supabase/functions/cancel-payment/index.ts
npx -y deno test supabase/tests/payment-safety.test.ts
```

테스트는 금액 불일치, 중복 결제 확인, 중단된 처리 복구, 주문 소유권, 제조 시작 후 고객 취소 차단, 중복 취소를 검증합니다.

## 최초 한 번

VS Code 터미널을 프로젝트 루트(`himnaegae`)에서 열고 로그인합니다.

```powershell
npx supabase login
```

## 함수 배포

결제 취소 함수를 수정한 뒤 아래 명령으로 배포합니다.

```powershell
npx supabase functions deploy cancel-payment --project-ref zpqtexizuenahyyzyhnl --use-api
```

결제 승인 함수를 수정했을 때는 다음 명령을 사용합니다.

```powershell
npx supabase functions deploy toss-payment --project-ref zpqtexizuenahyyzyhnl --use-api
```

알림 함수를 수정했을 때는 다음 명령을 사용합니다.

```powershell
npx supabase functions deploy send-order-notification --project-ref zpqtexizuenahyyzyhnl --use-api
```

`TOSS_SECRET_KEY` 같은 비밀키는 소스나 Git에 넣지 않습니다. Supabase 프로젝트의 Edge Function Secrets에서만 관리합니다.
