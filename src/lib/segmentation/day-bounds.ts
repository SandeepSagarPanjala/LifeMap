import {getDayRange, shiftDateKey, toDateKey} from '@/lib/day-utils';

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
