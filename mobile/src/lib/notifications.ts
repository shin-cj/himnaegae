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

export async function showReadyNotification(orderNumber: string) {
  if (Platform.OS === 'web') return;
  if (!await getNotificationPermission()) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '음료가 준비됐어요! ☕',
      body: `${formatOrderNumber(orderNumber)} 주문을 카운터에서 픽업해주세요.`,
      sound: 'default',
      data: { screen: 'orders', orderNumber },
    },
    trigger: null,
  });
}

export function addNotificationTapListener(onOpenOrders: () => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    if (response.notification.request.content.data?.screen === 'orders') onOpenOrders();
  });
}

export function usesExpoGo() {
  return Constants.appOwnership === 'expo';
}
