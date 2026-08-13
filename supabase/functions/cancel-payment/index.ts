import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
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

type OrderStatus = 'payment_pending' | 'paid' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'cancel_requested' | 'cancelled';

export default {
  fetch: async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    try {
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
      const authHeader = request.headers.get('Authorization') ?? '';
      const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!accessToken) return json({ error: '로그인 정보가 요청에 포함되지 않았어요.' }, 401);

      const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
      const requesterId = authData.user?.id;
      if (authError || !requesterId) {
        console.error('Cancel authentication failed', authError?.message ?? 'user not found');
        return json({ error: '로그인 시간이 만료됐어요. 다시 로그인해주세요.' }, 401);
      }

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

      if (order.payment_status === 'confirming') {
        return json({
          error: '결제 확인이 진행 중이에요. 잠시 후 다시 시도해주세요.',
          code: 'PAYMENT_CONFIRM_IN_PROGRESS',
          failureType: 'duplicate',
        }, 409);
      }

      const customerCanCancel = isOwner
        && [...customerCancellableStatuses, 'cancel_requested'].includes(order.status);
      const adminCanCancel = isAdmin && order.status !== 'cancelled';

      if (!customerCanCancel && !adminCanCancel) {
        return json({
          error: isOwner
            ? '이미 제조가 시작되어 고객이 직접 취소할 수 없어요.'
            : '이미 취소된 주문이에요.',
        }, 409);
      }

      const previousStatus = order.status;

      let tossSecretKey: string | undefined;
      if (order.payment_status === 'paid') {
        if (!order.payment_key) {
          return json({
            error: '토스 결제키가 없는 주문이에요.',
            code: 'PAYMENT_KEY_MISSING',
            failureType: 'configuration',
            orderStateRestored: true,
          }, 409);
        }
        tossSecretKey = Deno.env.get('TOSS_SECRET_KEY');
        if (!tossSecretKey) {
          return json({
            error: '토스 시크릿 키가 설정되지 않았어요.',
            code: 'TOSS_SECRET_MISSING',
            failureType: 'configuration',
            orderStateRestored: true,
          }, 500);
        }
      }

      // 제조 시작과 취소가 동시에 눌려도 먼저 상태를 선점한 작업만 성공합니다.
      const { data: claimedOrder, error: claimError } = await admin
        .from('orders')
        .update({ status: 'cancel_requested', cancellation_reason: cancelReason })
        .eq('id', order.id)
        .in('status', isAdmin ? [previousStatus] : [...customerCancellableStatuses, 'cancel_requested'])
        .select('id')
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimedOrder) {
        return json({
          error: isAdmin
            ? '주문 상태가 먼저 변경됐어요. 새로고침 후 다시 시도해주세요.'
            : '이미 제조가 시작되어 고객이 직접 취소할 수 없어요.',
          code: 'ORDER_STATUS_CHANGED',
          failureType: 'status',
        }, 409);
      }

      const restorePreviousOrderState = async () => {
        const { data: restoredOrder, error: restoreError } = await admin
          .from('orders')
          .update({ status: previousStatus, cancellation_reason: order.cancellation_reason })
          .eq('id', order.id)
          .eq('status', 'cancel_requested')
          .select('status')
          .maybeSingle();
        const restored = !restoreError && restoredOrder?.status === previousStatus;

        if (!restored) {
          console.error('Order status restore failed', {
            orderId: order.id,
            previousStatus,
            message: restoreError?.message ?? 'order was not restored',
          });
        }
        return restored;
      };

      let nextPaymentStatus = 'cancelled';

      if (order.payment_status === 'paid') {
        let tossResponse: Response;
        try {
          tossResponse = await fetch(
            `https://api.tosspayments.com/v1/payments/${encodeURIComponent(order.payment_key)}/cancel`,
            {
              method: 'POST',
              headers: {
                Authorization: `Basic ${btoa(`${tossSecretKey}:`)}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': `cancel-${order.id}`,
              },
              signal: AbortSignal.timeout(15_000),
              body: JSON.stringify({ cancelReason }),
            },
          );
        } catch {
          const orderStateRestored = await restorePreviousOrderState();
          return json({
            error: orderStateRestored
              ? '토스 결제 서버에 연결하지 못했어요.'
              : '토스 연결에 실패했고 주문 상태를 복구하지 못했어요. 주문 상태를 확인해주세요.',
            code: orderStateRestored ? 'TOSS_NETWORK_ERROR' : 'ORDER_RESTORE_FAILED',
            failureType: orderStateRestored ? 'toss' : 'rollback',
            orderStateRestored,
          }, 503);
        }

        const tossResult = await tossResponse.json().catch(() => ({}));
        const alreadyCancelledByToss = tossResult?.code === 'ALREADY_CANCELED_PAYMENT';
        if (!tossResponse.ok && !alreadyCancelledByToss) {
          console.error('Toss cancellation failed', {
            orderId: order.id,
            status: tossResponse.status,
            code: tossResult?.code,
            message: tossResult?.message,
          });
          const orderStateRestored = await restorePreviousOrderState();

          if (!orderStateRestored) {
            return json({
              error: '환불에 실패했고 주문 상태를 복구하지 못했어요. 주문 상태를 확인해주세요.',
              code: 'ORDER_RESTORE_FAILED',
              failureType: 'rollback',
              orderStateRestored: false,
            }, 500);
          }

          return json({
            error: tossResult.message ?? '토스 결제 취소에 실패했어요.',
            code: tossResult.code ?? 'TOSS_CANCEL_FAILED',
            failureType: 'toss',
            orderStateRestored: true,
            previousStatus: previousStatus as OrderStatus,
          }, 400);
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
