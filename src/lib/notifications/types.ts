export const MAX_ACTIVITY_REMINDERS = 5;

export type ReminderRepeat =
  | 'never'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly';

export type ReminderSound = 'ding' | 'silent';

export type PlaceNotifyMode = 'new_place' | 'unique_place';

export type ActivityReminderConfig = {
  enabled: boolean;
  repeat: ReminderRepeat;
  /** Minutes from local midnight (0–1439). */
  timeMinutes: number;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** 1–31. */
  dayOfMonth: number;
  /** One-shot / monthly anchor date (local midnight of that day). */
  anchorAt: Date | null;
  sound: ReminderSound;
};

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function defaultReminderConfig(
  now = new Date(),
): ActivityReminderConfig {
  return {
    enabled: false,
    repeat: 'daily',
    timeMinutes: now.getHours() * 60 + now.getMinutes(),
    weekday: now.getDay(),
    dayOfMonth: now.getDate(),
    anchorAt: now,
    sound: 'ding',
  };
}

export function isReminderRepeat(value: string): value is ReminderRepeat {
  return (
    value === 'never' ||
    value === 'daily' ||
    value === 'weekdays' ||
    value === 'weekly' ||
    value === 'monthly'
  );
}

export function isReminderSound(value: string): value is ReminderSound {
  return value === 'ding' || value === 'silent';
}

export function activityNotificationId(activityId: number): string {
  return `activity-reminder-${activityId}`;
}

export function activityWeekdayNotificationId(
  activityId: number,
  weekday: number,
): string {
  return `activity-reminder-${activityId}-wd-${weekday}`;
}

export function placePromptNotificationId(stayKey: string): string {
  return `place-prompt-${stayKey}`;
}

export function placeArrivalHoldId(stayKey: string): string {
  return `place-arrival-hold-${stayKey}`;
}
