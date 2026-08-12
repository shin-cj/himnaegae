import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'jsr:@supabase/server@^1';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const formatOrderNumber = (value: string) => {
  const match = /^A-\d{8}-(\d+)$/.exec(value);
  return match ? `A-${match[1]}` : value;
};

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const admin = ctx.supabaseAdmin;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return json({ error: 'Supabase 주소를 확인할 수 없어요.' }, 500);
  const functionUrl = `${supabaseUrl}/functions/v1/toss-payment`;

  try {
    if (req.method === 'POST') {
      const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
      const { data: authData, error: authError } = await admin.auth.getUser(jwt);
      if (authError || !authData.user) return json({ error: '로그인이 필요해요.' }, 401);

      const body = await req.json();

      if (body.action === 'confirm') {
        const paymentKey = String(body.paymentKey ?? '');
        const orderId = String(body.orderId ?? '');
        const amount = Number(body.amount);
        if (!paymentKey || !orderId || !Number.isInteger(amount)) return json({ error: '결제 승인 정보가 올바르지 않아요.' }, 400);

        const { data: order } = await admin.from('orders')
          .select('id,order_number,total_amount,payment_status')
          .eq('id', orderId)
          .eq('user_id', authData.user.id)
          .single();
        if (!order || order.total_amount !== amount) return json({ error: '주문 금액이 일치하지 않아요.' }, 400);
        if (order.payment_status === 'paid') return json({ ok: true });

        const secret = Deno.env.get('TOSS_SECRET_KEY');
        if (!secret) return json({ error: '토스 시크릿 키가 없어요.' }, 500);
        const confirm = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${secret}:`)}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': orderId,
          },
          body: JSON.stringify({ paymentKey, orderId, amount }),
        });
        const payment = await confirm.json();
        if (!confirm.ok) {
          await admin.from('orders').update({ payment_status: 'failed' }).eq('id', orderId);
          return json({ error: payment.message ?? '결제 승인에 실패했어요.' }, 400);
        }

        const { error: updateError } = await admin.from('orders').update({
          status: 'paid', payment_status: 'paid', payment_key: paymentKey,
          payment_method: payment.method, paid_at: new Date().toISOString(),
        }).eq('id', orderId).eq('user_id', authData.user.id);
        if (updateError) throw updateError;

        await admin.from('order_notifications').upsert({
          user_id: authData.user.id,
          order_id: orderId,
          status: 'paid',
          title: '주문이 접수됐어요 ☕',
          body: '매장에서 주문을 확인하고 있어요.',
        }, { onConflict: 'order_id,status', ignoreDuplicates: true });

        // 결제 승인이 끝난 직후에도 푸시를 보냅니다. 알림 전송 실패가 결제 승인 자체를 실패시키지는 않아요.
        try {
          const { data: tokens } = await admin.from('push_tokens').select('expo_push_token').eq('user_id', authData.user.id);
          if (tokens?.length) {
            await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify(tokens.map(({ expo_push_token }) => ({
                to: expo_push_token,
                sound: 'default',
                channelId: 'orders',
                title: '주문이 접수됐어요 ☕',
                body: `${formatOrderNumber(order.order_number)} · 매장에서 주문을 확인하고 있어요.`,
                data: { screen: 'notifications', orderId, status: 'paid' },
              }))),
            });
          }
        } catch {
          // 알림은 보조 기능이므로 Toss 결제 승인 결과는 그대로 반환합니다.
        }
        return json({ ok: true });
      }

      const { items, clientKey } = body;
      const pickupType = body.pickup_type === 'asap' ? 'asap' : 'scheduled';
      const pickupAt = new Date(body.pickup_at);
      if (!Array.isArray(items) || items.length < 1 || items.length > 30 || !String(clientKey).startsWith('test_ck_')) {
        return json({ error: '결제 정보가 올바르지 않아요.' }, 400);
      }
      if (Number.isNaN(pickupAt.getTime()) || pickupAt.getTime() < Date.now() - 5 * 60 * 1000 || pickupAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        return json({ error: '픽업 시간을 다시 선택해주세요.' }, 400);
      }

      const menuIds = [...new Set(items.map((item: any) => Number(item.menu_id)))];
      if (menuIds.some((id) => !Number.isInteger(id))) return json({ error: '메뉴 정보가 올바르지 않아요.' }, 400);
      const { data: menuRows, error: menuError } = await admin
        .from('menus')
        .select('id,name,price,temperature,available')
        .in('id', menuIds);
      if (menuError) throw menuError;
      const menuById = new Map((menuRows ?? []).map((menu) => [menu.id, menu]));

      const normalizedItems = items.map((item: any) => {
        const menu = menuById.get(Number(item.menu_id));
        const quantity = Number(item.quantity);
        const temperature = item.temperature === 'HOT' ? 'HOT' : item.temperature === 'ICE' ? 'ICE' : null;
        if (!menu || !menu.available) throw new Error('품절되었거나 판매하지 않는 메뉴가 포함되어 있어요.');
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('메뉴 수량이 올바르지 않아요.');
        if (!temperature || (menu.temperature !== 'BOTH' && menu.temperature !== temperature)) throw new Error(`${menu.name}의 온도 선택을 확인해주세요.`);
        const extraShotCount = Number(item.extra_shot_count ?? (item.extra_shot ? 1 : 0));
        if (!Number.isInteger(extraShotCount) || extraShotCount < 0 || extraShotCount > 5) throw new Error('샷 추가 수량을 확인해주세요.');
        const extraShot = extraShotCount > 0;
        const personalTumbler = Boolean(item.personal_tumbler);
        const unitPrice = menu.price + extraShotCount * 500 - (personalTumbler ? 200 : 0);
        return {
          menu_id: menu.id,
          menu_name: menu.name,
          temperature,
          extra_shot: extraShot,
          extra_shot_count: extraShotCount,
          lightly: Boolean(item.lightly),
          soy_milk: Boolean(item.soy_milk),
          personal_tumbler: personalTumbler,
          quantity,
          unit_price: unitPrice,
        };
      });
      const total = normalizedItems.reduce((sum: number, item) => sum + item.unit_price * item.quantity, 0);
      if (!Number.isInteger(total) || total < 100) return json({ error: '결제 금액이 올바르지 않아요.' }, 400);

      const { data: order, error: orderError } = await admin.from('orders').insert({
        user_id: authData.user.id, status: 'payment_pending', payment_status: 'pending', total_amount: total,
        pickup_at: pickupAt.toISOString(), pickup_type: pickupType,
      }).select('id, order_number').single();
      if (orderError) throw orderError;

      const rows = normalizedItems.map((item) => ({ order_id: order.id, ...item }));
      const { error: itemError } = await admin.from('order_items').insert(rows);
      if (itemError) { await admin.from('orders').delete().eq('id', order.id); throw itemError; }

      const orderName = normalizedItems.length > 1 ? `${normalizedItems[0].menu_name} 외 ${normalizedItems.length - 1}건` : normalizedItems[0].menu_name;
      return json({
        orderId: order.id,
        orderNumber: order.order_number,
        amount: total,
        orderName,
        customerEmail: authData.user.email ?? '',
        pickupAt: pickupAt.toISOString(),
        pickupType,
        successUrl: `${functionUrl}?action=success`,
        failUrl: `${functionUrl}?action=fail`,
      });
    }
    return json({ error: 'Not found' }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '서버 오류가 발생했어요.' }, 500);
  }
  }),
};
