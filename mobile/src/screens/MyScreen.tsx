import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { getNotificationPermission, registerForOrderNotifications } from '../lib/notifications';
import { colors } from '../theme/colors';
import { AccountSettingsScreen } from './AccountSettingsScreen';
import { AuthScreen } from './AuthScreen';

export function MyScreen() {
  const insets = useSafeAreaInsets();
  const { loading, signOut, user } = useAuth();
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('음료가 준비되면 바로 알려드려요.');
  const [enablingNotification, setEnablingNotification] = useState(false);
  const [accountSettingsVisible, setAccountSettingsVisible] = useState(false);

  useEffect(() => {
    void getNotificationPermission().then(setNotificationEnabled).catch(() => setNotificationEnabled(false));
  }, []);

  if (loading) return <View style={styles.center}><Text style={styles.loading}>로그인 정보를 확인하고 있어요...</Text></View>;
  if (!user) return <AuthScreen />;

  const nickname = typeof user.user_metadata.nickname === 'string' ? user.user_metadata.nickname : '힘내개 손님';
  const handleSignOut = () => {
    Alert.alert('로그아웃', '이 기기에서 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => signOut().catch((error) => Alert.alert('로그아웃 실패', error instanceof Error ? error.message : '다시 시도해주세요.')) },
    ]);
  };

  const enableNotifications = async () => {
    setEnablingNotification(true);
    try {
      const result = await registerForOrderNotifications(user.id);
      setNotificationEnabled(result.enabled);
      setNotificationMessage(result.message);
      Alert.alert(result.enabled ? '픽업 알림을 켰어요' : '알림을 켜지 못했어요', result.message);
    } catch (error) {
      Alert.alert('알림 설정 실패', error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.');
    } finally {
      setEnablingNotification(false);
    }
  };

  return (
    <View style={[styles.profile, { paddingTop: insets.top + 30 }]}>
      <Text style={styles.eyebrow}>MY PAGE</Text>
      <Text style={styles.title}>{nickname}님, 안녕하세요!</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>로그인 이메일</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>
      <View style={styles.notificationCard}>
        <View style={styles.notificationCopy}>
          <Text style={styles.notificationTitle}>🔔 픽업 알림</Text>
          <Text style={styles.notificationDescription}>{notificationMessage}</Text>
        </View>
        <Pressable
          disabled={enablingNotification}
          onPress={() => void enableNotifications()}
          style={({ pressed }) => [styles.notificationButton, notificationEnabled && styles.notificationButtonEnabled, pressed && styles.pressed]}
        >
          <Text style={[styles.notificationButtonText, notificationEnabled && styles.notificationButtonTextEnabled]}>
            {enablingNotification ? '설정 중' : notificationEnabled ? '켜짐' : '알림 켜기'}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.guide}>알림을 허용하면 주문 페이지를 보고 있지 않아도 픽업 준비 소식을 받을 수 있어요.</Text>
      <Pressable onPress={() => setAccountSettingsVisible(true)} style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}>
        <View>
          <Text style={styles.accountButtonTitle}>계정 및 보안</Text>
          <Text style={styles.accountButtonDescription}>닉네임·비밀번호·로그인 기기·회원 탈퇴</Text>
        </View>
        <Text style={styles.accountChevron}>›</Text>
      </Pressable>
      <Pressable onPress={handleSignOut} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>
      <Modal visible={accountSettingsVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setAccountSettingsVisible(false)}>
        <AccountSettingsScreen onClose={() => setAccountSettingsVisible(false)} />
      </Modal>
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
  notificationCard: { flexDirection: 'row', alignItems: 'center', marginTop: 14, padding: 18, borderRadius: 20, backgroundColor: colors.white },
  notificationCopy: { flex: 1, paddingRight: 12 },
  notificationTitle: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  notificationDescription: { marginTop: 6, color: colors.muted, fontSize: 12, lineHeight: 18 },
  notificationButton: { minWidth: 78, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderRadius: 13, backgroundColor: colors.orange },
  notificationButtonEnabled: { backgroundColor: '#EAF5E9' },
  notificationButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  notificationButtonTextEnabled: { color: '#3E7E4B' },
  guide: { marginTop: 18, color: colors.muted, fontSize: 14, lineHeight: 21 },
  accountButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, padding: 18, borderRadius: 18, backgroundColor: colors.white },
  accountButtonTitle: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  accountButtonDescription: { marginTop: 5, color: colors.muted, fontSize: 12 },
  accountChevron: { color: '#B9AAA0', fontSize: 29 },
  logoutButton: { alignItems: 'center', marginTop: 28, paddingVertical: 15, borderWidth: 1, borderColor: '#E5D5C8', borderRadius: 16, backgroundColor: colors.white },
  logoutText: { color: colors.orange, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.6 },
});
