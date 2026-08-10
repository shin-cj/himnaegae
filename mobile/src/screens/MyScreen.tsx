import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { AuthScreen } from './AuthScreen';

export function MyScreen() {
  const insets = useSafeAreaInsets();
  const { loading, signOut, user } = useAuth();

  if (loading) return <View style={styles.center}><Text style={styles.loading}>로그인 정보를 확인하고 있어요...</Text></View>;
  if (!user) return <AuthScreen />;

  const nickname = typeof user.user_metadata.nickname === 'string' ? user.user_metadata.nickname : '힘내개 손님';
  const handleSignOut = () => {
    Alert.alert('로그아웃', '이 기기에서 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => signOut().catch((error) => Alert.alert('로그아웃 실패', error instanceof Error ? error.message : '다시 시도해주세요.')) },
    ]);
  };

  return (
    <View style={[styles.profile, { paddingTop: insets.top + 30 }]}>
      <Text style={styles.eyebrow}>MY PAGE</Text>
      <Text style={styles.title}>{nickname}님, 안녕하세요!</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>로그인 이메일</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>
      <Text style={styles.guide}>앞으로 이곳에 주문 내역, 픽업 알림 설정, 회원 정보를 차례로 붙이면 돼요.</Text>
      <Pressable onPress={handleSignOut} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  loading: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  profile: { flex: 1, paddingHorizontal: 24, paddingBottom: 120, backgroundColor: colors.cream },
  eyebrow: { color: colors.orange, fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 10, color: colors.dark, fontSize: 27, fontWeight: '900' },
  card: { marginTop: 28, padding: 20, borderRadius: 20, backgroundColor: colors.white },
  cardLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  email: { marginTop: 7, color: colors.dark, fontSize: 17, fontWeight: '800' },
  guide: { marginTop: 18, color: colors.muted, fontSize: 14, lineHeight: 21 },
  logoutButton: { alignItems: 'center', marginTop: 28, paddingVertical: 15, borderWidth: 1, borderColor: '#E5D5C8', borderRadius: 16, backgroundColor: colors.white },
  logoutText: { color: colors.orange, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.6 },
});
