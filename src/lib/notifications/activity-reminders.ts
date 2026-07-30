import { and, count, eq, isNull, ne } from 'drizzle-orm';

import { getDatabase } from '@/db/client';
import {
  getActivityById,
  listActiveActivities,
  type ActivityRow,
} from '@/db/repositories/activities';
import { activities } from '@/db/schema';

import {
  getActivityNotificationsEnabled,
  getNotificationsMasterEnabled,
} from './settings';
import { cancelActivityReminder, scheduleActivityReminder } from './service';
import {
  defaultReminderConfig,
  isReminderRepeat,
  isReminderSound,
  MAX_ACTIVITY_REMINDERS,
  type ActivityReminderConfig,
} from './types';

export function reminderConfigFromRow(
  row: ActivityRow,
): ActivityReminderConfig {
  const defaults = defaultReminderConfig();
  return {
    enabled: row.reminderEnabled,
    repeat: isReminderRepeat(row.reminderRepeat)
      ? row.reminderRepeat
      : defaults.repeat,
    timeMinutes:
      row.reminderTimeMinutes != null
        ? row.reminderTimeMinutes
        : defaults.timeMinutes,
    weekday:
      row.reminderWeekday != null ? row.reminderWeekday : defaults.weekday,
    dayOfMonth:
      row.reminderDayOfMonth != null
        ? row.reminderDayOfMonth
        : defaults.dayOfMonth,
    anchorAt: row.reminderAnchorAt ?? defaults.anchorAt,
    sound: isReminderSound(row.reminderSound)
      ? row.reminderSound
      : defaults.sound,
  };
}

export async function countActiveActivityReminders(
  excludeActivityId?: number,
): Promise<number> {
  const db = await getDatabase();
  if (excludeActivityId != null) {
    const rows = await db
      .select({ value: count() })
      .from(activities)
      .where(
        and(
          isNull(activities.archivedAt),
          eq(activities.reminderEnabled, true),
          ne(activities.id, excludeActivityId),
        ),
      );
    return Number(rows[0]?.value ?? 0);
  }
  const rows = await db
    .select({ value: count() })
    .from(activities)
    .where(
      and(isNull(activities.archivedAt), eq(activities.reminderEnabled, true)),
    );
  return Number(rows[0]?.value ?? 0);
}

export async function canEnableActivityReminder(
  activityId?: number,
): Promise<boolean> {
  const active = await countActiveActivityReminders(activityId);
  return active < MAX_ACTIVITY_REMINDERS;
}

export async function syncActivityReminderSchedule(
  activityId: number,
): Promise<void> {
  const row = await getActivityById(activityId);
  if (row == null || row.archivedAt != null) {
    await cancelActivityReminder(activityId);
    return;
  }

  const master = await getNotificationsMasterEnabled();
  const activityMaster = await getActivityNotificationsEnabled();
  const config = reminderConfigFromRow(row);

  if (!master || !activityMaster || !config.enabled) {
    await cancelActivityReminder(activityId);
    return;
  }

  await scheduleActivityReminder({
    activityId: row.id,
    emoji: row.emoji,
    label: row.label,
    config,
  });
}

export async function resyncAllActivityReminders(): Promise<void> {
  const rows = await listActiveActivities();
  const master = await getNotificationsMasterEnabled();
  const activityMaster = await getActivityNotificationsEnabled();

  for (const row of rows) {
    if (!master || !activityMaster || !row.reminderEnabled) {
      await cancelActivityReminder(row.id);
      continue;
    }
    await scheduleActivityReminder({
      activityId: row.id,
      emoji: row.emoji,
      label: row.label,
      config: reminderConfigFromRow(row),
    });
  }
}

export async function cancelAllActivityReminders(): Promise<void> {
  const rows = await listActiveActivities();
  await Promise.all(rows.map(row => cancelActivityReminder(row.id)));
}
