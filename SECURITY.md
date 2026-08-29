# 힘내개 보안 운영 기준

## 적용된 보호 장치

- 고객 앱에는 Supabase publishable key와 Toss client key만 둡니다. 이 키들은 공개 클라이언트 식별값이며 권한의 근거로 사용하지 않습니다.
- Supabase service role key와 Toss secret key는 Supabase Edge Function secret에만 저장합니다.
- 고객은 자기 주문·알림·프로필만 조회할 수 있고, 쓰기 작업은 용도가 제한된 RPC 또는 Edge Function으로 처리합니다.
- 관리자 화면의 표시 여부와 별개로 모든 관리자 작업은 DB의 `admin_users` 및 RLS/RPC에서 다시 확인합니다.
- 결제 금액은 서버가 메뉴 테이블을 기준으로 다시 계산하며, 주문 상태 선점과 멱등키로 중복 승인·취소를 방지합니다.
- 회원 탈퇴는 현재 비밀번호를 재확인한 뒤 인증 계정을 비활성화하고 프로필을 비식별 처리합니다.

## 절대 Git에 올리지 않는 파일

- `.env`, `.env.local` 등 실제 환경변수 파일
- Supabase service role/secret key
- Toss secret key
- Firebase Admin SDK 서비스 계정 JSON
- Android keystore, Apple 인증서와 개인키

`mobile/google-services.json`은 Android 앱을 Firebase 프로젝트에 연결하는 공개 클라이언트 설정이며 개인키가 포함되지 않습니다. Firebase Admin SDK에서 내려받은 서비스 계정 JSON과는 다릅니다.

## 배포 전 운영자가 확인할 항목

1. Supabase Authentication에서 이메일 확인을 켭니다.
2. 비밀번호 최소 길이를 10자로 맞추고 유출 비밀번호 차단 기능을 사용할 수 있으면 켭니다.
3. Auth의 Site URL과 Redirect URL에는 실제 배포 주소와 `himnaegae://` 딥링크만 허용합니다.
4. 관리자 계정에는 일반 고객과 다른 강한 비밀번호를 사용하고, 가능하면 MFA를 적용합니다.
5. Supabase Edge Function secrets와 EAS/Vercel 환경변수에 퇴사자·공유 계정이 접근할 수 없는지 확인합니다.
6. `docs/PRIVACY_POLICY.md`의 운영자와 담당자 정보를 채웁니다.

## 키 유출 시 대응

1. 유출된 키를 해당 서비스에서 즉시 폐기하고 재발급합니다.
2. Supabase, Toss, Expo/Vercel 로그에서 비정상 호출을 확인합니다.
3. 새 키를 서버 환경변수에 등록하고 함수를 다시 배포합니다.
4. Git 기록에서 키를 지우는 것만으로는 기존 키가 안전해지지 않으므로 반드시 먼저 폐기합니다.
