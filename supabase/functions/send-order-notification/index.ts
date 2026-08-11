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
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id,user_id,order_number,status')
      .eq('id', orderId)
      .single();
    if (orderError || !order) return json({ error: 'Order not found' }, 404);

    const messages: Record<string, string> = {
      ready: '음료가 준비됐어요! 카운터에서 주문번호를 말씀해주세요.',
      cancelled: '주문 취소가 완료됐어요. 결제 취소 내역을 확인해주세요.',
    };
    const message = messages[order.status];
    if (!message) return json({ error: 'This order status does not send a notification' }, 400);

    const { data: tokens, error: tokenError } = await admin
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', order.user_id);
    if (tokenError) throw tokenError;
    if (!tokens?.length) return json({ ok: true, sent: 0 });

    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(tokens.map(({ expo_push_token }) => ({
        to: expo_push_token,
        sound: 'default',
        channelId: 'orders',
        title: order.status === 'ready' ? '음료가 준비됐어요! ☕' : '주문 취소 완료',
        body: `${formatOrderNumber(order.order_number)} · ${message}`,
        data: { screen: 'orders', orderId: order.id },
      }))),
    });

    const result = await pushResponse.json();
    if (!pushResponse.ok) return json({ error: 'Expo push service rejected the request', detail: result }, 502);
    return json({ ok: true, sent: tokens.length, result });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  },
};
