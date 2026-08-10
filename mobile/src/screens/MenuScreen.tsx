import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartButton } from '../components/CartButton';
import { MenuCard } from '../components/MenuCard';
import { menuCategories, menus } from '../data/menus';
import { colors } from '../theme/colors';
import type { Menu } from '../types/menu';

type MenuScreenProps = {
  cartCount: number;
  cartTotal: number;
  onSelectMenu: (menu: Menu) => void;
  onBack: () => void;
  onOpenCart: () => void;
};

export function MenuScreen({ cartCount, cartTotal, onSelectMenu, onBack, onOpenCart }: MenuScreenProps) {
  const pagerRef = useRef<PagerView>(null);
  const insets = useSafeAreaInsets();
  const [categoryIndex, setCategoryIndex] = useState(0);

  const selectCategory = (index: number) => {
    setCategoryIndex(index);
    pagerRef.current?.setPage(index);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>전체 메뉴</Text>
        <View style={styles.headerSpace} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categories}
      >
        {menuCategories.map((item, index) => {
          const selected = index === categoryIndex;
          return (
            <Pressable key={item.key} onPress={() => selectCategory(index)} style={[styles.category, selected && styles.selectedCategory]}>
              <Text style={[styles.categoryText, selected && styles.selectedCategoryText]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <PagerView
        ref={pagerRef}
        style={styles.menuPager}
        initialPage={0}
        onPageSelected={(event) => setCategoryIndex(event.nativeEvent.position)}
      >
        {menuCategories.map((category) => {
          const categoryMenus = menus.filter((menu) => menu.category === category.key);
          return (
            <View key={category.key} style={styles.categoryPage} collapsable={false}>
              <ScrollView contentContainerStyle={styles.menuList} showsVerticalScrollIndicator={false}>
                {categoryMenus.length > 0 ? (
                  categoryMenus.map((menu) => <MenuCard key={menu.id} menu={menu} onPress={onSelectMenu} />)
                ) : (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>메뉴를 입력해주세요</Text>
                    <Text style={styles.emptyText}>src/data/menus.ts에 이 카테고리의 메뉴를 추가하면 여기에 표시됩니다.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          );
        })}
      </PagerView>

      {cartCount > 0 ? (
        <View style={[styles.cartArea, { bottom: 78 + insets.bottom }]}><CartButton count={cartCount} total={cartTotal} onPress={onOpenCart} /></View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  back: { width: 36, color: colors.dark, fontSize: 36, lineHeight: 36 },
  title: { color: colors.dark, fontSize: 21, fontWeight: '900' },
  headerSpace: { width: 36 },
  categoryScroll: { flexGrow: 0, flexShrink: 0, height: 62 },
  categories: { alignItems: 'center', paddingHorizontal: 20, gap: 8 },
  category: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: colors.white },
  selectedCategory: { backgroundColor: colors.dark },
  categoryText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  selectedCategoryText: { color: colors.white },
  menuPager: { flex: 1 },
  categoryPage: { flex: 1 },
  menuList: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 170 },
  empty: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 70 },
  emptyTitle: { color: colors.dark, fontSize: 17, fontWeight: '900' },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  cartArea: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: 'rgba(255,249,238,0.96)' },
});
