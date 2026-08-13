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
};

type Notice = {
  id: number;
  order_id: string;
  status: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  orders: {
    order_number: string;
    total_amount: number;
    pickup_at: string | null;
    cancellation_reason: string | null;
    order_items: NoticeOrderItem[];
  };
};

const statusIcons: Record<string, ImageSourcePropType> = {
  payment_pending: require('../../assets/order-status/accepted.png'),
  paid: require('../../assets/order-status/accepted.png'),
  accepted: require('../../assets/order-status/accepted.png'),
  preparing: require('../../assets/order-status/preparing.png'),
  ready: require('../../assets/order-status/ready.png'),
  picked_up: require('../../assets/order-status/completed.png'),
  cancel_requested: require('../../assets/order-status/cancelled.png'),
  cancelled: require('../../assets/order-status/cancelled.png'),
};

type Props = {
  initialOrderId: string | null;
  onInitialOrderHandled: () => void;
  onClose: () => void;
  onUnreadChange: (count: number) => void;
};

export function NotificationCenterScreen({ initialOrderId, onInitialOrderHandled, onClose, onUnreadChange }: Props) {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedNoticeId, setExpandedNoticeId] = useState<number | null>(null);

  const loadNotices = useCallback(async () => {
    if (!user) {
      setNotices([]);
      setLoadedUserId(null);
      setLoading(false);
      onUnreadChange(0);
      return;
    }
    const { data } = await supabase
      .from('order_notifications')
      .select(`id,order_id,status,title,body,read_at,created_at,orders!inner(order_number,total_amount,pickup_at,cancellation_reason,order_items(id,menu_name,temperature,extra_shot_count,lightly,soy_milk,personal_tumbler,quantity,line_total))`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    const nextNotices = (data ?? []) as unknown as Notice[];
    setNotices(nextNotices);
    setLoadedUserId(user.id);
    onUnreadChange(nextNotices.filter((notice) => !notice.read_at).length);
    setLoading(false);
  }, [onUnreadChange, user]);

  useEffect(() => {
    void loadNotices();
    if (!user) return;
    const channel = supabase.channel(`notification-center-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_notifications', filter: `user_id=eq.${user.id}` }, () => void loadNotices())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadNotices, user]);

  const refresh = async () => {
    setRefreshing(true);
    await loadNotices();
    setRefreshing(false);
  };

  const openNotice = useCallback(async (notice: Notice, forceOpen = false) => {
    setExpandedNoticeId((current) => forceOpen ? notice.id : current === notice.id ? null : notice.id);
    if (notice.read_at) return;
    const readAt = new Date().toISOString();
    setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, read_at: readAt } : item));
    onUnreadChange(Math.max(0, notices.filter((item) => !item.read_at).length - 1));
    const { error } = await supabase.rpc('mark_order_notification_read', {
      p_notification_id: notice.id,
    });
    if (error) await loadNotices();
  }, [loadNotices, notices, onUnreadChange]);

  useEffect(() => {
    if (!initialOrderId || loading || !user || loadedUserId !== user.id) return;
    const targetNotice = notices.find((notice) => notice.order_id === initialOrderId);
    if (targetNotice) void openNotice(targetNotice, true);
    onInitialOrderHandled();
  }, [initialOrderId, loadedUserId, loading, notices, onInitialOrderHandled, openNotice, user]);

  const markAllRead = async () => {
    if (!user) return;
    const readAt = new Date().toISOString();
    setNotices((current) => current.map((notice) => ({ ...notice, read_at: notice.read_at ?? readAt })));
    onUnreadChange(0);
    const { error } = await supabase.rpc('mark_all_order_notifications_read');
    if (error) await loadNotices();
  };

  const unreadCount = notices.filter((notice) => !notice.read_at).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>×</Text></Pressable>
        <View style={styles.headerTitleRow}><Text style={styles.title}>알림</Text>{unreadCount > 0 ? <Text style={styles.unreadCount}>{unreadCount}</Text> : null}</View>
        <Pressable disabled={unreadCount === 0} onPress={() => void markAllRead()} hitSlop={8}><Text style={[styles.markAll, unreadCount === 0 && styles.markAllDisabled]}>전체 읽음</Text></Pressable>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.orange} /></View> : (
        <ScrollView
          contentContainerStyle={[styles.content, notices.length === 0 && styles.emptyContent]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.orange} />}
        >
          {notices.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>{user ? '아직 알림이 없어요' : '로그인이 필요해요'}</Text>
              <Text style={styles.emptyText}>{user ? '주문 상태가 바뀌면 여기에 기록돼요.' : '로그인하면 주문 알림을 다시 확인할 수 있어요.'}</Text>
            </View>
          ) : notices.map((notice) => {
            const order = notice.orders;
            const expanded = expandedNoticeId === notice.id;
            return (
              <Pressable key={notice.id} onPress={() => void openNotice(notice)} style={({ pressed }) => [styles.noticeCard, !notice.read_at && styles.unreadCard, pressed && styles.noticeCardPressed]}>
                <View style={styles.iconArea}>
                  <Image source={statusIcons[notice.status] ?? statusIcons.paid} style={styles.noticeIcon} resizeMode="contain" />
                  {!notice.read_at ? <View style={styles.unreadDot} /> : null}
                </View>
                <View style={styles.noticeCopy}>
                  <View style={styles.noticeTitleRow}>
                    <Text style={[styles.noticeTitle, !notice.read_at && styles.unreadTitle]}>{notice.title}</Text>
                    <Text style={styles.orderNumber}>{formatOrderNumber(order.order_number)}</Text>
                  </View>
                  <Text style={styles.noticeBody}>{notice.body}</Text>
                  <Text style={styles.noticeTime}>{formatDateTime(notice.created_at)}{order.pickup_at ? ` · 픽업 ${formatTime(order.pickup_at)}` : ''}</Text>

                  {expanded ? (
                    <View style={styles.orderDetail}>
                      <View style={styles.detailDivider} />
                      {order.order_items.map((item) => (
                        <View key={item.id} style={styles.detailItem}>
                          <View style={styles.detailItemCopy}><Text style={styles.detailItemName}>{item.menu_name} × {item.quantity}</Text><Text style={styles.detailOptions}>{formatOptions(item)}</Text></View>
                          <Text style={styles.detailPrice}>{won(item.line_total)}</Text>
                        </View>
                      ))}
                      {notice.status.includes('cancel') && order.cancellation_reason ? <View style={styles.cancelReason}><Text style={styles.cancelReasonLabel}>취소 사유</Text><Text style={styles.cancelReasonText}>{order.cancellation_reason}</Text></View> : null}
                      <View style={styles.detailTotal}><Text style={styles.detailTotalLabel}>총 결제금액</Text><Text style={styles.detailTotalPrice}>{won(order.total_amount)}</Text></View>
                    </View>
                  ) : <Text style={styles.detailGuide}>눌러서 주문 상세보기</Text>}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function won(price: number) { return `${price.toLocaleString('ko-KR')}원`; }
function formatOptions(item: NoticeOrderItem) {
  return [item.temperature, item.extra_shot_count > 0 && `샷 추가 × ${item.extra_shot_count}`, item.lightly && '연하게', item.soy_milk && '두유 변경', item.personal_tumbler && '개인 텀블러'].filter(Boolean).join(' · ');
}
function formatDateTime(value: string) { return new Date(value).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function formatTime(value: string) { return new Date(value).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }); }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  close: { width: 62, color: colors.dark, fontSize: 30, lineHeight: 34 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: colors.dark, fontSize: 19, fontWeight: '900' },
  unreadCount: { minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.orange, color: colors.white, fontSize: 10, lineHeight: 19, textAlign: 'center', fontWeight: '900' },
  markAll: { width: 62, color: colors.orange, fontSize: 11, textAlign: 'right', fontWeight: '900' },
  markAllDisabled: { color: '#B8AEA7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingBottom: 70 },
  emptyIcon: { fontSize: 42 },
  emptyTitle: { marginTop: 14, color: colors.dark, fontSize: 18, fontWeight: '900' },
  emptyText: { marginTop: 7, color: colors.muted, fontSize: 13 },
  noticeCard: { flexDirection: 'row', paddingHorizontal: 4, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: '#E9DED5' },
  unreadCard: { backgroundColor: 'rgba(242,107,58,0.035)' },
  noticeCardPressed: { opacity: 0.6 },
  iconArea: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  noticeIcon: { width: 27, height: 27 },
  unreadDot: { position: 'absolute', top: 2, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.orange },
  noticeCopy: { flex: 1, marginLeft: 12 },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  noticeTitle: { flex: 1, color: colors.dark, fontSize: 16, fontWeight: '800' },
  unreadTitle: { fontWeight: '900' },
  orderNumber: { color: colors.orange, fontSize: 13, fontWeight: '900' },
  noticeBody: { marginTop: 5, color: colors.muted, fontSize: 13, lineHeight: 19 },
  noticeTime: { marginTop: 8, color: '#A3978F', fontSize: 10, fontWeight: '700' },
  detailGuide: { marginTop: 9, color: colors.orange, fontSize: 10, fontWeight: '800' },
  orderDetail: { marginTop: 12 },
  detailDivider: { height: 1, marginBottom: 12, backgroundColor: '#E9DED5' },
  detailItem: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  detailItemCopy: { flex: 1 },
  detailItemName: { color: colors.dark, fontSize: 12, fontWeight: '900' },
  detailOptions: { marginTop: 4, color: colors.muted, fontSize: 11, lineHeight: 16 },
  detailPrice: { color: colors.dark, fontSize: 12, fontWeight: '800' },
  cancelReason: { marginBottom: 12, padding: 11, borderRadius: 12, backgroundColor: '#F5ECE7' },
  cancelReasonLabel: { color: '#966756', fontSize: 10, fontWeight: '900' },
  cancelReasonText: { marginTop: 4, color: colors.dark, fontSize: 12, lineHeight: 17 },
  detailTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E9DED5' },
  detailTotalLabel: { color: colors.dark, fontSize: 12, fontWeight: '800' },
  detailTotalPrice: { color: colors.orange, fontSize: 14, fontWeight: '900' },
});
