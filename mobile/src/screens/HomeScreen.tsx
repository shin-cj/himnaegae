import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartButton } from '../components/CartButton';
import { MenuCard } from '../components/MenuCard';
import { colors } from '../theme/colors';
import type { Menu } from '../types/menu';
import type { StoreSettings } from '../types/store';

type HomeScreenProps = {
  menus: Menu[];
  storeSettings: StoreSettings;
  cartCount: number;
  cartTotal: number;
  onSelectMenu: (menu: Menu) => void;
  onOpenMenu: () => void;
  onOpenCart: () => void;
  onOpenNotifications: () => void;
};

const banners = [
  {
    id: 1,
    kicker: "TODAY'S MESSAGE",
    title: '오늘도 힘내개!',
    body: '주문하고 기다림 없이\n따뜻한 커피를 픽업하세요.',
    symbol: '🐾',
    backgroundColor: '#F26B3A',
  },
  {
    id: 2,
    kicker: 'PICKUP ORDER',
    title: '미리 주문하개!',
    body: '원하는 메뉴를 담고\n편한 시간에 바로 픽업하세요.',
    symbol: '☕',
    backgroundColor: '#6F5337',
  },
  {
    id: 3,
    kicker: 'PERSONAL TUMBLER',
    title: '텀블러 챙기개!',
    body: '개인 텀블러를 사용하면\n200원을 할인해드려요.',
    symbol: '🌿',
    backgroundColor: '#4F7657',
  },
];

export function HomeScreen({ menus, storeSettings, cartCount, cartTotal, onSelectMenu, onOpenMenu, onOpenCart, onOpenNotifications }: HomeScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerWidth = width - 40;
  const featuredMenus = menus.filter((menu) => menu.category === 'BEST_NEW').slice(0, 3);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>픽업 주문</Text>
            <Text style={styles.logo}>{storeSettings.storeName}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="알림함 열기" onPress={onOpenNotifications} hitSlop={8} style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}>
              <Text style={styles.bellIcon}>🔔</Text>
            </Pressable>
            <View style={[styles.openBadge, storeSettings.businessStatus !== 'open' && styles.closedBadge]}>
              <View style={[styles.openDot, storeSettings.businessStatus !== 'open' && styles.closedDot]} />
              <Text style={[styles.openText, storeSettings.businessStatus !== 'open' && styles.closedText]}>{storeSettings.businessStatus === 'open' ? '영업 중' : storeSettings.businessStatus === 'paused' ? '주문 잠시 중지' : '영업 종료'}</Text>
            </View>
          </View>
        </View>

        {storeSettings.notice ? <View style={styles.notice}><Text style={styles.noticeIcon}>📢</Text><Text style={styles.noticeText}>{storeSettings.notice}</Text></View> : null}

        <View style={styles.bannerArea}>
          <ScrollView
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              setBannerIndex(Math.round(event.nativeEvent.contentOffset.x / bannerWidth));
            }}
          >
            {banners.map((banner) => (
              <View key={banner.id} style={[styles.hero, { width: bannerWidth, backgroundColor: banner.backgroundColor }]}>
                <Text style={styles.heroKicker}>{banner.kicker}</Text>
                <Text style={styles.heroTitle}>{banner.title}</Text>
                <Text style={styles.heroBody}>{banner.body}</Text>
                <Text style={styles.heroPaw}>{banner.symbol}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.bannerDots}>
            {banners.map((banner, index) => (
              <View key={banner.id} style={[styles.bannerDot, index === bannerIndex && styles.activeBannerDot]} />
            ))}
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>인기 메뉴</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="전체 메뉴 보기"
            onPress={onOpenMenu}
            hitSlop={16}
            style={({ pressed }) => [styles.viewAllButton, pressed && styles.pressed]}
          >
            <Text style={styles.sectionLink}>전체보기  ›</Text>
          </Pressable>
        </View>

        {featuredMenus.map((menu) => <MenuCard key={menu.id} menu={menu} onPress={onSelectMenu} />)}

        <View style={styles.orderInfo}>
          <Text style={styles.orderInfoIcon}>⏱</Text>
          <View>
            <Text style={styles.orderInfoTitle}>예상 픽업 {storeSettings.pickupMin}~{storeSettings.pickupMax}분</Text>
            <Text style={styles.orderInfoText}>{storeSettings.pickupGuide}</Text>
          </View>
        </View>
      </ScrollView>

      {cartCount > 0 ? (
        <View style={[styles.cartArea, { bottom: 78 + insets.bottom }]}><CartButton count={cartCount} total={cartTotal} onPress={onOpenCart} /></View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  eyebrow: { color: colors.orange, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  logo: { color: colors.dark, fontSize: 30, fontWeight: '900', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  bellIcon: { fontSize: 17 },
  openBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.mint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  openDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3F9B55' },
  openText: { color: '#317440', fontSize: 12, fontWeight: '800' },
  closedBadge: { backgroundColor: '#EFE8E3' },
  closedDot: { backgroundColor: '#8E8179' },
  closedText: { color: '#746861' },
  bannerArea: { marginBottom: 30 },
  hero: { minHeight: 190, overflow: 'hidden', borderRadius: 26, padding: 24 },
  heroKicker: { color: '#FFD9C8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  heroTitle: { color: colors.white, fontSize: 30, fontWeight: '900', marginTop: 10 },
  heroBody: { color: '#FFF2EA', fontSize: 15, lineHeight: 22, marginTop: 12, fontWeight: '600' },
  heroPaw: { position: 'absolute', right: -6, bottom: -22, fontSize: 104, opacity: 0.24, transform: [{ rotate: '-16deg' }] },
  bannerDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  bannerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D7CCC3' },
  activeBannerDot: { width: 18, backgroundColor: colors.orange },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: -14, marginBottom: 24, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 15, backgroundColor: '#FFF0E9' },
  noticeIcon: { fontSize: 16 },
  noticeText: { flex: 1, color: '#9C4D31', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { color: colors.dark, fontSize: 21, fontWeight: '900' },
  viewAllButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8, marginRight: -8 },
  sectionLink: { color: colors.orange, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.55 },
  orderInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F3EBDD', borderRadius: 18, padding: 16, marginTop: 8 },
  orderInfoIcon: { fontSize: 25 },
  orderInfoTitle: { color: colors.dark, fontSize: 13, fontWeight: '900' },
  orderInfoText: { color: colors.muted, fontSize: 11, marginTop: 3 },
  cartArea: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: 'rgba(255,249,238,0.96)' },
});
