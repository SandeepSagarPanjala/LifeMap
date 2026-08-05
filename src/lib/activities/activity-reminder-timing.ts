import { TZDate } from '@date-fns/tz';

import type { MomentRow } from '@/db/repositories/moments';
import type { ActivityReminderConfig } from '@/lib/notifications/types';
import { APP_TIMEZONE } from '@/lib/timezone';

/** Logs within ± this window of the notify time count as on time. */
export const REMINDER_ON_TIME_WINDOW_MS = 30 * 60 * 1000;

export type ReminderTimingKind = 'on_time' | 'early' | 'late';

export type ReminderTimingSummary = {
  onTime: number;
  early: number;
  late: number;
  /** Logs that fell on a scheduled notify day (sum of the three buckets). */
  counted: number;
};

function zoned(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE);
}

/** Whether `date`'s calendar day is a scheduled notify day for this repeat. */
export function isReminderScheduledDay(
  date: Date,
  config: Pick<
    ActivityReminderConfig,
    'repeat' | 'weekday' | 'dayOfMonth' | 'anchorAt'
  >,
): boolean {
  const z = zoned(date);
  switch (config.repeat) {
    case 'daily':
      return true;
    case 'weekdays': {
      const day = z.getDay();
      return day >= 1 && day <= 5;
    }
    case 'weekly':
      return z.getDay() === config.weekday;
    case 'monthly': {
      const lastDay = new TZDate(
        z.getFullYear(),
        z.getMonth() + 1,
        0,
        0,
        0,
        0,
        0,
        APP_TIMEZONE,
      ).getDate();
      const target = Math.min(Math.max(1, config.dayOfMonth), lastDay);
      return z.getDate() === target;
    }
    case 'never': {
      if (config.anchorAt == null) {
        return false;
      }
      const anchor = zoned(config.anchorAt);
      return (
        z.getFullYear() === anchor.getFullYear() &&
        z.getMonth() === anchor.getMonth() &&
        z.getDate() === anchor.getDate()
      );
    }
    default:
      return false;
  }
}

/** Notify fire datetime on the calendar day of `date` at `timeMinutes`. */
export function reminderFireOnDay(date: Date, timeMinutes: number): Date {
  const z = zoned(date);
  const hours = Math.floor(timeMinutes / 60) % 24;
  const minutes = ((timeMinutes % 60) + 60) % 60;
  return new Date(
    new TZDate(
      z.getFullYear(),
      z.getMonth(),
      z.getDate(),
      hours,
      minutes,
      0,
      0,
      APP_TIMEZONE,
    ).getTime(),
  );
}

/**
 * Classify a log vs its notify time.
 * On time: within ±30 minutes. Late: >30m after. Early: >30m before.
 */
export function classifyReminderTiming(
  loggedAt: Date,
  scheduledAt: Date,
  windowMs: number = REMINDER_ON_TIME_WINDOW_MS,
): ReminderTimingKind {
  const deltaMs = loggedAt.getTime() - scheduledAt.getTime();
  if (Math.abs(deltaMs) <= windowMs) {
    return 'on_time';
  }
  return deltaMs > windowMs ? 'late' : 'early';
}

export function classifyMomentReminderTiming(
  moment: MomentRow,
  config: Pick<
    ActivityReminderConfig,
    'repeat' | 'timeMinutes' | 'weekday' | 'dayOfMonth' | 'anchorAt'
  >,
): ReminderTimingKind | null {
  if (!isReminderScheduledDay(moment.timestamp, config)) {
    return null;
  }
  const scheduledAt = reminderFireOnDay(moment.timestamp, config.timeMinutes);
  return classifyReminderTiming(moment.timestamp, scheduledAt);
}

/** Counts of early / on-time / late logs for an enabled reminder. */
export function summarizeReminderTiming(
  moments: readonly MomentRow[],
  config: Pick<
    ActivityReminderConfig,
    'enabled' | 'repeat' | 'timeMinutes' | 'weekday' | 'dayOfMonth' | 'anchorAt'
  >,
  options?: {
    /** When set, only moments in this calendar year (app timezone). */
    year?: number;
  },
): ReminderTimingSummary {
  const empty: ReminderTimingSummary = {
    onTime: 0,
    early: 0,
    late: 0,
    counted: 0,
  };
  if (!config.enabled) {
    return empty;
  }

  let onTime = 0;
  let early = 0;
  let late = 0;

  for (const moment of moments) {
    if (options?.year != null) {
      if (zoned(moment.timestamp).getFullYear() !== options.year) {
        continue;
      }
    }
    const kind = classifyMomentReminderTiming(moment, config);
    if (kind == null) {
      continue;
    }
    if (kind === 'on_time') {
      onTime += 1;
    } else if (kind === 'early') {
      early += 1;
    } else {
      late += 1;
    }
  }

  return {
    onTime,
    early,
    late,
    counted: onTime + early + late,
  };
}

export function reminderTimingLabel(kind: ReminderTimingKind): string {
  switch (kind) {
    case 'on_time':
      return 'On time';
    case 'early':
      return 'Early';
    case 'late':
      return 'Late';
  }
}

/** Moments matching a timing bucket (newest first when sorted by caller). */
export function filterMomentsByReminderTiming(
  moments: readonly MomentRow[],
  config: Pick<
    ActivityReminderConfig,
    'enabled' | 'repeat' | 'timeMinutes' | 'weekday' | 'dayOfMonth' | 'anchorAt'
  >,
  kind: ReminderTimingKind,
  options?: { year?: number },
): MomentRow[] {
  if (!config.enabled) {
    return [];
  }
  return moments.filter(moment => {
    if (options?.year != null) {
      if (zoned(moment.timestamp).getFullYear() !== options.year) {
        return false;
      }
    }
    return classifyMomentReminderTiming(moment, config) === kind;
  });
}

/** Compact offset label relative to notify time, e.g. "12m early". */
export function formatReminderTimingOffset(
  loggedAt: Date,
  scheduledAt: Date,
): string {
  const deltaMs = loggedAt.getTime() - scheduledAt.getTime();
  const absMinutes = Math.round(Math.abs(deltaMs) / 60_000);
  if (Math.abs(deltaMs) <= REMINDER_ON_TIME_WINDOW_MS) {
    if (absMinutes === 0) {
      return 'On time';
    }
    return deltaMs < 0 ? `${absMinutes}m early` : `${absMinutes}m late`;
  }
  if (absMinutes < 60) {
    return deltaMs < 0 ? `${absMinutes}m early` : `${absMinutes}m late`;
  }
  const hours = Math.floor(absMinutes / 60);
  const rem = absMinutes % 60;
  const core =
    rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
  return deltaMs < 0 ? `${core} early` : `${core} late`;
}

