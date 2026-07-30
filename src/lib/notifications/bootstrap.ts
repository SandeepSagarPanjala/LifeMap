import notifee, { EventType, type Event } from 'react-native-notify-kit';
import {
  StackActions,
  type NavigationContainerRef,
} from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/types';
import { getActivityById } from '@/db/repositories/activities';

import {
  resyncAllActivityReminders,
  syncActivityReminderSchedule,
} from './activity-reminders';
import { ensureNotificationChannels } from './channels';
import { markPlacePromptFired } from './place-prompts';
import { reminderConfigFromRow } from './activity-reminders';
import { scheduleActivityReminder } from './service';
import {
  getActivityNotificationsEnabled,
  getNotificationsMasterEnabled,
} from './settings';

let navigationRef: NavigationContainerRef<RootStackParamList> | null = null;
let pendingNav:
  | { type: 'activity'; activityId: number }
  | { type: 'capture' }
  | null = null;
let unsubscribeForeground: (() => void) | null = null;
let bootstrapped = false;

export function setNotificationNavigationRef(
  ref: NavigationContainerRef<RootStackParamList> | null,
): void {
  navigationRef = ref;
  if (ref != null) {
    void drainPendingNotificationNav();
  }
}

async function drainPendingNotificationNav(): Promise<void> {
  if (navigationRef == null || !navigationRef.isReady() || pendingNav == null) {
    return;
  }
  const next = pendingNav;
  pendingNav = null;
  applyNotificationNav(next);
}

function applyNotificationNav(
  target: { type: 'activity'; activityId: number } | { type: 'capture' },
): void {
  if (navigationRef == null || !navigationRef.isReady()) {
    pendingNav = target;
    return;
  }

  navigationRef.dispatch(StackActions.popToTop());
  if (target.type === 'activity') {
    navigationRef.navigate('ActivityLogEntry', {
      activityId: target.activityId,
    });
    return;
  }
  navigationRef.navigate('CaptureNote');
}

function handleNotificationOpen(notification: {
  data?: { [key: string]: string | object | number };
}): void {
  const data = notification.data ?? {};
  const type = typeof data.type === 'string' ? data.type : null;

  if (type === 'activity_reminder') {
    const raw = data.activityId;
    const activityId =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
        ? Number(raw)
        : NaN;
    if (Number.isFinite(activityId)) {
      applyNotificationNav({ type: 'activity', activityId });
    }
    return;
  }

  if (type === 'place_prompt') {
    const stayKey = typeof data.stayKey === 'string' ? data.stayKey : null;
    if (stayKey != null) {
      void markPlacePromptFired(stayKey);
    }
    applyNotificationNav({ type: 'capture' });
  }
}

async function handleDelivered(notification: {
  data?: { [key: string]: string | object | number };
}): Promise<void> {
  const data = notification.data ?? {};
  const type = typeof data.type === 'string' ? data.type : null;

  if (type === 'place_prompt') {
    const stayKey = typeof data.stayKey === 'string' ? data.stayKey : null;
    if (stayKey != null) {
      await markPlacePromptFired(stayKey);
    }
    return;
  }

  // Reschedule monthly one-shots after delivery.
  if (type === 'activity_reminder' && data.repeat === 'monthly') {
    const raw = data.activityId;
    const activityId =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
        ? Number(raw)
        : NaN;
    if (!Number.isFinite(activityId)) {
      return;
    }
    const master = await getNotificationsMasterEnabled();
    const activityMaster = await getActivityNotificationsEnabled();
    if (!master || !activityMaster) {
      return;
    }
    const row = await getActivityById(activityId);
    if (row == null || !row.reminderEnabled) {
      return;
    }
    await scheduleActivityReminder({
      activityId: row.id,
      emoji: row.emoji,
      label: row.label,
      config: reminderConfigFromRow(row),
    });
  }
}

async function onNotifeeEvent({ type, detail }: Event): Promise<void> {
  const notification = detail.notification;
  if (notification == null) {
    return;
  }

  if (type === EventType.DELIVERED) {
    await handleDelivered(notification);
    return;
  }

  if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
    handleNotificationOpen(notification);
  }
}

export async function bootstrapNotifications(): Promise<void> {
  if (bootstrapped) {
    return;
  }
  bootstrapped = true;

  await ensureNotificationChannels();

  unsubscribeForeground?.();
  unsubscribeForeground = notifee.onForegroundEvent(event => {
    void onNotifeeEvent(event);
  });

  notifee.onBackgroundEvent(async event => {
    await onNotifeeEvent(event);
  });

  const initial = await notifee.getInitialNotification();
  if (initial?.notification != null) {
    handleNotificationOpen(initial.notification);
  }

  try {
    await resyncAllActivityReminders();
  } catch {
    // Non-fatal — reminders resync on next preference change.
  }
}

export async function teardownNotificationsForTests(): Promise<void> {
  unsubscribeForeground?.();
  unsubscribeForeground = null;
  bootstrapped = false;
  navigationRef = null;
  pendingNav = null;
}

export { syncActivityReminderSchedule };
