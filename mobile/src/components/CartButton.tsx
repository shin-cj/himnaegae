import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type CartButtonProps = {
  count: number;
  total: number;
  onPress: () => void;
};

export function CartButton({ count, total, onPress }: CartButtonProps) {
  if (count === 0) return null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <View style={styles.count}>
        <Text style={styles.countText}>{count}</Text>
      </View>
      <Text style={styles.label}>장바구니 보기</Text>
      <Text style={styles.total}>{total.toLocaleString('ko-KR')}원</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderRadius: 18, paddingHorizontal: 16, backgroundColor: colors.orange },
  count: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  countText: { color: colors.orange, fontWeight: '900' },
  label: { flex: 1, color: colors.white, fontSize: 15, fontWeight: '900', marginLeft: 10 },
  total: { color: colors.white, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
