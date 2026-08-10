import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'jsr:@supabase/server@^1';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

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
          .select('id,total_amount,payment_status')
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
        return json({ ok: true });
      }

      const { items, clientKey } = body;
      if (!Array.isArray(items) || items.length < 1 || items.length > 30 || !String(clientKey).startsWith('test_ck_')) {
        return json({ error: '결제 정보가 올바르지 않아요.' }, 400);
      }
      const total = items.reduce((sum: number, item: any) => sum + Number(item.unit_price) * Number(item.quantity), 0);
      if (!Number.isInteger(total) || total < 100) return json({ error: '결제 금액이 올바르지 않아요.' }, 400);

      const { data: order, error: orderError } = await admin.from('orders').insert({
        user_id: authData.user.id, status: 'payment_pending', payment_status: 'pending', total_amount: total,
      }).select('id, order_number').single();
      if (orderError) throw orderError;

      const rows = items.map((item: any) => ({
        order_id: order.id, menu_id: Number(item.menu_id), menu_name: String(item.menu_name),
        temperature: item.temperature, extra_shot: Boolean(item.extra_shot), soy_milk: Boolean(item.soy_milk),
        personal_tumbler: Boolean(item.personal_tumbler), quantity: Number(item.quantity), unit_price: Number(item.unit_price),
      }));
      const { error: itemError } = await admin.from('order_items').insert(rows);
      if (itemError) { await admin.from('orders').delete().eq('id', order.id); throw itemError; }

      const orderName = items.length > 1 ? `${items[0].menu_name} 외 ${items.length - 1}건` : items[0].menu_name;
      return json({
        orderId: order.id,
        orderNumber: order.order_number,
        amount: total,
        orderName,
        customerEmail: authData.user.email ?? '',
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
