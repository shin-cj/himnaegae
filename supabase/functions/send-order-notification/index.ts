import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createSupabaseContext } from 'npm:@supabase/server@^1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
});

const formatOrderNumber = (value: string) => {
  const match = /^A-\d{8}-(\d+)$/.exec(value);
  return match ? `A-${match[1]}` : value;
};

export default {
  fetch: async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    try {
      const { data: context, error: contextError } = await createSupabaseContext(request, { auth: 'user' });
      if (contextError || !context.userClaims?.sub) return json({ error: 'Unauthorized' }, 401);

      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS');
      const secretKeys = secretKeysRaw ? JSON.parse(secretKeysRaw) as Record<string, string> : {};
      const serviceRoleKey = secretKeys.default ?? Object.values(secretKeys)[0] ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server configuration is missing' }, 500);

      const admin = createClient(supabaseUrl, serviceRoleKey);

      const { data: adminUser } = await admin
        .from('admin_users')
        .select('user_id')
        .eq('user_id', context.userClaims.sub)
        .maybeSingle();
      if (!adminUser) return json({ error: 'Admin access required' }, 403);

      const body = await request.json() as { orderId?: unknown };
      const orderId = String(body.orderId ?? '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
        return json({ error: 'Invalid order ID' }, 400);
      }
      const { data: order, error: orderError } = await admin
        .from('orders')
        .select('id,user_id,order_number,status')
        .eq('id', orderId)
        .single();
      if (orderError || !order) return json({ error: 'Order not found' }, 404);

      const notifications: Record<string, { title: string; body: string }> = {
        paid: {
          title: '주문이 접수됐어요☕',
          body: '매장에서 주문을 확인 중 입니다.'
        },

        accepted: {
          title: '주문이 접수됐어요☕',
          body: '곧 음료 제조를 시작할게요.',
        },

        preparing: {
          title: '음료를 만들고 있어요🥤',
          body: '음료를 제조하고 있어요. 조금만 기다려주세요'
        },

        ready: {
          title: '픽업 준비 완료🔔',
          body: '음료가 준비됐어요. 매장에서 픽업해주세요'
        },

        picked_up: {
          title: '픽업 완료',
          body: '힘내개를 이용해주셔서 감사합니다.'
        },

        cancelled: {
          title: '주문 취소 완료',
          body: '주문 결제 취소가 완료됐어요'
        }
      };

      const notification = notifications[order.status];

      if (!notification) {
        return json(
          { error: '알림을 전송하지 않는 주문 상태예요.' },
          400,
        );
      }

      const { data: savedNotification, error: historyError } = await admin
        .from('order_notifications')
        .upsert({
          user_id: order.user_id,
          order_id: order.id,
          status: order.status,
          title: notification.title,
          body: notification.body,
        }, { onConflict: 'order_id,status', ignoreDuplicates: true })
        .select('id')
        .maybeSingle();
      if (historyError) throw historyError;
      if (!savedNotification) return json({ ok: true, sent: 0, duplicate: true });

      const { data: tokens, error: tokenError } = await admin
        .from('push_tokens')
        .select('expo_push_token')
        .eq('user_id', order.user_id);
      if (tokenError) throw tokenError;
      if (!tokens?.length) return json({ ok: true, sent: 0, historySaved: true });

      const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify(
          tokens.map(({ expo_push_token }) => ({
            to: expo_push_token,
            sound: 'default',
            channelId: 'orders',
            title: notification.title,
            body: `${formatOrderNumber(order.order_number)} · ${notification.body}`,
            data: {
              screen: 'orders',
              orderId: order.id,
              status: order.status,
            },
          })),
        ),
      });

      const result = await pushResponse.json().catch(() => null);
      if (!pushResponse.ok) {
        console.error('Expo push service rejected the request', { status: pushResponse.status, result });
        return json({ error: 'Expo push service rejected the request' }, 502);
      }
      return json({ ok: true, sent: tokens.length });
    } catch (error) {
      console.error('Order notification function failed', error);
      return json({ error: 'Notification service error' }, 500);
    }
  },
};
