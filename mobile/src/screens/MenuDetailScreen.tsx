import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import type { Menu, MenuSelection, MenuTemperature } from '../types/menu';

type MenuDetailScreenProps = {
  menu: Menu;
  onAddToCart: (menu: Menu, selection: MenuSelection) => void;
  onClose: () => void;
  initialSelection?: MenuSelection;
  submitLabel?: string;
};

const won = (price: number) => `${price.toLocaleString('ko-KR')}원`;

export function MenuDetailScreen({ menu, onAddToCart, onClose, initialSelection, submitLabel = '장바구니 담기' }: MenuDetailScreenProps) {
  const allowedTemperature: MenuTemperature = menu.temperature ?? 'BOTH';
  const [temperature, setTemperature] = useState<'HOT' | 'ICE'>(initialSelection?.temperature ?? (allowedTemperature === 'HOT' ? 'HOT' : 'ICE'));
  const [extraShot, setExtraShot] = useState(initialSelection?.extraShot ?? false);
  const [soyMilk, setSoyMilk] = useState(initialSelection?.soyMilk ?? false);
  const [personalTumbler, setPersonalTumbler] = useState(initialSelection?.personalTumbler ?? false);
  const [quantity, setQuantity] = useState(initialSelection?.quantity ?? 1);

  const unitPrice = useMemo(
    () => menu.price + (extraShot ? 500 : 0) - (personalTumbler ? 200 : 0),
    [extraShot, menu.price, personalTumbler],
  );

  const temperatureEnabled = (value: 'HOT' | 'ICE') => allowedTemperature === 'BOTH' || allowedTemperature === value;

  const addToCart = () => {
    onAddToCart(menu, { temperature, extraShot, soyMilk, personalTumbler, quantity });
    onClose();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>×</Text></Pressable>
        <Text style={styles.headerTitle}>메뉴 상세</Text>
        <View style={styles.headerSpace} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.menuImage}>
          {menu.imageUrl ? <Image source={{ uri: menu.imageUrl }} style={styles.menuPhoto} resizeMode="cover" /> : <Text style={styles.menuEmoji}>{menu.emoji}</Text>}
        </View>
        <Text style={styles.menuName}>{menu.name}</Text>
        <Text style={styles.description}>{menu.description}</Text>
        <Text style={styles.basePrice}>{won(menu.price)}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>온도 선택</Text>
          <View style={styles.temperatureRow}>
            {(['HOT', 'ICE'] as const).map((value) => {
              const enabled = temperatureEnabled(value);
              const selected = temperature === value;
              return (
                <Pressable
                  key={value}
                  disabled={!enabled}
                  onPress={() => setTemperature(value)}
                  style={[styles.temperatureButton, selected && styles.selectedButton, !enabled && styles.disabledButton]}
                >
                  <Text style={[styles.temperatureText, selected && styles.selectedButtonText, !enabled && styles.disabledText]}>{value}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>추가 옵션</Text>
          <OptionRow label="샷 추가" price="+500원" selected={extraShot} onPress={() => setExtraShot((value) => !value)} />
          <OptionRow label="두유로 변경" price="무료" selected={soyMilk} onPress={() => setSoyMilk((value) => !value)} />
          <OptionRow label="개인 텀블러" price="-200원" selected={personalTumbler} onPress={() => setPersonalTumbler((value) => !value)} />
        </View>

        <View style={styles.quantityRow}>
          <Text style={styles.sectionTitle}>수량</Text>
          <View style={styles.quantityControl}>
            <Pressable disabled={quantity === 1} onPress={() => setQuantity((value) => Math.max(1, value - 1))} style={styles.quantityButton}>
              <Text style={[styles.quantityButtonText, quantity === 1 && styles.disabledText]}>−</Text>
            </Pressable>
            <Text style={styles.quantity}>{quantity}</Text>
            <Pressable onPress={() => setQuantity((value) => value + 1)} style={styles.quantityButton}>
              <Text style={styles.quantityButtonText}>+</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomArea}>
        <Pressable onPress={addToCart} style={({ pressed }) => [styles.cartButton, pressed && styles.pressed]}>
          <Text style={styles.cartButtonText}>{submitLabel}</Text>
          <Text style={styles.cartButtonPrice}>{won(unitPrice * quantity)}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

type OptionRowProps = {
  label: string;
  price: string;
  selected: boolean;
  onPress: () => void;
};

function OptionRow({ label, price, selected, onPress }: OptionRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.optionRow}>
      <View style={[styles.check, selected && styles.selectedCheck]}>
        {selected ? <Text style={styles.checkText}>✓</Text> : null}
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
      <Text style={styles.optionPrice}>{price}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  close: { width: 36, color: colors.dark, fontSize: 30, lineHeight: 34 },
  headerTitle: { color: colors.dark, fontSize: 18, fontWeight: '900' },
  headerSpace: { width: 36 },
  content: { paddingHorizontal: 22, paddingBottom: 130 },
  menuImage: { height: 170, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: '#F3E7D8', marginTop: 8 },
  menuPhoto: { width: '100%', height: '100%', borderRadius: 28 },
  menuEmoji: { fontSize: 76 },
  menuName: { color: colors.dark, fontSize: 25, fontWeight: '900', marginTop: 22 },
  description: { color: colors.muted, fontSize: 14, marginTop: 8 },
  basePrice: { color: colors.dark, fontSize: 19, fontWeight: '900', marginTop: 12 },
  section: { marginTop: 28 },
  sectionTitle: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  temperatureRow: { flexDirection: 'row', gap: 10, marginTop: 13 },
  temperatureButton: { flex: 1, alignItems: 'center', paddingVertical: 13, borderWidth: 1, borderColor: '#DDD2C8', borderRadius: 14, backgroundColor: colors.white },
  selectedButton: { borderColor: colors.orange, backgroundColor: colors.orange },
  disabledButton: { backgroundColor: '#EFEAE5', borderColor: '#EFEAE5' },
  temperatureText: { color: colors.dark, fontSize: 13, fontWeight: '900' },
  selectedButtonText: { color: colors.white },
  disabledText: { color: '#B8AFA9' },
  optionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderBottomWidth: 1, borderBottomColor: '#EDE5DD' },
  check: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CFC3B9', borderRadius: 7, backgroundColor: colors.white },
  selectedCheck: { borderColor: colors.orange, backgroundColor: colors.orange },
  checkText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  optionLabel: { flex: 1, color: colors.dark, fontSize: 14, fontWeight: '700', marginLeft: 11 },
  optionPrice: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  quantityButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.white },
  quantityButtonText: { color: colors.dark, fontSize: 22, fontWeight: '800' },
  quantity: { minWidth: 20, color: colors.dark, fontSize: 16, textAlign: 'center', fontWeight: '900' },
  bottomArea: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: 'rgba(255,249,238,0.97)' },
  cartButton: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderRadius: 18, paddingHorizontal: 18, backgroundColor: colors.orange },
  cartButtonText: { flex: 1, color: colors.white, fontSize: 15, fontWeight: '900' },
  cartButtonPrice: { color: colors.white, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.7 },
});
