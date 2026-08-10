import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomTabBar, type AppTab } from './src/components/BottomTabBar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { menus } from './src/data/menus';
import { CartScreen, type PickupChoice } from './src/screens/CartScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MenuDetailScreen } from './src/screens/MenuDetailScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { MyScreen } from './src/screens/MyScreen';
import { OrdersScreen } from './src/screens/OrdersScreen';
import { TossPaymentScreen, type TossPaymentSession } from './src/screens/TossPaymentScreen';
import { supabase } from './src/lib/supabase';
import type { CartItem, Menu, MenuSelection } from './src/types/menu';

const tabs: AppTab[] = ['home', 'menu', 'orders', 'my'];

function defaultCustomPickupTime() {
  const time = new Date(Date.now() + 20 * 60 * 1000);
  time.setMinutes(Math.ceil(time.getMinutes() / 5) * 5, 0, 0);
  return time;
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
  const { user } = useAuth();
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
  const [ordersRefreshToken, setOrdersRefreshToken] = useState(0);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);

  const addToCart = (menu: Menu, selection: MenuSelection) => {
    const unitPrice = menu.price + (selection.extraShot ? 500 : 0) - (selection.personalTumbler ? 200 : 0);
    const key = [menu.id, selection.temperature, selection.extraShot, selection.soyMilk, selection.personalTumbler].join('-');

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
    const menu = menus.find((candidate) => candidate.id === item.menuId);
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

  const payForTestOrder = () => {
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
            const { data, error } = await supabase.functions.invoke('toss-payment', {
              body: { clientKey: tossClientKey, items: cart.map((item) => ({
                menu_id: item.menuId,
                menu_name: item.menuName,
                temperature: item.temperature,
                extra_shot: item.extraShot,
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
      Alert.alert('토스 테스트 결제 완료', completedSession?.orderNumber ? `주문번호 ${completedSession.orderNumber}` : '주문이 정상적으로 저장됐어요.');
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
          <StatusBar style="dark" />
          <PagerView
            ref={pagerRef}
            style={styles.pager}
            initialPage={0}
            onPageSelected={(event) => setActiveTab(tabs[event.nativeEvent.position])}
          >
            <View key="home" style={styles.page} collapsable={false}>
              <HomeScreen
                cartCount={cartCount}
                cartTotal={cartTotal}
                onSelectMenu={setSelectedMenu}
                onOpenMenu={() => openTab('menu')}
                onOpenCart={() => setCartVisible(true)}
              />
            </View>
            <View key="menu" style={styles.page} collapsable={false}>
              <MenuScreen
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
