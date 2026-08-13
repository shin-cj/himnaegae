import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type EditingSection = 'nickname' | 'password' | 'delete' | null;

export function AccountSettingsScreen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const {
    deleteAccount,
    signOutAll,
    updateNickname,
    updatePassword,
    user,
  } = useAuth();
  const currentNickname = typeof user?.user_metadata.nickname === 'string'
    ? user.user_metadata.nickname
    : '힘내개 손님';
  const [editing, setEditing] = useState<EditingSection>(null);
  const [nickname, setNickname] = useState(currentNickname);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordCheck, setNewPasswordCheck] = useState('');
  const [withdrawalPassword, setWithdrawalPassword] = useState('');
  const [withdrawalText, setWithdrawalText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const run = async (task: () => Promise<void>, successTitle: string, successMessage: string) => {
    try {
      setSubmitting(true);
      await task();
      Alert.alert(successTitle, successMessage);
      setEditing(null);
    } catch (error) {
      Alert.alert('처리하지 못했어요', error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const saveNickname = () => {
    const normalized = nickname.trim();
    if (normalized.length < 2 || normalized.length > 40) {
      Alert.alert('닉네임 확인', '닉네임은 2~40글자로 입력해주세요.');
      return;
    }
    void run(
      () => updateNickname(normalized),
      '닉네임 변경 완료',
      '새 닉네임을 저장했어요.',
    );
  };

  const savePassword = () => {
    if (!currentPassword) {
      Alert.alert('현재 비밀번호 확인', '현재 사용 중인 비밀번호를 입력해주세요.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('새 비밀번호 확인', '새 비밀번호는 8글자 이상 입력해주세요.');
      return;
    }
    if (currentPassword === newPassword) {
      Alert.alert('새 비밀번호 확인', '현재 비밀번호와 다른 비밀번호를 사용해주세요.');
      return;
    }
    if (newPassword !== newPasswordCheck) {
      Alert.alert('새 비밀번호 확인', '새 비밀번호 두 개가 서로 달라요.');
      return;
    }

    void run(async () => {
      await updatePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordCheck('');
    }, '비밀번호 변경 완료', '다른 기기의 로그인도 함께 종료했어요.');
  };

  const requestSignOutAll = () => {
    Alert.alert('모든 기기에서 로그아웃', '현재 아이폰을 포함해 로그인된 모든 기기에서 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '모두 로그아웃',
        style: 'destructive',
        onPress: () => void run(signOutAll, '로그아웃 완료', '모든 기기의 로그인을 종료했어요.'),
      },
    ]);
  };

  const requestDeleteAccount = () => {
    if (!withdrawalPassword) {
      Alert.alert('비밀번호 확인', '현재 비밀번호를 입력해주세요.');
      return;
    }
    if (withdrawalText.trim() !== '회원탈퇴') {
      Alert.alert('확인 문구 입력', '확인란에 회원탈퇴를 정확히 입력해주세요.');
      return;
    }

    Alert.alert(
      '정말 탈퇴할까요?',
      '계정은 다시 사용할 수 없지만 결제·주문 기록은 매장 정산을 위해 보관됩니다.',
      [
        { text: '돌아가기', style: 'cancel' },
        {
          text: '회원 탈퇴',
          style: 'destructive',
          onPress: () => void run(
            () => deleteAccount(withdrawalPassword),
            '회원 탈퇴 완료',
            '계정과 로그인 정보를 안전하게 정리했어요.',
          ),
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 42 }]}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="계정 관리 닫기" onPress={onClose} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View>
            <Text style={styles.eyebrow}>ACCOUNT SECURITY</Text>
            <Text style={styles.title}>계정 관리</Text>
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}><Text>{currentNickname.slice(0, 1)}</Text></View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{currentNickname}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
          <View style={styles.safeBadge}><Text style={styles.safeBadgeText}>인증됨</Text></View>
        </View>

        <Text style={styles.sectionLabel}>내 정보</Text>
        <ActionCard
          title="닉네임 변경"
          description="주문과 마이페이지에 표시되는 이름을 바꿔요."
          onPress={() => { setNickname(currentNickname); setEditing(editing === 'nickname' ? null : 'nickname'); }}
        />
        {editing === 'nickname' ? (
          <View style={styles.editorCard}>
            <Field label="새 닉네임" value={nickname} onChangeText={setNickname} maxLength={40} autoFocus />
            <SubmitButton label="닉네임 저장" loading={submitting} onPress={saveNickname} />
          </View>
        ) : null}

        <ActionCard
          title="비밀번호 변경"
          description="현재 비밀번호를 확인하고 새 비밀번호로 바꿔요."
          onPress={() => setEditing(editing === 'password' ? null : 'password')}
        />
        {editing === 'password' ? (
          <View style={styles.editorCard}>
            <Field label="현재 비밀번호" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoCapitalize="none" />
            <Field label="새 비밀번호" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" placeholder="8글자 이상" />
            <Field label="새 비밀번호 확인" value={newPasswordCheck} onChangeText={setNewPasswordCheck} secureTextEntry autoCapitalize="none" />
            <SubmitButton label="비밀번호 변경" loading={submitting} onPress={savePassword} />
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>로그인 보안</Text>
        <ActionCard
          title="모든 기기에서 로그아웃"
          description="분실한 휴대폰이나 다른 컴퓨터의 로그인도 모두 종료해요."
          onPress={requestSignOutAll}
        />

        <Text style={styles.sectionLabel}>계정 삭제</Text>
        <ActionCard
          danger
          title="회원 탈퇴"
          description="계정과 푸시 알림 연결을 삭제하고 다시 로그인할 수 없게 해요."
          onPress={() => setEditing(editing === 'delete' ? null : 'delete')}
        />
        {editing === 'delete' ? (
          <View style={[styles.editorCard, styles.dangerEditor]}>
            <Text style={styles.dangerGuide}>결제·주문 기록은 매장 정산과 분쟁 대응을 위해 보관되고, 계정 정보는 식별할 수 없도록 처리됩니다.</Text>
            <Field label="현재 비밀번호" value={withdrawalPassword} onChangeText={setWithdrawalPassword} secureTextEntry autoCapitalize="none" />
            <Field label="확인 문구" value={withdrawalText} onChangeText={setWithdrawalText} placeholder="회원탈퇴" autoCapitalize="none" />
            <SubmitButton danger label="회원 탈퇴" loading={submitting} onPress={requestDeleteAccount} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ActionCard({ danger = false, description, onPress, title }: {
  danger?: boolean;
  description: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, danger && styles.dangerText]}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Text style={[styles.chevron, danger && styles.dangerText]}>›</Text>
    </Pressable>
  );
}

function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} placeholderTextColor="#B3A69D" selectionColor={colors.orange} style={styles.input} />
    </View>
  );
}

function SubmitButton({ danger = false, label, loading, onPress }: {
  danger?: boolean;
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={loading} onPress={onPress} style={({ pressed }) => [styles.submitButton, danger && styles.dangerButton, (pressed || loading) && styles.pressed]}>
      <Text style={styles.submitText}>{loading ? '처리 중...' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, paddingHorizontal: 22 },
  header: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8, borderRadius: 15, backgroundColor: colors.white },
  backText: { marginTop: -4, color: colors.dark, fontSize: 38, fontWeight: '400' },
  eyebrow: { color: colors.orange, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 2, color: colors.dark, fontSize: 25, fontWeight: '900' },
  profileCard: { flexDirection: 'row', alignItems: 'center', marginTop: 24, padding: 18, borderRadius: 22, backgroundColor: colors.white },
  avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#F9E3D7' },
  profileCopy: { flex: 1, marginLeft: 14 },
  profileName: { color: colors.dark, fontSize: 17, fontWeight: '900' },
  profileEmail: { marginTop: 4, color: colors.muted, fontSize: 12 },
  safeBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#EAF5E9' },
  safeBadgeText: { color: '#3E7E4B' },
  sectionLabel: { marginTop: 28, marginBottom: 9, color: colors.muted, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  actionCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, padding: 18, borderRadius: 19, backgroundColor: colors.white },
  actionCopy: { flex: 1, paddingRight: 12 },
  actionTitle: { color: colors.dark, fontSize: 16, fontWeight: '900' },
  actionDescription: { marginTop: 6, color: colors.muted, fontSize: 12, lineHeight: 18 },
  chevron: { color: '#B9AAA0', fontSize: 29 },
  editorCard: { marginTop: -2, marginBottom: 12, padding: 18, borderRadius: 19, backgroundColor: '#FFFDF8' },
  dangerEditor: { borderWidth: 1, borderColor: '#F2CBC5' },
  dangerGuide: { marginBottom: 16, color: '#9B443D', fontSize: 12, lineHeight: 19 },
  field: { marginBottom: 14 },
  fieldLabel: { marginBottom: 7, color: colors.dark, fontSize: 13, fontWeight: '800' },
  input: { minHeight: 52, paddingHorizontal: 15, borderWidth: 1, borderColor: '#E9DDCF', borderRadius: 14, backgroundColor: colors.white, color: colors.dark, fontSize: 15 },
  submitButton: { alignItems: 'center', marginTop: 4, paddingVertical: 15, borderRadius: 15, backgroundColor: colors.orange },
  dangerButton: { backgroundColor: '#D9564D' },
  submitText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  dangerText: { color: '#C44E47' },
  pressed: { opacity: 0.62 },
});
