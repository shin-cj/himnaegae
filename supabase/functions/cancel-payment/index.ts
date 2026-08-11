import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createSupabaseContext } from 'npm:@supabase/server@^1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const cancellableStatuses = ['payment_pending', 'paid', 'accepted', 'cancel_requested'];

export default {
  fetch: async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    try {
      const { data: context, error: contextError } = await createSupabaseContext(request, { auth: 'user' });
      const adminUserId = context?.userClaims?.sub;
      if (contextError || !adminUserId) return json({ error: '관리자 로그인이 필요해요.' }, 401);

      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS');
      const secretKeys = secretKeysRaw ? JSON.parse(secretKeysRaw) as Record<string, string> : {};
      const serviceRoleKey = secretKeys.default
        ?? Object.values(secretKeys)[0]
        ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !serviceRoleKey) {
        return json({ error: 'Supabase 서버 설정을 확인해주세요.' }, 500);
      }

      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: adminRole } = await admin
        .from('admin_users')
        .select('user_id')
        .eq('user_id', adminUserId)
        .maybeSingle();

      if (!adminRole) return json({ error: '관리자만 결제를 취소할 수 있어요.' }, 403);

      const body = await request.json();
      const orderId = String(body.orderId ?? '');
      const cancelReason = String(body.cancelReason ?? '고객 요청으로 주문 취소').trim().slice(0, 200);
      if (!orderId) return json({ error: '주문 번호가 필요해요.' }, 400);

      const { data: order, error: orderError } = await admin
        .from('orders')
        .select('id,status,payment_status,payment_key')
        .eq('id', orderId)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) return json({ error: '주문을 찾을 수 없어요.' }, 404);

      if (order.status === 'cancelled' || ['cancelled', 'refunded'].includes(order.payment_status)) {
        return json({ ok: true, alreadyCancelled: true });
      }

      if (!cancellableStatuses.includes(order.status)) {
        return json({ error: '이미 제조가 시작되어 결제를 취소할 수 없어요.' }, 409);
      }

      let nextPaymentStatus = 'cancelled';

      if (order.payment_status === 'paid') {
        if (!order.payment_key) return json({ error: '토스 결제키가 없는 주문이에요.' }, 409);

        const tossSecretKey = Deno.env.get('TOSS_SECRET_KEY');
        if (!tossSecretKey) return json({ error: '토스 시크릿 키가 설정되지 않았어요.' }, 500);

        const tossResponse = await fetch(
          `https://api.tosspayments.com/v1/payments/${encodeURIComponent(order.payment_key)}/cancel`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${tossSecretKey}:`)}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': `cancel-${order.id}`,
            },
            body: JSON.stringify({ cancelReason }),
          },
        );

        const tossResult = await tossResponse.json();
        if (!tossResponse.ok) {
          return json({ error: tossResult.message ?? '토스 결제 취소에 실패했어요.' }, 400);
        }
        nextPaymentStatus = 'refunded';
      }

      const { data: cancelledOrder, error: updateError } = await admin
        .from('orders')
        .update({
          status: 'cancelled',
          payment_status: nextPaymentStatus,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .in('status', cancellableStatuses)
        .select('id,status,payment_status')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!cancelledOrder) return json({ error: '주문 상태가 먼저 변경됐어요. 새로고침 후 확인해주세요.' }, 409);

      return json({ ok: true, order: cancelledOrder });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : '결제 취소 중 오류가 발생했어요.' }, 500);
    }
  },
};
