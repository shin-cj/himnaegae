import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Menu = {
  id: number;
  emoji: string;
  name: string;
  description: string;
  price: number;
  tag?: string;
};

const menus: Menu[] = [
  { id: 1, emoji: '☕', name: '힘내개 아메리카노', description: '고소하고 깔끔한 매일의 커피', price: 4500, tag: 'BEST' },
  { id: 2, emoji: '🥛', name: '우유거품 카페라떼', description: '부드러운 우유와 진한 에스프레소', price: 5200 },
  { id: 3, emoji: '🍓', name: '딴기 크림 라떼', description: '달콤상콤한 딴기와 크림', price: 5900, tag: 'NEW' },
];

const won = (price: number) => `${price.toLocaleString('ko-KR')}원`;

export default function App() {
  const [cart, setCart] = useState<Record<number, number>>({});
  const count = useMemo(() => Object.values(cart).reduce((sum, value) => sum + value, 0), [cart]);
  const total = useMemo(
    () => menus.reduce((sum, menu) => sum + menu.price * (cart[menu.id] ?? 0), 0),
    [cart],
  );

  const addMenu = (id: number) => {
    setCart((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>픽업 주문</Text>
            <Text style={styles.logo}>힘내개</Text>
          </View>
          <View style={styles.openBadge}>
            <View style={styles.openDot} />
            <Text style={styles.openText}>영업 중</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroKicker}>TODAY'S MESSAGE</Text>
          <Text style={styles.heroTitle}>오늘도 힘내개!</Text>
          <Text style={styles.heroBody}>주문하고 기다림 없이{`\n`}따뜻한 커피를 픽업하세요.</Text>
          <Text style={styles.heroPaw}>🐾</Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>인기 메뉴</Text>
          <Text style={styles.sectionLink}>전체보기</Text>
        </View>

        {menus.map((menu) => (
          <View key={menu.id} style={styles.menuCard}>
            <View style={styles.menuImage}>
              <Text style={styles.menuEmoji}>{menu.emoji}</Text>
            </View>
            <View style={styles.menuInfo}>
              <View style={styles.menuTitleRow}>
                <Text style={styles.menuName}>{menu.name}</Text>
                {menu.tag ? <Text style={styles.tag}>{menu.tag}</Text> : null}
              </View>
              <Text style={styles.menuDescription}>{menu.description}</Text>
              <Text style={styles.menuPrice}>{won(menu.price)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${menu.name} 담기`}
              onPress={() => addMenu(menu.id)}
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            >
              <Text style={styles.addButtonText}>+</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.orderInfo}>
          <Text style={styles.orderInfoIcon}>⏱</Text>
          <View>
            <Text style={styles.orderInfoTitle}>예상 픽업 10~15분</Text>
            <Text style={styles.orderInfoText}>준비가 끝나면 알림을 보내드려요.</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomArea}>
        {count > 0 ? (
          <Pressable style={({ pressed }) => [styles.cartButton, pressed && styles.pressed]}>
            <View style={styles.cartCount}>
              <Text style={styles.cartCountText}>{count}</Text>
            </View>
            <Text style={styles.cartButtonText}>장바구니 보기</Text>
            <Text style={styles.cartTotal}>{won(total)}</Text>
          </Pressable>
        ) : (
          <View style={styles.tabBar}>
            <Text style={styles.activeTab}>⌂{`\n`}홈</Text>
            <Text style={styles.tab}>☕{`\n`}메뉴</Text>
            <Text style={styles.tab}>▣{`\n`}주문</Text>
            <Text style={styles.tab}>☺{`\n`}마이</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const colors = {
  cream: '#FFF9EE',
  orange: '#F26B3A',
  dark: '#2B211D',
  muted: '#74665E',
  mint: '#DFF2DF',
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  eyebrow: { color: colors.orange, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  logo: { color: colors.dark, fontSize: 30, fontWeight: '900', marginTop: 2 },
  openBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.mint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  openDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3F9B55' },
  openText: { color: '#317440', fontSize: 12, fontWeight: '800' },
  hero: { minHeight: 190, overflow: 'hidden', backgroundColor: colors.orange, borderRadius: 26, padding: 24, marginBottom: 30 },
  heroKicker: { color: '#FFD9C8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  heroTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', marginTop: 10 },
  heroBody: { color: '#FFF2EA', fontSize: 15, lineHeight: 22, marginTop: 12, fontWeight: '600' },
  heroPaw: { position: 'absolute', right: -6, bottom: -22, fontSize: 104, opacity: 0.24, transform: [{ rotate: '-16deg' }] },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { color: colors.dark, fontSize: 21, fontWeight: '900' },
  sectionLink: { color: colors.orange, fontSize: 13, fontWeight: '800' },
  menuCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 20, marginBottom: 12, shadowColor: '#6E5140', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  menuImage: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#F6ECDD' },
  menuEmoji: { fontSize: 34 },
  menuInfo: { flex: 1, paddingHorizontal: 12 },
  menuTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuName: { flexShrink: 1, color: colors.dark, fontSize: 15, fontWeight: '900' },
  tag: { color: colors.orange, backgroundColor: '#FFF0E9', fontSize: 8, fontWeight: '900', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6 },
  menuDescription: { color: colors.muted, fontSize: 11, marginTop: 5 },
  menuPrice: { color: colors.dark, fontSize: 14, fontWeight: '900', marginTop: 7 },
  addButton: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  addButtonText: { color: '#FFFFFF', fontSize: 24, lineHeight: 27 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  orderInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F3EBDD', borderRadius: 18, padding: 16, marginTop: 8 },
  orderInfoIcon: { fontSize: 25 },
  orderInfoTitle: { color: colors.dark, fontSize: 13, fontWeight: '900' },
  orderInfoText: { color: colors.muted, fontSize: 11, marginTop: 3 },
  bottomArea: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingBottom: 12, paddingTop: 10, backgroundColor: 'rgba(255,249,238,0.96)' },
  cartButton: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderRadius: 18, paddingHorizontal: 16, backgroundColor: colors.orange },
  cartCount: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  cartCountText: { color: colors.orange, fontWeight: '900' },
  cartButtonText: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginLeft: 10 },
  cartTotal: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#FFFFFF', borderRadius: 22, paddingVertical: 10, shadowColor: '#6E5140', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  tab: { minWidth: 55, textAlign: 'center', color: '#A39891', fontSize: 11, lineHeight: 19, fontWeight: '700' },
  activeTab: { minWidth: 55, textAlign: 'center', color: colors.orange, fontSize: 11, lineHeight: 19, fontWeight: '900' },
});
