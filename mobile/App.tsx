import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomTabBar, type AppTab } from './src/components/BottomTabBar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { menus as fallbackMenus } from './src/data/menus';
import { CartScreen, type PickupChoice } from './src/screens/CartScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MenuDetailScreen } from './src/screens/MenuDetailScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { NotificationCenterScreen } from './src/screens/NotificationCenterScreen';
import { MyScreen } from './src/screens/MyScreen';
import { OrdersScreen } from './src/screens/OrdersScreen';
import { PasswordRecoveryScreen } from './src/screens/PasswordRecoveryScreen';
import { TossPaymentScreen, type TossPaymentSession } from './src/screens/TossPaymentScreen';
import { supabase } from './src/lib/supabase';
import { addNotificationTapListener, getNotificationPermission, registerForOrderNotifications, showOrderStatusNotification, usesExpoGo } from './src/lib/notifications';
import { formatOrderNumber } from './src/lib/order-number';
import type { CartItem, Menu, MenuSelection } from './src/types/menu';
import type { StoreSettings } from './src/types/store';

const tabs: AppTab[] = ['home', 'menu', 'orders', 'my'];
const defaultStoreSettings: StoreSettings = {
  storeName: '힘내개 본점', businessStatus: 'open', notice: '', phone: '', address: '',
  openTime: '09:00', closeTime: '20:00', pickupMin: 10, pickupMax: 15,
  pickupGuide: '준비가 끝나면 알림을 보내드려요.',
};

function defaultCustomPickupTime() {
  const time = new Date(Date.now() + 20 * 60 * 1000);
  time.setMinutes(Math.ceil(time.getMinutes() / 5) * 5, 0, 0);
  return time;
}

function resolvePickupTime(choice: PickupChoice, customTime: Date) {
  if (choice !== 'custom') return new Date(Date.now() + choice * 60 * 1000);
  const pickupTime = new Date(customTime);
  if (pickupTime.getTime() < Date.now()) pickupTime.setDate(pickupTime.getDate() + 1);
  return pickupTime;
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { passwordRecovery, user } = useAuth();
  const pagerRef = useRef<PagerView>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [cartVisible, setCartVisible] = useState(false);
  const [paying, setPaying] = useState(false);
  const [pickupDelay, setPickupDelay] = useState<PickupChoice>(0);
  const [customPickupTime, setCustomPickupTime] = useState(defaultCustomPickupTime);
  const [paymentSession, setPaymentSession] = useState<TossPaymentSession | null>(null);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notificationOrderId, setNotificationOrderId] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [ordersRefreshToken, setOrdersRefreshToken] = useState(0);
  const [catalogMenus, setCatalogMenus] = useState<Menu[]>(fallbackMenus);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(defaultStoreSettings);

  useEffect(() => {
    let active = true;

    const loadMenus = async () => {
      const { data, error } = await supabase
        .from('menus')
        .select('id, category, emoji, name, description, price, temperature, tag, image_url, available')
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });

      if (!active || error || !data) return;
      setCatalogMenus(data.map((menu) => ({
        id: menu.id,
        category: menu.category,
        emoji: menu.emoji,
        name: menu.name,
        description: menu.description,
        price: menu.price,
        temperature: menu.temperature,
        tag: menu.tag ?? undefined,
        imageUrl: menu.image_url ?? undefined,
        available: menu.available,
      })) as Menu[]);
    };

    void loadMenus();
    const channel = supabase
      .channel('customer-menu-catalog')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, loadMenus)
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadStoreSettings = async () => {
      const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).single();
      if (!active || error || !data) return;
      setStoreSettings({
        storeName: data.store_name,
        businessStatus: data.business_status,
        notice: data.notice,
        phone: data.phone,
        address: data.address,
        openTime: String(data.open_time).slice(0, 5),
        closeTime: String(data.close_time).slice(0, 5),
        pickupMin: data.pickup_min,
        pickupMax: data.pickup_max,
        pickupGuide: data.pickup_guide,
      });
    };
    void loadStoreSettings();
    const channel = supabase.channel('customer-store-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, loadStoreSettings)
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, []);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);

  const addToCart = (menu: Menu, selection: MenuSelection) => {
    if (menu.available === false) {
      Alert.alert('품절된 메뉴예요', '다른 메뉴를 선택해주세요.');
      return;
    }
    const unitPrice = menu.price + selection.extraShotCount * 500 - (selection.personalTumbler ? 200 : 0);
    const key = [menu.id, selection.temperature, selection.extraShotCount, selection.lightly, selection.soyMilk, selection.personalTumbler].join('-');

    setCart((current) => {
      const withoutEditingItem = editingItem ? current.filter((item) => item.key !== editingItem.key) : current;
      const existing = withoutEditingItem.find((item) => item.key === key);
      if (existing) {
        return withoutEditingItem.map((item) => item.key === key ? { ...item, quantity: item.quantity + selection.quantity } : item);
      }
      return [...withoutEditingItem, { ...selection, key, menuId: menu.id, menuName: menu.name, unitPrice }];
    });
  };

  const closeDetail = () => {
    setSelectedMenu(null);
    if (editingItem) setCartVisible(true);
    setEditingItem(null);
  };

  const editCartItem = (item: CartItem) => {
    const menu = catalogMenus.find((candidate) => candidate.id === item.menuId);
    if (!menu) return;
    setCartVisible(false);
    setEditingItem(item);
    setSelectedMenu(menu);
  };

  const updateQuantity = (key: string, amount: number) => {
    setCart((current) => current.map((item) => item.key === key ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item));
  };

  const openTab = (tab: AppTab) => {
    const index = tabs.indexOf(tab);
    setActiveTab(tab);
    pagerRef.current?.setPage(index);
  };

  useEffect(() => {
    const subscription = addNotificationTapListener(({ orderId }) => {
      setNotificationOrderId(orderId);
      setNotificationsVisible(true);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!user || usesExpoGo()) return;
    void getNotificationPermission().then((enabled) => {
      if (enabled) void registerForOrderNotifications(user.id);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`customer-order-alerts-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const changedOrder = payload.new as { id?: string; order_number?: string; status?: string };
        setOrdersRefreshToken((current) => current + 1);
        if (changedOrder.id && changedOrder.status && changedOrder.status !== 'cancel_requested' && changedOrder.order_number && usesExpoGo()) {
          void showOrderStatusNotification(changedOrder.id, changedOrder.order_number, changedOrder.status);
        }
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!user) { setUnreadNotifications(0); return; }
    const loadUnread = async () => {
      const { count } = await supabase
        .from('order_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      setUnreadNotifications(count ?? 0);
    };
    void loadUnread();
    const channel = supabase.channel(`customer-notification-badge-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_notifications', filter: `user_id=eq.${user.id}` }, () => void loadUnread())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  const payForTestOrder = () => {
    if (storeSettings.businessStatus !== 'open') {
      Alert.alert(storeSettings.businessStatus === 'paused' ? '지금은 주문을 잠시 쉬고 있어요' : '오늘 영업이 끝났어요', '매장이 주문을 다시 시작하면 이용해주세요.');
      return;
    }
    if (!user) {
      setCartVisible(false);
      openTab('my');
      Alert.alert('로그인이 필요해요', '로그인한 뒤 장바구니에서 다시 테스트 결제를 눌러주세요.');
      return;
    }

    Alert.alert('테스트 결제', `${cartTotal.toLocaleString('ko-KR')}원을 테스트 결제할까요?\n실제 돈은 결제되지 않아요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '결제하기',
        onPress: async () => {
          try {
            setPaying(true);
            const tossClientKey = process.env.EXPO_PUBLIC_TOSS_CLIENT_KEY;
            if (!tossClientKey) throw new Error('토스 클라이언트 키가 없어요.');
            const pickupAt = resolvePickupTime(pickupDelay, customPickupTime);
            const { data, error } = await supabase.functions.invoke('toss-payment', {
              body: { pickup_at: pickupAt.toISOString(), pickup_type: pickupDelay === 0 ? 'asap' : 'scheduled', items: cart.map((item) => ({
                menu_id: item.menuId,
                menu_name: item.menuName,
                temperature: item.temperature,
                extra_shot: item.extraShotCount > 0,
                extra_shot_count: item.extraShotCount,
                lightly: item.lightly,
                soy_milk: item.soyMilk,
                personal_tumbler: item.personalTumbler,
                quantity: item.quantity,
                unit_price: item.unitPrice,
              })) },
            });
            if (error) throw error;
            if (!data?.orderId || !data?.successUrl || !data?.failUrl) throw new Error(data?.error ?? '결제 준비에 실패했어요.');
            const nextPaymentSession: TossPaymentSession = {
              clientKey: tossClientKey,
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              amount: data.amount,
              orderName: data.orderName,
              customerEmail: data.customerEmail,
              pickupLabel: pickupDelay === 'custom'
                ? `${customPickupTime.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}에 픽업할게요`
                : pickupDelay === 0 ? '바로 픽업할게요!' : `${pickupDelay}분 후 픽업할게요`,
              successUrl: data.successUrl,
              failUrl: data.failUrl,
            };
            setCartVisible(false);
            setTimeout(() => setPaymentSession(nextPaymentSession), 450);
          } catch (error) {
            Alert.alert('테스트 결제 실패', error instanceof Error ? error.message : '다시 시도해주세요.');
          } finally {
            setPaying(false);
          }
        },
      },
    ]);
  };

  const confirmTossPayment = async (payment: { paymentKey: string; orderId: string; amount: number }) => {
    const completedSession = paymentSession;
    setPaymentSession(null);
    try {
      setPaying(true);
      const { data, error } = await supabase.functions.invoke('toss-payment', {
        body: { action: 'confirm', ...payment },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? '결제 승인에 실패했어요.');

      setCart([]);
      setCartVisible(false);
      setOrdersRefreshToken((current) => current + 1);
      openTab('orders');
      Alert.alert('토스 테스트 결제 완료', completedSession?.orderNumber ? `주문번호 ${formatOrderNumber(String(completedSession.orderNumber))}` : '주문이 정상적으로 저장됐어요.');
    } catch (error) {
      Alert.alert('결제 승인 실패', error instanceof Error ? error.message : '다시 시도해주세요.');
    } finally {
      setPaying(false);
    }
  };

  const closePayment = (message?: string) => {
    setPaymentSession(null);
    setTimeout(() => setCartVisible(true), 450);
    if (message) Alert.alert('결제가 완료되지 않았어요', message);
  };

  return (
    <View style={styles.app}>
      <Modal visible={passwordRecovery} animationType="slide" presentationStyle="fullScreen">
        <PasswordRecoveryScreen />
      </Modal>
          <StatusBar style="dark" />
          <PagerView
            ref={pagerRef}
            style={styles.pager}
            initialPage={0}
            onPageSelected={(event) => setActiveTab(tabs[event.nativeEvent.position])}
          >
            <View key="home" style={styles.page} collapsable={false}>
              <HomeScreen
                menus={catalogMenus}
                storeSettings={storeSettings}
                cartCount={cartCount}
                cartTotal={cartTotal}
                onSelectMenu={setSelectedMenu}
                onOpenMenu={() => openTab('menu')}
                onOpenCart={() => setCartVisible(true)}
                onOpenNotifications={() => setNotificationsVisible(true)}
                unreadNotifications={unreadNotifications}
              />
            </View>
            <View key="menu" style={styles.page} collapsable={false}>
              <MenuScreen
                menus={catalogMenus}
                cartCount={cartCount}
                cartTotal={cartTotal}
                onSelectMenu={setSelectedMenu}
                onBack={() => openTab('home')}
                onOpenCart={() => setCartVisible(true)}
              />
            </View>
            <View key="orders" style={styles.page} collapsable={false}>
              <OrdersScreen onOpenMy={() => openTab('my')} refreshToken={ordersRefreshToken} />
            </View>
            <View key="my" style={styles.page} collapsable={false}>
              <MyScreen />
            </View>
          </PagerView>
          <BottomTabBar activeTab={activeTab} onSelect={openTab} />
          <Modal visible={selectedMenu !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeDetail}>
            {selectedMenu ? (
              <MenuDetailScreen
                menu={selectedMenu}
                onAddToCart={addToCart}
                onClose={closeDetail}
                initialSelection={editingItem ?? undefined}
                submitLabel={editingItem ? '옵션 변경하기' : '장바구니 담기'}
              />
            ) : null}
          </Modal>
          <Modal visible={cartVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCartVisible(false)}>
            <CartScreen
              items={cart}
              total={cartTotal}
              onClose={() => setCartVisible(false)}
              onIncrease={(key) => updateQuantity(key, 1)}
              onDecrease={(key) => updateQuantity(key, -1)}
              onRemove={(key) => setCart((current) => current.filter((item) => item.key !== key))}
              onEdit={editCartItem}
              onPay={payForTestOrder}
              paying={paying}
              pickupDelay={pickupDelay}
              onPickupDelayChange={setPickupDelay}
              customPickupTime={customPickupTime}
              onCustomPickupTimeChange={setCustomPickupTime}
            />
          </Modal>
          <Modal visible={notificationsVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setNotificationsVisible(false); setNotificationOrderId(null); }}>
            <NotificationCenterScreen
              initialOrderId={notificationOrderId}
              onInitialOrderHandled={() => setNotificationOrderId(null)}
              onClose={() => { setNotificationsVisible(false); setNotificationOrderId(null); }}
              onUnreadChange={setUnreadNotifications}
            />
          </Modal>
          <Modal visible={paymentSession !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => closePayment()}>
            {paymentSession ? (
              <TossPaymentScreen
                session={paymentSession}
                onClose={() => closePayment()}
                onSuccess={confirmTossPayment}
                onFail={closePayment}
              />
            ) : null}
          </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  pager: { flex: 1 },
  page: { flex: 1 },
});
