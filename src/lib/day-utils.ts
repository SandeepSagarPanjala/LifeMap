import {TZDate} from '@date-fns/tz';
import {
  addDays,
  endOfDay,
  format,
  isAfter,
  startOfDay,
  subYears,
} from 'date-fns';

import {APP_TIMEZONE} from '@/lib/timezone';

function toZonedDate(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE);
}

/** Calendar day in app timezone as `yyyy-MM-dd`. */
export function toDateKey(date: Date): string {
  return format(toZonedDate(date), 'yyyy-MM-dd');
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return startOfDay(new TZDate(year, month - 1, day, APP_TIMEZONE));
}

export function getDayRange(dateKey: string): {start: Date; end: Date} {
  const day = parseDateKey(dateKey);
  return {start: day, end: endOfDay(day)};
}

export function getTodayDateKey(): string {
  return toDateKey(new Date());
}

export function getOneYearAgoDateKey(from: Date = new Date()): string {
  return toDateKey(subYears(startOfDay(toZonedDate(from)), 1));
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  return toDateKey(addDays(parseDateKey(dateKey), deltaDays));
}

export function isDateKeyAfterToday(dateKey: string, now: Date = new Date()): boolean {
  return isAfter(parseDateKey(dateKey), startOfDay(toZonedDate(now)));
}
