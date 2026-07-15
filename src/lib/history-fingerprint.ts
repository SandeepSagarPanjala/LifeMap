import {
  getLocationDayFingerprint,
  getLocationPointsFingerprintInRange,
} from '@/db/repositories/location-days';
import { getMaterializedDay } from '@/db/repositories/materialized-days';
import { countTripPointsForDay } from '@/db/repositories/trip-points';
import { listTripsForDay, countTripsForDay } from '@/db/repositories/trips';
import { getMomentsDayFingerprint } from '@/db/repositories/moments';
import { getTodayDateKey, shiftDateKey } from '@/lib/day-utils';
import { sealedThroughMs } from '@/lib/today-sealed-history';
import { getGeometryPersistFingerprint } from '@/lib/trip-geometry-settings';
import {
  TRIP_DETECTION_VERSION,
  TRIP_GEOMETRY_VERSION,
} from '@/lib/app-constants';

/** Cache key for history timeline — GPS, moments, and materialized trip generation. */
export async function getDayHistoryFingerprint(
  dateKey: string,
): Promise<string> {
  const isToday = dateKey === getTodayDateKey();
  const tripRows = isToday ? await listTripsForDay(dateKey) : [];
  const sealedEnd = isToday ? sealedThroughMs(tripRows) : null;

  const [
    locationFingerprint,
    momentsFingerprint,
    materializedDay,
    tripCount,
    tripPointCount,
    geometryPersistFingerprint,
  ] = await Promise.all([
    sealedEnd != null
      ? getLocationPointsFingerprintInRange(new Date(sealedEnd), new Date())
      : getLocationDayFingerprint(dateKey),
    getMomentsDayFingerprint(dateKey),
    getMaterializedDay(dateKey),
    countTripsForDay(dateKey),
    countTripPointsForDay(dateKey),
    getGeometryPersistFingerprint(),
  ]);

  // When D excluded an overnight drive, invalidate if D+1 seal changes.
  const excludedMs = materializedDay?.excludedCrossMidnightFromMs ?? null;
  let nextDayBorrowToken = 'none';
  if (!isToday && excludedMs != null) {
    const nextDay = await getMaterializedDay(shiftDateKey(dateKey, 1));
    nextDayBorrowToken = `${nextDay?.status ?? 'none'}:${nextDay?.tripCount ?? 0}:${nextDay?.detectionVersion ?? 0}`;
  }

  return [
    locationFingerprint,
    momentsFingerprint,
    TRIP_DETECTION_VERSION,
    TRIP_GEOMETRY_VERSION,
    geometryPersistFingerprint,
    materializedDay?.geometryFingerprint ?? 'none',
    materializedDay?.detectionVersion ?? 0,
    materializedDay?.status ?? 'none',
    tripCount,
    tripPointCount,
    excludedMs ?? 'none',
    nextDayBorrowToken,
  ].join('|');
}
