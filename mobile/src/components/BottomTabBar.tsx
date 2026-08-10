import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

export type AppTab = 'home' | 'menu' | 'orders' | 'my';

type BottomTabBarProps = {
  activeTab: AppTab;
  onSelect: (tab: AppTab) => void;
};

const tabs: Array<{ key: AppTab; label: string }> = [
  { key: 'home', label: '홈' },
  { key: 'menu', label: '메뉴' },
  { key: 'orders', label: '주문' },
  { key: 'my', label: '마이' },
];

export function BottomTabBar({ activeTab, onSelect }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.area, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(tab.key)}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
              <View style={[styles.indicator, active && styles.activeIndicator]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 8, backgroundColor: 'rgba(255,249,238,0.96)' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', minHeight: 58, backgroundColor: colors.white, borderRadius: 22, paddingVertical: 8, shadowColor: '#6E5140', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  button: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', gap: 5 },
  label: { color: '#A39891', fontSize: 15, fontWeight: '700' },
  activeLabel: { color: colors.orange, fontWeight: '900' },
  indicator: { width: 4, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  activeIndicator: { width: 18, backgroundColor: colors.orange },
  pressed: { opacity: 0.55 },
});
