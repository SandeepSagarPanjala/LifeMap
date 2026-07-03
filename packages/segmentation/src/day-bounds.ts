import {TZDate} from '@date-fns/tz';
import {addDays, endOfDay, format, startOfDay} from 'date-fns';

import {APP_TIMEZONE} from './timezone';

function toZonedDate(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE);
}

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

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  return toDateKey(addDays(parseDateKey(dateKey), deltaDays));
}

/** Calendar day key for a timestamp in app timezone. */
export function dateKeyForTimestamp(date: Date): string {
  return toDateKey(date);
}

/** Start of calendar day (inclusive). */
export function dayStart(dayKey: string): Date {
  return getDayRange(dayKey).start;
}

/** Start of the next calendar day (exclusive end for overlap checks). */
export function dayEndExclusive(dayKey: string): Date {
  return getDayRange(shiftDateKey(dayKey, 1)).start;
}

export function addDaysToDateKey(dayKey: string, delta: number): string {
  return shiftDateKey(dayKey, delta);
}

export function coerceTimestamp(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}
