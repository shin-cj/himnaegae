import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';
import { formatOrderNumber } from './order-number';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationRegistration = {
  enabled: boolean;
  pushRegistered: boolean;
  message: string;
};

function getProjectId() {
  return process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    ?? Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId;
}

export async function getNotificationPermission() {
  if (Platform.OS === 'web') return false;
  const permission = await Notifications.getPermissionsAsync();
  return permission.status === 'granted';
}

export async function registerForOrderNotifications(userId: string): Promise<NotificationRegistration> {
  if (Platform.OS === 'web') {
    return { enabled: false, pushRegistered: false, message: '스마트폰 앱에서 알림을 켜주세요.' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: '주문 및 픽업 알림',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: '#EF7045',
      sound: 'default',
    });
  }

  const currentPermission = await Notifications.getPermissionsAsync();
  const permission = currentPermission.status === 'granted'
    ? currentPermission
    : await Notifications.requestPermissionsAsync();

  if (permission.status !== 'granted') {
    return { enabled: false, pushRegistered: false, message: '아이폰 설정에서 힘내개 알림을 허용해주세요.' };
  }

  if (!Device.isDevice) {
    return { enabled: true, pushRegistered: false, message: '알림은 켜졌어요. 원격 푸시는 실제 스마트폰에서 등록돼요.' };
  }

  const projectId = getProjectId();
  if (!projectId) {
    return { enabled: true, pushRegistered: false, message: '앱 안 알림은 켜졌어요. EAS 연결 후 잠금화면 알림도 활성화돼요.' };
  }

  try {
    const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await supabase.from('push_tokens').upsert({
      user_id: userId,
      expo_push_token: expoPushToken,
      platform: Platform.OS,
      device_name: Device.deviceName ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,expo_push_token' });
    if (error) throw error;

    return { enabled: true, pushRegistered: true, message: '픽업 준비 알림을 잠금화면에서도 받을 수 있어요.' };
  } catch {
    return { enabled: true, pushRegistered: false, message: '앱 안 알림은 켜졌어요. 개발 빌드 설치 후 잠금화면 알림도 켜져요.' };
  }
}

const statusNotifications: Record<string, { title: string; body: string }> = {
  paid: { title: '주문이 접수됐어요 ☕', body: '매장에서 주문을 확인하고 있어요.' },
  accepted: { title: '주문이 접수됐어요 ☕', body: '곧 음료 제조를 시작할게요.' },
  preparing: { title: '음료를 만들고 있어요 🥤', body: '조금만 기다려주세요.' },
  ready: { title: '픽업 준비 완료 🔔', body: '매장에서 음료를 픽업해주세요.' },
  picked_up: { title: '픽업 완료 ✅', body: '힘내개를 이용해주셔서 감사해요.' },
  cancel_requested: { title: '취소 요청 확인 중', body: '매장에서 취소 요청을 확인하고 있어요.' },
  cancelled: { title: '주문 취소 완료', body: '주문과 결제 취소가 완료됐어요.' },
};

export async function showOrderStatusNotification(orderNumber: string, status: string) {
  if (Platform.OS === 'web') return;
  if (!await getNotificationPermission()) return;
  const copy = statusNotifications[status];
  if (!copy) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: `${formatOrderNumber(orderNumber)} · ${copy.body}`,
      sound: 'default',
      data: { screen: 'notifications', orderNumber, status },
    },
    trigger: null,
  });
}

export function addNotificationTapListener(onOpenNotifications: () => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const screen = response.notification.request.content.data?.screen;
    if (screen === 'orders' || screen === 'notifications') onOpenNotifications();
  });
}

export function usesExpoGo() {
  return Constants.appOwnership === 'expo';
}
