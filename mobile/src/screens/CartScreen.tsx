import DateTimePicker from '@react-native-community/datetimepicker';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import type { CartItem } from '../types/menu';

export type PickupChoice = 0 | 10 | 20 | 30 | 'custom';

type CartScreenProps = {
  items: CartItem[];
  total: number;
  onClose: () => void;
  onIncrease: (key: string) => void;
  onDecrease: (key: string) => void;
  onRemove: (key: string) => void;
  onEdit: (item: CartItem) => void;
  onPay: () => void;
  paying: boolean;
  pickupDelay: PickupChoice;
  onPickupDelayChange: (minutes: PickupChoice) => void;
  customPickupTime: Date;
  onCustomPickupTimeChange: (time: Date) => void;
};

const won = (price: number) => `${price.toLocaleString('ko-KR')}원`;
const pickupOptions = [
  { minutes: 0, label: '바로 갈게요!' },
  { minutes: 10, label: '10분 후' },
  { minutes: 20, label: '20분 후' },
  { minutes: 30, label: '30분 후' },
  { minutes: 'custom', label: '직접 설정' },
] satisfies { minutes: PickupChoice; label: string }[];

export function CartScreen({ items, total, onClose, onIncrease, onDecrease, onRemove, onEdit, onPay, paying, pickupDelay, onPickupDelayChange, customPickupTime, onCustomPickupTimeChange }: CartScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>×</Text></Pressable>
        <Text style={styles.title}>장바구니</Text>
        <View style={styles.headerSpace} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {items.length > 0 ? items.map((item) => (
          <View key={item.key} style={styles.itemCard}>
            <View style={styles.itemTop}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.menuName}</Text>
                <Text style={styles.options}>{optionText(item)}</Text>
              </View>
              <Pressable onPress={() => onEdit(item)} hitSlop={10}>
                <Text style={styles.edit}>옵션 수정</Text>
              </Pressable>
            </View>

            <View style={styles.itemBottom}>
              <View style={styles.quantityControl}>
                <Pressable
                  disabled={item.quantity === 1}
                  onPress={() => onDecrease(item.key)}
                  style={styles.quantityButton}
                >
                  <Text style={[styles.quantityButtonText, item.quantity === 1 && styles.disabledText]}>−</Text>
                </Pressable>
                <Text style={styles.quantity}>{item.quantity}</Text>
                <Pressable onPress={() => onIncrease(item.key)} style={styles.quantityButton}>
                  <Text style={styles.quantityButtonText}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.itemPrice}>{won(item.unitPrice * item.quantity)}</Text>
            </View>

            <Pressable onPress={() => onRemove(item.key)} hitSlop={8} style={styles.removeButton}>
              <Text style={styles.removeText}>삭제</Text>
            </Pressable>
          </View>
        )) : (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyTitle}>장바구니가 비어 있어요</Text>
            <Text style={styles.emptyText}>메뉴를 골라 장바구니에 담아주세요.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.summary}>
        {items.length > 0 ? (
          <View style={styles.pickupSection}>
            <View style={styles.pickupTitleRow}>
              <Text style={styles.pickupTitle}>언제 찾으러 오세요?</Text>
              <Text style={styles.pickupGuide}>픽업 예상 시간</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickupOptions}>
              {pickupOptions.map((option) => {
                const selected = pickupDelay === option.minutes;
                return (
                  <Pressable
                    key={option.minutes}
                    onPress={() => onPickupDelayChange(option.minutes)}
                    style={[styles.pickupOption, selected && styles.pickupOptionSelected]}
                  >
                    <Text style={[styles.pickupOptionText, selected && styles.pickupOptionTextSelected]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {pickupDelay === 'custom' ? (
              <View style={styles.customTimeRow}>
                <View>
                  <Text style={styles.customTimeTitle}>픽업 시간</Text>
                  <Text style={styles.customTimeText}>{formatTime(customPickupTime)}에 갈게요</Text>
                </View>
                <DateTimePicker
                  value={customPickupTime}
                  mode="time"
                  display="compact"
                  minuteInterval={5}
                  minimumDate={new Date()}
                  onChange={(_, date) => date && onCustomPickupTimeChange(date)}
                  accentColor={colors.orange}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>총 결제금액</Text>
          <Text style={styles.totalPrice}>{won(total)}</Text>
        </View>
        <Pressable
          disabled={items.length === 0 || paying}
          onPress={onPay}
          style={({ pressed }) => [styles.nextButton, items.length === 0 && styles.disabledNextButton, (pressed || paying) && styles.pressed]}
        >
          <Text style={styles.nextButtonText}>{paying ? '토스 결제 준비 중...' : items.length > 0 ? '토스 테스트 결제하기' : '메뉴를 담아주세요'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}

function optionText(item: CartItem) {
  const options: string[] = [item.temperature];
  if (item.extraShotCount > 0) options.push(`샷 추가 × ${item.extraShotCount}`);
  if (item.lightly) options.push('연하게')
  if (item.soyMilk) options.push('두유 변경');
  if (item.personalTumbler) options.push('개인 텀블러');
  return options.join(' · ');
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  close: { width: 36, color: colors.dark, fontSize: 30, lineHeight: 34 },
  title: { color: colors.dark, fontSize: 19, fontWeight: '900' },
  headerSpace: { width: 36 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 270 },
  itemCard: { position: 'relative', padding: 17, borderRadius: 20, backgroundColor: colors.white, marginBottom: 13 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemInfo: { flex: 1 },
  itemName: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  options: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  edit: { color: colors.orange, fontSize: 11, fontWeight: '900' },
  itemBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quantityButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DDD2C8', borderRadius: 17, backgroundColor: 'transparent' },
  quantityButtonText: { color: colors.dark, fontSize: 19, fontWeight: '800' },
  disabledText: { color: '#C1B8B1' },
  quantity: { minWidth: 20, color: colors.dark, fontSize: 15, textAlign: 'center', fontWeight: '900' },
  itemPrice: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  removeButton: { alignSelf: 'flex-start', marginTop: 13 },
  removeText: { color: '#A29790', fontSize: 11, textDecorationLine: 'underline' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { color: colors.dark, fontSize: 18, fontWeight: '900', marginTop: 15 },
  emptyText: { color: colors.muted, fontSize: 13, marginTop: 7 },
  summary: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: 'rgba(255,249,238,0.98)' },
  pickupSection: { marginBottom: 16 },
  pickupTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  pickupTitle: { color: colors.dark, fontSize: 14, fontWeight: '900' },
  pickupGuide: { color: colors.muted, fontSize: 10 },
  pickupOptions: { gap: 6, paddingRight: 2 },
  pickupOption: { minWidth: 78, minHeight: 38, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#E7DDD4', backgroundColor: colors.white },
  pickupOptionSelected: { borderColor: colors.orange, backgroundColor: '#FFF0E9' },
  pickupOptionText: { color: colors.muted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  pickupOptionTextSelected: { color: colors.orange, fontWeight: '900' },
  customTimeRow: { minHeight: 48, marginTop: 9, paddingLeft: 13, paddingRight: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 13, backgroundColor: colors.white },
  customTimeTitle: { color: colors.dark, fontSize: 12, fontWeight: '900' },
  customTimeText: { marginTop: 2, color: colors.orange, fontSize: 11, fontWeight: '700' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  totalLabel: { color: colors.dark, fontSize: 14, fontWeight: '800' },
  totalPrice: { color: colors.dark, fontSize: 21, fontWeight: '900' },
  nextButton: { minHeight: 57, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.orange },
  disabledNextButton: { backgroundColor: '#CFC5BE' },
  nextButtonText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.65 },
});
