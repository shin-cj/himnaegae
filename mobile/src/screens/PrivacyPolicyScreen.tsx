import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PRIVACY_POLICY_VERSION, privacyPolicySections } from '../lib/privacy';
import { colors } from '../theme/colors';

export function PrivacyPolicyScreen({ accepting = false, onAccept, onClose }: {
  accepting?: boolean;
  onAccept?: () => void;
  onClose?: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {onClose ? (
          <Pressable accessibilityRole="button" accessibilityLabel="개인정보 처리방침 닫기" onPress={onClose} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        ) : null}
        <View>
          <Text style={styles.eyebrow}>PRIVACY</Text>
          <Text style={styles.title}>개인정보 처리방침</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}>
        <Text style={styles.version}>시행일 및 버전: {PRIVACY_POLICY_VERSION}</Text>
        <Text style={styles.intro}>힘내개는 주문에 필요한 정보만 수집하고, 정해진 목적과 기간 안에서 안전하게 처리합니다.</Text>
        {privacyPolicySections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>개인정보 문의</Text>
          <Text style={styles.noticeBody}>앱의 매장 정보에 표시된 연락처로 문의해주세요. 정식 배포 전 운영자명과 개인정보 보호 담당 연락처를 최종 고지합니다.</Text>
        </View>
        {onAccept ? (
          <Pressable disabled={accepting} onPress={onAccept} style={({ pressed }) => [styles.acceptButton, (pressed || accepting) && styles.pressed]}>
            <Text style={styles.acceptText}>{accepting ? '동의 내용을 저장하고 있어요...' : '확인하고 동의하기'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingBottom: 14 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8, borderRadius: 15, backgroundColor: colors.white },
  backText: { marginTop: -4, color: colors.dark, fontSize: 38 },
  eyebrow: { color: colors.orange, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 2, color: colors.dark, fontSize: 25, fontWeight: '900' },
  content: { paddingHorizontal: 22 },
  version: { marginTop: 10, color: colors.muted, fontSize: 12, fontWeight: '700' },
  intro: { marginTop: 18, padding: 18, borderRadius: 18, backgroundColor: colors.white, color: colors.dark, fontSize: 15, lineHeight: 23, fontWeight: '700' },
  section: { marginTop: 23 },
  sectionTitle: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  sectionBody: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 23 },
  notice: { marginTop: 26, padding: 18, borderRadius: 18, backgroundColor: '#FFF4EC' },
  noticeTitle: { color: colors.dark, fontSize: 15, fontWeight: '900' },
  noticeBody: { marginTop: 7, color: colors.muted, fontSize: 13, lineHeight: 21 },
  acceptButton: { alignItems: 'center', marginTop: 24, paddingVertical: 17, borderRadius: 17, backgroundColor: colors.orange },
  acceptText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  pressed: { opacity: 0.65 },
});
