import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import type { Order, OrderItem, OrderStatus } from '../types/order';

const won = (price: number) => `${price.toLocaleString('ko-KR')}원`;

const statusLabel: Record<OrderStatus, string> = {
  payment_pending: '결제 확인 중',
  paid: '결제 완료',
  accepted: '주문 접수',
  preparing: '제조 중',
  ready: '픽업 준비 완료',
  picked_up: '픽업 완료',
  cancel_requested: '취소 요청 중',
  cancelled: '주문 취소',
};

const progressSteps = ['주문 접수', '제조 중', '픽업 준비'] as const;

const progressIndex: Record<OrderStatus, number> = {
  payment_pending: 0,
  paid: 0,
  accepted: 0,
  preparing: 1,
  ready: 2,
  picked_up: 2,
  cancel_requested: 0,
  cancelled: 0,
};

export function OrdersScreen({ onOpenMy, refreshToken }: { onOpenMy: () => void; refreshToken: number }) {
  const insets = useSafeAreaInsets();
  const { loading: authLoading, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('orders')
      .select('id, order_number, status, payment_status, total_amount, pickup_at, pickup_type, created_at, order_items(id, menu_name, temperature, extra_shot, soy_milk, personal_tumbler, quantity, unit_price, line_total)')
      .order('created_at', { ascending: false });

    if (queryError) setError('주문 내역을 불러오지 못했어요.');
    else setOrders((data ?? []) as Order[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) loadOrders();
    else setOrders([]);
  }, [loadOrders, refreshToken, user]);

  if (!authLoading && !user) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTitle}>로그인이 필요해요</Text>
        <Text style={styles.emptyText}>로그인하면 주문 상태와 지난 주문을 확인할 수 있어요.</Text>
        <Pressable onPress={onOpenMy} style={styles.loginButton}><Text style={styles.loginText}>로그인하러 가기</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 22 }]}>
        <Text style={styles.eyebrow}>MY ORDERS</Text>
        <Text style={styles.title}>주문 내역</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadOrders} tintColor={colors.orange} />}
      >
        {error ? <Pressable onPress={loadOrders} style={styles.messageCard}><Text style={styles.error}>{error} 눌러서 다시 시도해주세요.</Text></Pressable> : null}
        {!loading && !error && orders.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>아직 주문 내역이 없어요</Text>
            <Text style={styles.emptyText}>결제가 완료되면 주문과 픽업 상태가 이곳에 표시돼요.</Text>
          </View>
        ) : null}
        {orders.map((order) => <OrderCard key={order.id} order={order} />)}
      </ScrollView>
    </View>
  );
}

function OrderCard({ order }: { order: Order }) {
  const date = new Date(order.created_at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const isCancelled = order.status === 'cancelled' || order.status === 'cancel_requested';
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTop}>
        <View><Text style={styles.orderNumber}>주문번호 {order.order_number}</Text><Text style={styles.date}>{date}</Text></View>
        <Text style={[styles.status, order.status === 'ready' && styles.ready]}>{statusLabel[order.status]}</Text>
      </View>
      {order.pickup_at ? (
        <View style={styles.pickupTimeRow}>
          <Text style={styles.pickupTimeIcon}>⏰</Text>
          <Text style={styles.pickupTimeLabel}>픽업 예정</Text>
          <Text style={styles.pickupTimeValue}>{order.pickup_type === 'asap' ? '바로 갈게요!' : formatPickupTime(order.pickup_at)}</Text>
        </View>
      ) : null}
      {isCancelled ? (
        <View style={styles.cancelledBox}><Text style={styles.cancelledText}>{statusLabel[order.status]}</Text></View>
      ) : (
        <OrderProgress status={order.status} />
      )}
      {order.status === 'ready' ? (
        <View style={styles.pickupBox}>
          <Text style={styles.pickupIcon}>☕</Text>
          <View style={styles.pickupCopy}><Text style={styles.pickupTitle}>음료가 준비됐어요!</Text><Text style={styles.pickupText}>카운터에서 주문번호를 말씀해주세요.</Text></View>
        </View>
      ) : null}
      <View style={styles.divider} />
      {order.order_items.map((item) => <OrderItemRow key={item.id} item={item} />)}
      <View style={styles.totalRow}><Text style={styles.totalLabel}>총 결제금액</Text><Text style={styles.total}>{won(order.total_amount)}</Text></View>
      {!isCancelled && order.status !== 'picked_up' ? (
        <View style={styles.actionRow}>
          <View style={styles.cancelButton}><Text style={styles.cancelButtonText}>주문 취소</Text></View>
          <Text style={styles.actionHint}>취소 기능은 관리자 연결 후 활성화돼요</Text>
        </View>
      ) : null}
    </View>
  );
}

function formatPickupTime(value: string) {
  return new Date(value).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}

function OrderProgress({ status }: { status: OrderStatus }) {
  const current = progressIndex[status];
  return (
    <View style={styles.progress}>
      <View style={styles.progressRail}>
        {progressSteps.map((step, index) => (
          <View key={step} style={[styles.progressPart, index === progressSteps.length - 1 && styles.progressPartLast]}>
            <View style={[styles.progressDot, index <= current && styles.progressDotActive]}>
              <Text style={[styles.progressCheck, index <= current && styles.progressCheckActive]}>{index < current ? '✓' : index + 1}</Text>
            </View>
            {index < progressSteps.length - 1 ? <View style={[styles.progressLine, index < current && styles.progressLineActive]} /> : null}
          </View>
        ))}
      </View>
      <View style={styles.progressLabels}>
        {progressSteps.map((step, index) => <Text key={step} style={[styles.progressLabel, index === current && styles.progressLabelActive]}>{step}</Text>)}
      </View>
    </View>
  );
}

function OrderItemRow({ item }: { item: OrderItem }) {
  const options = [item.temperature, item.extra_shot && '샷 추가', item.soy_milk && '두유 변경', item.personal_tumbler && '개인 텀블러'].filter(Boolean).join(' · ');
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}><Text style={styles.itemName}>{item.menu_name} × {item.quantity}</Text><Text style={styles.options}>{options}</Text></View>
      <Text style={styles.itemPrice}>{won(item.line_total)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: 22, paddingBottom: 16 },
  eyebrow: { color: colors.orange, fontSize: 12, fontWeight: '900', letterSpacing: 1.3 },
  title: { marginTop: 5, color: colors.dark, fontSize: 27, fontWeight: '900' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 125 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 90, backgroundColor: colors.cream },
  empty: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 22 },
  emptyTitle: { color: colors.dark, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 9, color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  loginButton: { marginTop: 22, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 15, backgroundColor: colors.orange },
  loginText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  messageCard: { marginBottom: 12, padding: 15, borderRadius: 16, backgroundColor: '#FFF0EB' },
  error: { color: colors.orange, fontSize: 13, fontWeight: '700' },
  orderCard: { marginBottom: 14, padding: 18, borderRadius: 21, backgroundColor: colors.white },
  orderTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  orderNumber: { color: colors.dark, fontSize: 15, fontWeight: '900' },
  date: { marginTop: 5, color: colors.muted, fontSize: 12 },
  status: { overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#F5EDE5', color: colors.orange, fontSize: 12, fontWeight: '900' },
  ready: { backgroundColor: colors.mint, color: '#3C7B4A' },
  pickupTimeRow: { marginTop: 15, minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 13, backgroundColor: '#FFF5EC' },
  pickupTimeIcon: { marginRight: 7, fontSize: 15 },
  pickupTimeLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  pickupTimeValue: { flex: 1, color: colors.orange, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  progress: { marginTop: 22, marginBottom: 5 },
  progressRail: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  progressPart: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  progressPartLast: { flex: 0 },
  progressDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0E7DE' },
  progressDotActive: { backgroundColor: colors.orange },
  progressCheck: { color: '#A99A90', fontSize: 11, fontWeight: '900' },
  progressCheckActive: { color: colors.white },
  progressLine: { flex: 1, height: 3, marginHorizontal: 5, borderRadius: 2, backgroundColor: '#F0E7DE' },
  progressLineActive: { backgroundColor: colors.orange },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressLabel: { width: 66, color: '#A99A90', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  progressLabelActive: { color: colors.orange, fontWeight: '900' },
  pickupBox: { marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: colors.mint, flexDirection: 'row', alignItems: 'center' },
  pickupIcon: { marginRight: 11, fontSize: 24 },
  pickupCopy: { flex: 1 },
  pickupTitle: { color: '#32683D', fontSize: 14, fontWeight: '900' },
  pickupText: { marginTop: 3, color: '#54815C', fontSize: 11 },
  cancelledBox: { marginTop: 16, padding: 13, borderRadius: 14, backgroundColor: '#F5F1ED' },
  cancelledText: { color: colors.muted, textAlign: 'center', fontSize: 13, fontWeight: '800' },
  divider: { height: 1, marginVertical: 17, backgroundColor: '#F0E7DE' },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, gap: 12 },
  itemInfo: { flex: 1 },
  itemName: { color: colors.dark, fontSize: 14, fontWeight: '800' },
  options: { marginTop: 4, color: colors.muted, fontSize: 11 },
  itemPrice: { color: colors.dark, fontSize: 13, fontWeight: '800' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0E7DE' },
  totalLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  total: { color: colors.dark, fontSize: 17, fontWeight: '900' },
  actionRow: { marginTop: 15, flexDirection: 'row', alignItems: 'center' },
  cancelButton: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: '#E6DCD3' },
  cancelButtonText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  actionHint: { flex: 1, marginLeft: 10, color: '#AA9B91', fontSize: 10, textAlign: 'right' },
});
