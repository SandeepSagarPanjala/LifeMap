import notifee, {
  AlarmType,
  AndroidImportance,
  RepeatFrequency,
  TriggerType,
  type TimestampTrigger,
} from 'react-native-notify-kit';
import { Platform } from 'react-native';

import {
  CHANNEL_ACTIVITY_SILENT,
  CHANNEL_ACTIVITY_SOUND,
  CHANNEL_PLACE_PROMPTS,
  ensureNotificationChannels,
} from './channels';
import { nextFireForRepeat, nextWeeklyFire } from './schedule-math';
import {
  activityNotificationId,
  activityWeekdayNotificationId,
  type ActivityReminderConfig,
  type ReminderSound,
} from './types';

type ActivityReminderPayload = {
  activityId: number;
  emoji: string;
  label: string;
  config: ActivityReminderConfig;
};

function androidChannelForSound(sound: ReminderSound): string {
  return sound === 'silent' ? CHANNEL_ACTIVITY_SILENT : CHANNEL_ACTIVITY_SOUND;
}

function iosSoundFor(sound: ReminderSound): string | undefined {
  return sound === 'silent' ? undefined : 'default';
}

function withAndroidAlarm<T extends TimestampTrigger>(trigger: T): T {
  if (Platform.OS !== 'android') {
    return trigger;
  }
  return {
    ...trigger,
    alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE },
  };
}

async function cancelActivityIds(activityId: number): Promise<void> {
  const ids = [
    activityNotificationId(activityId),
    ...[1, 2, 3, 4, 5].map(wd => activityWeekdayNotificationId(activityId, wd)),
  ];
  await Promise.all(ids.map(id => notifee.cancelNotification(id)));
}

export async function cancelActivityReminder(
  activityId: number,
): Promise<void> {
  await cancelActivityIds(activityId);
}

export async function scheduleActivityReminder(
  payload: ActivityReminderPayload,
): Promise<void> {
  await ensureNotificationChannels();
  await cancelActivityIds(payload.activityId);

  const { config, activityId, emoji, label } = payload;
  if (!config.enabled) {
    return;
  }

  const title = `${emoji} ${label}`.trim();
  const body = `Time for ${label}`;
  const data = {
    type: 'activity_reminder',
    activityId: String(activityId),
  };

  const baseNotification = {
    title,
    body,
    data,
    android: {
      channelId: androidChannelForSound(config.sound),
      pressAction: { id: 'default' },
      importance: AndroidImportance.HIGH,
    },
    ios: {
      sound: iosSoundFor(config.sound),
    },
  };

  // Weekdays: five weekly OS triggers (Mon–Fri) so the app need not be open.
  if (config.repeat === 'weekdays') {
    for (const weekday of [1, 2, 3, 4, 5] as const) {
      const timestamp = nextWeeklyFire(weekday, config.timeMinutes).getTime();
      const trigger = withAndroidAlarm({
        type: TriggerType.TIMESTAMP,
        timestamp,
        repeatFrequency: RepeatFrequency.WEEKLY,
      } satisfies TimestampTrigger);
      await notifee.createTriggerNotification(
        {
          ...baseNotification,
          id: activityWeekdayNotificationId(activityId, weekday),
        },
        trigger,
      );
    }
    return;
  }

  const next = nextFireForRepeat(config.repeat, config);
  if (next == null) {
    return;
  }

  let repeatFrequency: RepeatFrequency | undefined;
  if (config.repeat === 'daily') {
    repeatFrequency = RepeatFrequency.DAILY;
  } else if (config.repeat === 'weekly') {
    repeatFrequency = RepeatFrequency.WEEKLY;
  }
  // monthly + never: one-shot; monthly rescheduled on delivery in bootstrap.

  const trigger = withAndroidAlarm({
    type: TriggerType.TIMESTAMP,
    timestamp: next.getTime(),
    ...(repeatFrequency != null ? { repeatFrequency } : null),
  } as TimestampTrigger);

  await notifee.createTriggerNotification(
    {
      ...baseNotification,
      id: activityNotificationId(activityId),
      data: {
        ...data,
        repeat: config.repeat,
      },
    },
    trigger,
  );
}

export async function displayPlacePrompt(input: {
  stayKey: string;
  placeLabel?: string | null;
}): Promise<void> {
  await ensureNotificationChannels();
  const body =
    input.placeLabel != null && input.placeLabel.trim().length > 0
      ? `Hey, do you want to take a moment at ${input.placeLabel}?`
      : 'Hey, do you want to take a moment here?';

  await notifee.displayNotification({
    id: `place-prompt-${input.stayKey}`,
    title: 'New place',
    body,
    data: {
      type: 'place_prompt',
      stayKey: input.stayKey,
    },
    android: {
      channelId: CHANNEL_PLACE_PROMPTS,
      pressAction: { id: 'default' },
      importance: AndroidImportance.HIGH,
    },
    ios: {
      sound: 'default',
    },
  });
}

export async function cancelPlaceArrivalHold(stayKey: string): Promise<void> {
  await notifee.cancelNotification(`place-arrival-hold-${stayKey}`);
}

/** Schedule the place prompt for 5 minutes after arrival (OS fires even if app is backgrounded). */
export async function schedulePlaceArrivalHold(input: {
  stayKey: string;
  fireAt: Date;
  placeLabel?: string | null;
  mode: string;
}): Promise<void> {
  await ensureNotificationChannels();
  await cancelPlaceArrivalHold(input.stayKey);

  const body =
    input.placeLabel != null && input.placeLabel.trim().length > 0
      ? `Hey, do you want to take a moment at ${input.placeLabel}?`
      : 'Hey, do you want to take a moment here?';

  const trigger = withAndroidAlarm({
    type: TriggerType.TIMESTAMP,
    timestamp: input.fireAt.getTime(),
  } satisfies TimestampTrigger);

  await notifee.createTriggerNotification(
    {
      id: `place-arrival-hold-${input.stayKey}`,
      title: 'New place',
      body,
      data: {
        type: 'place_prompt',
        stayKey: input.stayKey,
        mode: input.mode,
      },
      android: {
        channelId: CHANNEL_PLACE_PROMPTS,
        pressAction: { id: 'default' },
        importance: AndroidImportance.HIGH,
      },
      ios: {
        sound: 'default',
      },
    },
    trigger,
  );
}
