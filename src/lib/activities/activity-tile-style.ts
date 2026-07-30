import type { ActivityRow } from '@/db/repositories/activities';
import {
  formatTimeMinutes,
  weeklySummaryLabel,
} from '@/lib/notifications/schedule-math';
import {
  reminderConfigFromRow,
} from '@/lib/notifications/activity-reminders';
import type { ActivityReminderConfig } from '@/lib/notifications/types';

/** One-tap activities (no fields). */
export const ACTIVITY_TINT_ONE_TAP = '#F0FDF4';
/** Config / structured activities (have fields). */
export const ACTIVITY_TINT_CONFIG = '#EFF6FF';
/** Stronger notify gradient starts (readable behind emoji). */
export const ACTIVITY_TINT_NOTIFY_GREEN = '#DCFCE7';
export const ACTIVITY_TINT_NOTIFY_BLUE = '#DBEAFE';
/** Notify-me gradient end. */
export const ACTIVITY_TINT_NOTIFY_PINK = '#FBCFE8';

export function activityHasConfigFields(activity: ActivityRow): boolean {
  return activity.fields.length > 0;
}

export function activityCoreTint(activity: ActivityRow): string {
  return activityHasConfigFields(activity)
    ? ACTIVITY_TINT_CONFIG
    : ACTIVITY_TINT_ONE_TAP;
}

export function activityNotifyGradientStart(activity: ActivityRow): string {
  return activityHasConfigFields(activity)
    ? ACTIVITY_TINT_NOTIFY_BLUE
    : ACTIVITY_TINT_NOTIFY_GREEN;
}

export function formatActivityReminderSummary(
  config: ActivityReminderConfig,
): string {
  const time = formatTimeMinutes(config.timeMinutes);
  switch (config.repeat) {
    case 'never':
      return `Once · ${time}`;
    case 'daily':
      return `Daily · ${time}`;
    case 'weekdays':
      return `Weekdays · ${time}`;
    case 'weekly':
      return `${weeklySummaryLabel(config.weekday)} · ${time}`;
    case 'monthly':
      return `Monthly · ${time}`;
    default:
      return time;
  }
}

export function activityReminderSummary(activity: ActivityRow): string | null {
  if (!activity.reminderEnabled) {
    return null;
  }
  return formatActivityReminderSummary(reminderConfigFromRow(activity));
}
