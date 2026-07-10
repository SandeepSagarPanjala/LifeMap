import {
  getLocationPointsInRange,
  type LocationPointRow,
} from '@/db/repositories/location-days';
import { getMaterializedDay } from '@/db/repositories/materialized-days';
import type { TripRow } from '@/db/repositories/trips';
import { getDayRange, shiftDateKey } from '@/lib/day-utils';

/**
 * When today has no sealed trips, returns the start ms for yesterday GPS lookback,
 * or null when yesterday seal did not withhold a cross-midnight drive.
 */
export function resolveYesterdayLookbackFromMs(
  excludedCrossMidnightFromMs: number | null | undefined,
): number | null {
  if (excludedCrossMidnightFromMs == null) {
    return null;
  }
  return excludedCrossMidnightFromMs;
}

/**
 * Yesterday GPS slice for today's live detect when today has no sealed trips yet
 * and yesterday seal excluded a cross-midnight drive.
 */
export async function loadYesterdayLookbackPointsForToday(
  todayKey: string,
  todayTripRows: readonly TripRow[],
): Promise<LocationPointRow[]> {
  if (todayTripRows.length > 0) {
    return [];
  }

  const yesterdayKey = shiftDateKey(todayKey, -1);
  const materializedDay = await getMaterializedDay(yesterdayKey);

  const lookbackFromMs = resolveYesterdayLookbackFromMs(
    materializedDay?.excludedCrossMidnightFromMs,
  );
  if (lookbackFromMs == null) {
    return [];
  }

  const { end: yesterdayEnd } = getDayRange(yesterdayKey);
  if (lookbackFromMs > yesterdayEnd.getTime()) {
    return [];
  }

  return getLocationPointsInRange(new Date(lookbackFromMs), yesterdayEnd);
}
