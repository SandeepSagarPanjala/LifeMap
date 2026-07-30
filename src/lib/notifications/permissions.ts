import notifee, { AuthorizationStatus } from 'react-native-notify-kit';
import { PermissionsAndroid, Platform } from 'react-native';

export type NotificationPermissionResult = 'granted' | 'denied' | 'unavailable';

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionResult> {
  const settings = await notifee.getNotificationSettings();
  if (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  ) {
    return 'granted';
  }
  if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
    return 'denied';
  }
  return 'unavailable';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      return false;
    }
  }

  const settings = await notifee.requestPermission();
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

/** Request if needed; returns whether notifications may be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const status = await getNotificationPermissionStatus();
  if (status === 'granted') {
    return true;
  }
  return requestNotificationPermission();
}
