import type { Session, User } from '@supabase/supabase-js';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { supabase } from '../lib/supabase';
import {
  clearStoredOrderNotificationToken,
  unregisterAllOrderNotifications,
  unregisterOrderNotifications,
} from '../lib/notifications';

type SignUpResult = { needsEmailConfirmation: boolean };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  passwordRecovery: boolean;
  signUp: (email: string, password: string, nickname: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updateRecoveredPassword: (password: string) => Promise<void>;
  cancelPasswordRecovery: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutAll: () => Promise<void>;
  deleteAccount: (currentPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function createAuthRedirectUrl(path: string) {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    const linkingUri = Constants.linkingUri.replace(/\/+$/, '');
    const expoGoBaseUrl = linkingUri.includes('/--') ? linkingUri : `${linkingUri}/--`;
    return `${expoGoBaseUrl}/${path}`;
  }

  return Linking.createURL(path, { scheme: 'himnaegae' });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (!error) setSession(data.session);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
      setLoading(false);
    });

    const createAuthSessionFromUrl = async (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      const isRecoveryPath = parsed.path?.endsWith('reset-password')
        || parsed.hostname === 'reset-password';
      const isConfirmationPath = parsed.path?.endsWith('auth-confirm')
        || parsed.hostname === 'auth-confirm';
      const hashParams = new URLSearchParams(url.split('#')[1] ?? '');
      const queryParams = parsed.queryParams ?? {};
      const errorDescription = hashParams.get('error_description')
        ?? (typeof queryParams.error_description === 'string' ? queryParams.error_description : null);
      if (errorDescription) throw new Error(errorDescription);

      const accessToken = hashParams.get('access_token')
        ?? (typeof queryParams.access_token === 'string' ? queryParams.access_token : null);
      const refreshToken = hashParams.get('refresh_token')
        ?? (typeof queryParams.refresh_token === 'string' ? queryParams.refresh_token : null);
      const authType = hashParams.get('type')
        ?? (typeof queryParams.type === 'string' ? queryParams.type : null);

      if (!isRecoveryPath && !isConfirmationPath && authType !== 'recovery' && authType !== 'signup') return;
      if (!accessToken || !refreshToken) throw new Error('인증 링크가 만료됐거나 올바르지 않아요. 새 링크를 요청해주세요.');

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      setPasswordRecovery(isRecoveryPath || authType === 'recovery');
    };

    const showAuthLinkError = (error: unknown) => {
      Alert.alert(
        '이메일 인증 실패',
        error instanceof Error ? error.message : '인증 링크를 다시 요청해주세요.',
      );
    };

    const urlListener = Linking.addEventListener('url', ({ url }) => {
      void createAuthSessionFromUrl(url).catch(showAuthLinkError);
    });
    void Linking.getInitialURL().then(createAuthSessionFromUrl).catch(showAuthLinkError);

    const appStateListener = Platform.OS === 'web'
      ? null
      : AppState.addEventListener('change', (state) => {
          if (state === 'active') supabase.auth.startAutoRefresh();
          else supabase.auth.stopAutoRefresh();
        });

    return () => {
      authListener.subscription.unsubscribe();
      urlListener.remove();
      appStateListener?.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    passwordRecovery,
    async signUp(email, password, nickname) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { nickname: nickname.trim() },
          emailRedirectTo: createAuthRedirectUrl('auth-confirm'),
        },
      });
      if (error) throw error;
      return { needsEmailConfirmation: data.session === null };
    },
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
    },
    async requestPasswordReset(email) {
      const redirectTo = createAuthRedirectUrl('reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      });
      if (error) throw error;
    },
    async updateRecoveredPassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPasswordRecovery(false);
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
      if (signOutError) throw signOutError;
    },
    async cancelPasswordRecovery() {
      setPasswordRecovery(false);
      await supabase.auth.signOut({ scope: 'local' });
    },
    async updateNickname(nickname) {
      const normalizedNickname = nickname.trim();
      if (normalizedNickname.length < 2 || normalizedNickname.length > 40) {
        throw new Error('닉네임은 2~40글자로 입력해주세요.');
      }
      const { error } = await supabase.auth.updateUser({
        data: { nickname: normalizedNickname },
      });
      if (error) throw error;
    },
    async updatePassword(currentPassword, newPassword) {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });
      if (error) throw error;

      const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
      if (signOutError) throw signOutError;
    },
    async signOut() {
      if (session?.user.id) {
        await unregisterOrderNotifications(session.user.id).catch(() => undefined);
      }
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
    async signOutAll() {
      if (session?.user.id) {
        await unregisterAllOrderNotifications(session.user.id);
      }
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
    },
    async deleteAccount(currentPassword) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error('로그인 정보를 다시 확인해주세요.');

      const { data, error } = await supabase.functions.invoke('delete-account', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: { currentPassword },
      });

      if (error) {
        const context = (error as { context?: Response }).context;
        const payload = context
          ? await context.clone().json().catch(() => null) as { error?: string } | null
          : null;
        throw new Error(payload?.error ?? error.message);
      }
      if (!data?.ok) throw new Error(data?.error ?? '회원 탈퇴 결과를 확인하지 못했어요.');

      await clearStoredOrderNotificationToken();
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    },
  }), [loading, passwordRecovery, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth는 AuthProvider 안에서 사용해야 합니다.');
  return context;
}
