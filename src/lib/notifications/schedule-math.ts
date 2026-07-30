/**
 * Next fire timestamps for activity reminders (local device time).
 */

import type { ActivityReminderConfig, ReminderRepeat } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function atLocalTime(base: Date, timeMinutes: number): Date {
  const hours = Math.floor(timeMinutes / 60);
  const minutes = timeMinutes % 60;
  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Next daily fire at timeMinutes (strictly after `from` if equal to now). */
export function nextDailyFire(timeMinutes: number, from = new Date()): Date {
  let candidate = atLocalTime(from, timeMinutes);
  if (candidate.getTime() <= from.getTime()) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

/** Next Mon–Fri fire. */
export function nextWeekdayFire(timeMinutes: number, from = new Date()): Date {
  let candidate = nextDailyFire(timeMinutes, from);
  for (let i = 0; i < 8; i++) {
    const day = candidate.getDay();
    if (day !== 0 && day !== 6) {
      return candidate;
    }
    candidate = addDays(atLocalTime(candidate, timeMinutes), 1);
  }
  return candidate;
}

/** Next weekly fire on weekday (0=Sun). */
export function nextWeeklyFire(
  weekday: number,
  timeMinutes: number,
  from = new Date(),
): Date {
  let candidate = atLocalTime(from, timeMinutes);
  const delta = (weekday - candidate.getDay() + 7) % 7;
  candidate = addDays(candidate, delta);
  if (candidate.getTime() <= from.getTime()) {
    candidate = addDays(candidate, 7);
  }
  return candidate;
}

/** Next monthly fire on dayOfMonth (clamped to month length). */
export function nextMonthlyFire(
  dayOfMonth: number,
  timeMinutes: number,
  from = new Date(),
): Date {
  const day = Math.min(Math.max(1, dayOfMonth), 31);
  const tryMonth = (year: number, month: number): Date => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const clamped = Math.min(day, lastDay);
    const d = new Date(year, month, clamped);
    return atLocalTime(d, timeMinutes);
  };

  let candidate = tryMonth(from.getFullYear(), from.getMonth());
  if (candidate.getTime() <= from.getTime()) {
    const nextMonth = from.getMonth() + 1;
    const year = from.getFullYear() + Math.floor(nextMonth / 12);
    const month = nextMonth % 12;
    candidate = tryMonth(year, month);
  }
  return candidate;
}

export function nextFireForRepeat(
  repeat: ReminderRepeat,
  config: Pick<
    ActivityReminderConfig,
    'timeMinutes' | 'weekday' | 'dayOfMonth' | 'anchorAt'
  >,
  from = new Date(),
): Date | null {
  switch (repeat) {
    case 'never': {
      if (config.anchorAt == null) {
        return null;
      }
      const oneShot = atLocalTime(config.anchorAt, config.timeMinutes);
      return oneShot.getTime() > from.getTime() ? oneShot : null;
    }
    case 'daily':
      return nextDailyFire(config.timeMinutes, from);
    case 'weekdays':
      return nextWeekdayFire(config.timeMinutes, from);
    case 'weekly':
      return nextWeeklyFire(config.weekday, config.timeMinutes, from);
    case 'monthly':
      return nextMonthlyFire(config.dayOfMonth, config.timeMinutes, from);
    default:
      return null;
  }
}

export function weeklySummaryLabel(weekday: number): string {
  const names = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return `Every ${names[weekday] ?? 'Monday'}`;
}

export function formatTimeMinutes(timeMinutes: number): string {
  const hours24 = Math.floor(timeMinutes / 60) % 24;
  const minutes = timeMinutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}
