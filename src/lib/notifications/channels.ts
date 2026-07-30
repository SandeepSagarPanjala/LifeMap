import notifee, { AndroidImportance } from 'react-native-notify-kit';
import { Platform } from 'react-native';

export const CHANNEL_ACTIVITY_SOUND = 'activity-reminders';
export const CHANNEL_ACTIVITY_SILENT = 'activity-reminders-silent';
export const CHANNEL_PLACE_PROMPTS = 'place-prompts';

let channelsReady = false;

export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android' || channelsReady) {
    return;
  }

  await notifee.createChannel({
    id: CHANNEL_ACTIVITY_SOUND,
    name: 'Activity reminders',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });

  await notifee.createChannel({
    id: CHANNEL_ACTIVITY_SILENT,
    name: 'Activity reminders (silent)',
    importance: AndroidImportance.DEFAULT,
    sound: undefined,
    vibration: false,
  });

  await notifee.createChannel({
    id: CHANNEL_PLACE_PROMPTS,
    name: 'Place prompts',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });

  channelsReady = true;
}
