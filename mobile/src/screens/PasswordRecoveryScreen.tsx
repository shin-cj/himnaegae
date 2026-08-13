import { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function PasswordRecoveryScreen() {
  const insets = useSafeAreaInsets();
  const { cancelPasswordRecovery, updateRecoveredPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordCheck, setPasswordCheck] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updatePassword = async () => {
    if (password.length < 8) {
      Alert.alert('비밀번호 확인', '새 비밀번호를 8글자 이상 입력해주세요.');
      return;
    }
    if (password !== passwordCheck) {
      Alert.alert('비밀번호 확인', '두 비밀번호가 서로 달라요.');
      return;
    }

    try {
      setSubmitting(true);
      await updateRecoveredPassword(password);
      Alert.alert('비밀번호 변경 완료', '새 비밀번호로 다시 로그인해주세요. 다른 기기의 로그인도 안전하게 종료했어요.');
    } catch (error) {
      Alert.alert('비밀번호 변경 실패', error instanceof Error ? error.message : '변경 링크를 다시 요청해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 30 }]}>
        <Text style={styles.eyebrow}>ACCOUNT SECURITY</Text>
        <Text style={styles.title}>새 비밀번호를 입력해주세요</Text>
        <Text style={styles.description}>이전에 사용하던 비밀번호와 다르게 8글자 이상으로 만들어주세요.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>새 비밀번호</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="8글자 이상" placeholderTextColor="#B3A69D" style={styles.input} />
          <Text style={styles.label}>새 비밀번호 확인</Text>
          <TextInput value={passwordCheck} onChangeText={setPasswordCheck} secureTextEntry autoCapitalize="none" placeholder="한 번 더 입력해주세요" placeholderTextColor="#B3A69D" style={styles.input} />
        </View>

        <Pressable disabled={submitting} onPress={() => void updatePassword()} style={({ pressed }) => [styles.submitButton, (pressed || submitting) && styles.buttonPressed]}>
          <Text style={styles.submitText}>{submitting ? '안전하게 변경 중...' : '비밀번호 변경하기'}</Text>
        </Pressable>
        <Pressable disabled={submitting} onPress={() => void cancelPasswordRecovery()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>나중에 변경하기</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  eyebrow: { color: colors.orange, fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 10, color: colors.dark, fontSize: 28, lineHeight: 36, fontWeight: '900' },
  description: { marginTop: 10, color: colors.muted, fontSize: 15, lineHeight: 23 },
  form: { marginTop: 34 },
  label: { marginBottom: 8, color: colors.dark, fontSize: 14, fontWeight: '800' },
  input: { minHeight: 54, marginBottom: 18, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E9DDCF', borderRadius: 15, backgroundColor: colors.white, color: colors.dark, fontSize: 16 },
  submitButton: { alignItems: 'center', marginTop: 8, paddingVertical: 17, borderRadius: 17, backgroundColor: colors.orange },
  buttonPressed: { opacity: 0.65 },
  submitText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  cancelButton: { alignItems: 'center', paddingVertical: 18 },
  cancelText: { color: colors.muted, fontSize: 14, fontWeight: '800' },
});
