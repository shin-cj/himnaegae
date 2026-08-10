import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { Menu } from '../types/menu';

type MenuCardProps = {
  menu: Menu;
  onPress: (menu: Menu) => void;
};

const won = (price: number) => `${price.toLocaleString('ko-KR')}원`;

export function MenuCard({ menu, onPress }: MenuCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${menu.name} 상세 보기`}
      onPress={() => onPress(menu)}
      style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
    >
      <View style={styles.image}>
        <Text style={styles.emoji}>{menu.emoji}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{menu.name}</Text>
          {menu.tag ? <Text style={styles.tag}>{menu.tag}</Text> : null}
        </View>
        <Text style={styles.description}>{menu.description}</Text>
        <Text style={styles.price}>{won(menu.price)}</Text>
      </View>
      <View style={styles.addButton}>
        <Text style={styles.addButtonText}>+</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#6E5140',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  image: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#F6ECDD' },
  emoji: { fontSize: 34 },
  info: { flex: 1, paddingHorizontal: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, color: colors.dark, fontSize: 15, fontWeight: '900' },
  tag: { color: colors.orange, backgroundColor: '#FFF0E9', fontSize: 8, fontWeight: '900', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6 },
  description: { color: colors.muted, fontSize: 11, marginTop: 5 },
  price: { color: colors.dark, fontSize: 14, fontWeight: '900', marginTop: 7 },
  addButton: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  addButtonText: { color: colors.white, fontSize: 24, lineHeight: 27 },
  pressedCard: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
