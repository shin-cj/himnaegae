import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
});

export default {
  fetch: async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS');
      const secretKeys = secretKeysRaw ? JSON.parse(secretKeysRaw) as Record<string, string> : {};
      const serviceRoleKey = secretKeys.default
        ?? Object.values(secretKeys)[0]
        ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !anonKey || !serviceRoleKey) {
        return json({ error: '회원 탈퇴 서버 설정을 확인해주세요.' }, 500);
      }

      const accessToken = (request.headers.get('Authorization') ?? '')
        .replace(/^Bearer\s+/i, '')
        .trim();
      if (!accessToken) return json({ error: '로그인이 필요해요.' }, 401);

      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
      const requester = authData.user;
      if (authError || !requester?.id || !requester.email) {
        return json({ error: '로그인 시간이 만료됐어요. 다시 로그인해주세요.' }, 401);
      }

      const body = await request.json().catch(() => ({})) as { currentPassword?: unknown };
      const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      if (!currentPassword || currentPassword.length > 256) {
        return json({ error: '현재 비밀번호를 입력해주세요.' }, 400);
      }

      const passwordVerifier = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: passwordData, error: passwordError } = await passwordVerifier.auth.signInWithPassword({
        email: requester.email,
        password: currentPassword,
      });
      if (passwordError || passwordData.user?.id !== requester.id) {
        return json({ error: '현재 비밀번호가 올바르지 않아요.' }, 403);
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(requester.id, true);
      if (deleteError) {
        console.error('Account soft deletion failed', { userId: requester.id, message: deleteError.message });
        return json({ error: '계정을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.' }, 500);
      }

      return json({ ok: true });
    } catch (error) {
      console.error('Account deletion failed', error);
      return json({ error: '회원 탈퇴 중 오류가 발생했어요.' }, 500);
    }
  },
};
