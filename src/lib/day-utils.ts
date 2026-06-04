import {
  addDays,
  endOfDay,
  format,
  isAfter,
  parseISO,
  startOfDay,
  subYears,
} from 'date-fns';

/** Local calendar day as `yyyy-MM-dd`. */
export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseDateKey(dateKey: string): Date {
  return startOfDay(parseISO(dateKey));
}

export function getDayRange(dateKey: string): {start: Date; end: Date} {
  const day = parseDateKey(dateKey);
  return {start: startOfDay(day), end: endOfDay(day)};
}

export function getTodayDateKey(): string {
  return toDateKey(new Date());
}

export function getOneYearAgoDateKey(from: Date = new Date()): string {
  return toDateKey(subYears(startOfDay(from), 1));
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  return toDateKey(addDays(parseDateKey(dateKey), deltaDays));
}

export function isDateKeyAfterToday(dateKey: string, now: Date = new Date()): boolean {
  return isAfter(parseDateKey(dateKey), startOfDay(now));
}
