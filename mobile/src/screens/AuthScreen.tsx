import { type ComponentProps, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordCheck, setPasswordCheck] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isSignup = mode === 'signup';

  const submit = async () => {
    if (isSignup && nickname.trim().length < 2) {
      Alert.alert('닉네임 확인', '닉네임을 2글자 이상 입력해주세요.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('이메일 확인', '사용할 이메일을 정확히 입력해주세요.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('비밀번호 확인', '비밀번호를 8글자 이상 입력해주세요.');
      return;
    }
    if (isSignup && password !== passwordCheck) {
      Alert.alert('비밀번호 확인', '두 비밀번호가 서로 달라요.');
      return;
    }

    try {
      setSubmitting(true);
      if (isSignup) {
        const result = await signUp(email, password, nickname);
        if (result.needsEmailConfirmation) {
          Alert.alert('가입 신청 완료', '입력한 이메일에서 확인 링크를 누른 뒤 로그인해주세요.');
          setMode('login');
          setPassword('');
          setPasswordCheck('');
        } else {
          Alert.alert('가입 완료', `${nickname.trim()}님, 반가워요!`);
        }
      } else {
        await signIn(email, password);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.';
      Alert.alert(isSignup ? '회원가입 실패' : '로그인 실패', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 30 }]}>
        <Text style={styles.eyebrow}>힘내개 COFFEE</Text>
        <Text style={styles.title}>{isSignup ? '처음 오셨군요!' : '다시 만나 반가워요!'}</Text>
        <Text style={styles.description}>
          {isSignup ? '간단히 가입하고 주문과 픽업 알림을 받아보세요.' : '주문 내역과 픽업 상태를 확인해보세요.'}
        </Text>

        <View style={styles.switcher}>
          <Pressable style={[styles.switchButton, !isSignup && styles.switchButtonActive]} onPress={() => setMode('login')}>
            <Text style={[styles.switchText, !isSignup && styles.switchTextActive]}>로그인</Text>
          </Pressable>
          <Pressable style={[styles.switchButton, isSignup && styles.switchButtonActive]} onPress={() => setMode('signup')}>
            <Text style={[styles.switchText, isSignup && styles.switchTextActive]}>회원가입</Text>
          </Pressable>
        </View>

        {isSignup ? <Field label="닉네임" value={nickname} onChangeText={setNickname} placeholder="앱에서 사용할 이름" /> : null}
        <Field label="이메일" value={email} onChangeText={setEmail} placeholder="coffee@example.com" keyboardType="email-address" autoCapitalize="none" />
        <Field label="비밀번호" value={password} onChangeText={setPassword} placeholder="8글자 이상" secureTextEntry autoCapitalize="none" />
        {isSignup ? <Field label="비밀번호 확인" value={passwordCheck} onChangeText={setPasswordCheck} placeholder="한 번 더 입력해주세요" secureTextEntry autoCapitalize="none" /> : null}

        <Pressable disabled={submitting} onPress={submit} style={({ pressed }) => [styles.submitButton, (pressed || submitting) && styles.buttonPressed]}>
          <Text style={styles.submitText}>{submitting ? '처리 중...' : isSignup ? '가입하기' : '로그인'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = ComponentProps<typeof TextInput> & { label: string };

function Field({ label, ...inputProps }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...inputProps} placeholderTextColor="#B3A69D" style={styles.input} selectionColor={colors.orange} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 130 },
  eyebrow: { color: colors.orange, fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 10, color: colors.dark, fontSize: 28, fontWeight: '900' },
  description: { marginTop: 9, color: colors.muted, fontSize: 15, lineHeight: 22 },
  switcher: { flexDirection: 'row', marginTop: 28, marginBottom: 22, padding: 5, borderRadius: 16, backgroundColor: '#F2E8DA' },
  switchButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12 },
  switchButtonActive: { backgroundColor: colors.white },
  switchText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  switchTextActive: { color: colors.orange, fontWeight: '900' },
  field: { marginBottom: 16 },
  label: { marginBottom: 8, color: colors.dark, fontSize: 14, fontWeight: '800' },
  input: { minHeight: 54, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E9DDCF', borderRadius: 15, backgroundColor: colors.white, color: colors.dark, fontSize: 16 },
  submitButton: { alignItems: 'center', marginTop: 8, paddingVertical: 17, borderRadius: 17, backgroundColor: colors.orange },
  buttonPressed: { opacity: 0.65 },
  submitText: { color: colors.white, fontSize: 16, fontWeight: '900' },
});
