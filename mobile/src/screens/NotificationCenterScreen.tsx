import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, type ImageSourcePropType, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { formatOrderNumber } from '../lib/order-number';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

type NoticeOrderItem = {
  id: number;
  menu_name: string;
  temperature: 'HOT' | 'ICE';
  extra_shot_count: number;
  lightly: boolean;
  soy_milk: boolean;
  personal_tumbler: boolean;
  quantity: number;
  line_total: number;
}

type NoticeOrder = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  pickup_at: string | null;
  created_at: string;
  order_items: NoticeOrderItem[];
};

const acceptedIcon = require('../../assets/order-status/accepted.png');
const preparingIcon = require('../../assets/order-status/preparing.png');
const readyIcon = require('../../assets/order-status/ready.png');
const completedIcon = require('../../assets/order-status/completed.png');
const cancelledIcon = require('../../assets/order-status/cancelled.png');

const statusCopy: Record<string, { icon: ImageSourcePropType; title: string; body: string }> = {
  payment_pending: { icon: acceptedIcon, title: '결제 확인 중', body: '결제가 완료되기를 기다리고 있어요.' },
  paid: { icon: acceptedIcon, title: '접수 됨', body: '매장에서 주문을 확인했어요.' },
  accepted: { icon: acceptedIcon, title: '접수 됨', body: '곧 음료 제조를 시작할게요.' },
  preparing: { icon: preparingIcon, title: '제조 중', body: '음료를 만들고 있어요. 조금만 기다려주세요.' },
  ready: { icon: readyIcon, title: '픽업 준비 완료', body: '매장에서 주문번호를 확인하고 픽업해주세요.' },
  picked_up: { icon: completedIcon, title: '픽업 완료', body: '힘내개를 이용해주셔서 감사해요.' },
  cancel_requested: { icon: cancelledIcon, title: '취소 요청 확인 중', body: '매장에서 취소 요청을 확인하고 있어요.' },
  cancelled: { icon: cancelledIcon, title: '주문 취소 완료', body: '주문과 결제 취소가 완료됐어요.' },
};

export function NotificationCenterScreen({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<NoticeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expendedOrderId, setExpendedOrderId] = useState<string | null>(null);

  const loadNotices = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('orders')
      .select(`id,order_number,status,total_amount,pickup_at,created_at,order_items(id,menu_name,temperature,extra_shot_count,lightly,soy_milk,personal_tumbler,quantity,line_total)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setOrders((data ?? [])  as NoticeOrder[],);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadNotices();
    if (!user) return;
    const channel = supabase.channel(`notification-center-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, () => void loadNotices())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadNotices, user]);

  const refresh = async () => {
    setRefreshing(true);
    await loadNotices();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>×</Text></Pressable>
        <Text style={styles.title}>알림</Text>
        <View style={styles.headerSpace} />
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.orange} /></View> : (
        <ScrollView
          contentContainerStyle={[styles.content, orders.length === 0 && styles.emptyContent]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.orange} />}
        >
          {orders.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>{user ? '아직 알림이 없어요' : '로그인이 필요해요'}</Text>
              <Text style={styles.emptyText}>{user ? '주문 상태가 여기에 차곡차곡 표시돼요.' : '로그인하면 주문 알림을 다시 확인할 수 있어요.'}</Text>
            </View>
          ) : orders.map((order) => {
            const copy = statusCopy[order.status] ?? statusCopy.paid;
            return (
              <Pressable key={order.id} onPress={() => setExpendedOrderId((current) => current === order.id ? null : order.id)}
                style={({ pressed }) => [styles.noticeCard, pressed && styles.noticeCardPressed]}>
                <View style={styles.iconCircle}><Image source={copy.icon} style={styles.noticeIcon} resizeMode="contain" /></View>
                <View style={styles.noticeCopy}>
                  <View style={styles.noticeTitleRow}>
                    <Text style={styles.noticeTitle}>{copy.title}</Text>
                    <Text style={styles.orderNumber}>{formatOrderNumber(order.order_number)}</Text>
                  </View>
                  <Text style={styles.noticeBody}>{copy.body}</Text>
                  <Text style={styles.noticeTime}>{formatDate(order.created_at)}{order.pickup_at ? ` · 픽업 ${formatTime(order.pickup_at)}` : ''}</Text>
                  {expendedOrderId === order.id ? (
                    <View style={styles.orderDetail}>
                      <View style={styles.detailDivider} />

                      {order.order_items.map((item) => (
                        <View key={item.id} style={styles.detailItem}>
                          <View style={styles.detailItemCopy}>
                            <Text style={styles.detailItemName}>
                              {item.menu_name} × {item.quantity}
                            </Text>

                            <Text style={styles.detailOptions}>
                              {formatOptions(item)}
                            </Text>
                          </View>

                          <Text style={styles.detailPrice}>
                            {won(item.line_total)}
                          </Text>
                        </View>
                      ))}

                      <View style={styles.detailTotal}>
                        <Text style={styles.detailTotalLabel}>총 결제금액</Text>
                        <Text style={styles.detailTotalPrice}>
                          {won(order.total_amount)}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.detailGuide}>눌러서 주문 상세보기</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function won(price : number) {
  return `${price.toLocaleString('ko-KR')}원`
}

function formatOptions(item : NoticeOrderItem){
  const option = [
    item.temperature,
    item.extra_shot_count > 0 ? `샷 추가 x ${item.extra_shot_count}` : null,
    item.lightly ? '연하게' : null,
    item.soy_milk ? '두유 변경' : null,
    item.personal_tumbler ? '개인 텀블러' : null,
  ].filter(Boolean);

  return option.join(' · ')
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  close: { width: 36, color: colors.dark, fontSize: 30, lineHeight: 34 },
  title: { color: colors.dark, fontSize: 19, fontWeight: '900' },
  headerSpace: { width: 36 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingBottom: 70 },
  emptyIcon: { fontSize: 42 },
  emptyTitle: { marginTop: 14, color: colors.dark, fontSize: 18, fontWeight: '900' },
  emptyText: { marginTop: 7, color: colors.muted, fontSize: 13 },
  noticeCard: { flexDirection: 'row', paddingHorizontal: 4, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: '#E9DED5' },
  iconCircle: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  noticeIcon: { width: 27, height: 27 },
  noticeCopy: { flex: 1, marginLeft: 12 },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  noticeTitle: { flex: 1, color: colors.dark, fontSize: 18, fontWeight: '900' },
  orderNumber: { color: colors.orange, fontSize: 15, fontWeight: '900' },
  noticeBody: { marginTop: 5, color: colors.muted, fontSize: 14, lineHeight: 18 },
  noticeTime: { marginTop: 8, color: '#A3978F', fontSize: 11, fontWeight: '700' },
  noticeCardPressed: {
  opacity: 0.6,
},

detailGuide: {
  marginTop: 9,
  color: colors.orange,
  fontSize: 10,
  fontWeight: '800',
},

orderDetail: {
  marginTop: 12,
},

detailDivider: {
  height: 1,
  marginBottom: 12,
  backgroundColor: '#E9DED5',
},

detailItem: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: 12,
  gap: 12,
},

detailItemCopy: {
  flex: 1,
},

detailItemName: {
  color: colors.dark,
  fontSize: 12,
  fontWeight: '900',
},

detailOptions: {
  marginTop: 4,
  color: colors.muted,
  fontSize: 12,
  lineHeight: 15,
},

detailPrice: {
  color: colors.dark,
  fontSize: 12,
  fontWeight: '800',
},

detailTotal: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingTop: 12,
  borderTopWidth: 1,
  borderTopColor: '#E9DED5',
},

detailTotalLabel: {
  color: colors.dark,
  fontSize: 12,
  fontWeight: '800',
},

detailTotalPrice: {
  color: colors.orange,
  fontSize: 14,
  fontWeight: '900',
},
});
