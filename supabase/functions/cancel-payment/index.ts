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
const formatOrderNumber = (value: string) => {
  const match = /^A-\d{8}-(\d+)$/.exec(value);
  return match ? `A-${match[1]}` : value;
};

const customerCancellableStatuses = ['payment_pending', 'paid', 'accepted'];

export default {
  fetch: async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    try {
      const { data: context, error: contextError } = await createSupabaseContext(request, { auth: 'user' });
      const requesterId = context?.userClaims?.sub;
      if (contextError || !requesterId) return json({ error: '로그인이 필요해요.' }, 401);

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
      const body = await request.json();
      const orderId = String(body.orderId ?? '');
      const cancelReason = String(body.cancelReason ?? '고객 요청으로 주문 취소').trim().slice(0, 200);
      if (!orderId) return json({ error: '주문 번호가 필요해요.' }, 400);

      const [{ data: adminRole }, { data: order, error: orderError }] = await Promise.all([
        admin.from('admin_users').select('user_id').eq('user_id', requesterId).maybeSingle(),
        admin.from('orders').select('id,user_id,order_number,status,payment_status,payment_key,cancellation_reason').eq('id', orderId).maybeSingle(),
      ]);

      if (orderError) throw orderError;
      if (!order) return json({ error: '주문을 찾을 수 없어요.' }, 404);
      const isAdmin = Boolean(adminRole);
      const isOwner = order.user_id === requesterId;
      if (!isAdmin && !isOwner) return json({ error: '이 주문을 취소할 권한이 없어요.' }, 403);

      if (order.status === 'cancelled' || ['cancelled', 'refunded'].includes(order.payment_status)) {
        return json({ ok: true, alreadyCancelled: true });
      }

      if (![...customerCancellableStatuses, 'cancel_requested'].includes(order.status)) {
        return json({ error: '이미 제조가 시작되어 결제를 취소할 수 없어요.' }, 409);
      }

      // 제조 시작과 고객 취소가 동시에 눌려도 한쪽만 성공하도록 먼저 상태를 선점합니다.
      const previousStatus = order.status;
      if (order.status !== 'cancel_requested') {
        const { data: claimedOrder, error: claimError } = await admin
          .from('orders')
          .update({ status: 'cancel_requested', cancellation_reason: cancelReason })
          .eq('id', order.id)
          .in('status', customerCancellableStatuses)
          .select('id')
          .maybeSingle();
        if (claimError) throw claimError;
        if (!claimedOrder) return json({ error: '이미 제조가 시작되어 결제를 취소할 수 없어요.' }, 409);
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
          if (previousStatus !== 'cancel_requested') {
            await admin.from('orders').update({ status: previousStatus, cancellation_reason: order.cancellation_reason }).eq('id', order.id).eq('status', 'cancel_requested');
          }
          return json({ error: tossResult.message ?? '토스 결제 취소에 실패했어요.' }, 400);
        }
        nextPaymentStatus = 'refunded';
      }

      const { data: cancelledOrder, error: updateError } = await admin
        .from('orders')
        .update({
          status: 'cancelled',
          payment_status: nextPaymentStatus,
          cancellation_reason: cancelReason,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('status', 'cancel_requested')
        .select('id,status,payment_status')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!cancelledOrder) return json({ error: '주문 상태가 먼저 변경됐어요. 새로고침 후 확인해주세요.' }, 409);

      await admin.from('order_notifications').upsert({
        user_id: order.user_id,
        order_id: order.id,
        status: 'cancelled',
        title: '주문 취소 완료',
        body: order.payment_status === 'paid' ? '결제 취소와 환불이 완료됐어요.' : '주문이 취소됐어요.',
      }, { onConflict: 'order_id,status', ignoreDuplicates: true });

      try {
        const { data: tokens } = await admin.from('push_tokens').select('expo_push_token').eq('user_id', order.user_id);
        if (tokens?.length) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(tokens.map(({ expo_push_token }) => ({
              to: expo_push_token,
              sound: 'default',
              channelId: 'orders',
              title: '주문 취소 완료',
              body: `${formatOrderNumber(order.order_number)} · ${order.payment_status === 'paid' ? '결제 취소와 환불이 완료됐어요.' : '주문이 취소됐어요.'}`,
              data: { screen: 'notifications', orderId: order.id, status: 'cancelled' },
            }))),
          });
        }
      } catch {
        // 알림 전송 실패가 결제 취소 결과에 영향을 주지는 않아요.
      }

      return json({ ok: true, order: cancelledOrder });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : '결제 취소 중 오류가 발생했어요.' }, 500);
    }
  },
};
