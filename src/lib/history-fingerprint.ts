import {getLocationDayFingerprint, getLocationPointsFingerprintInRange} from '@/db/repositories/location-days';
import {getMaterializedDay} from '@/db/repositories/materialized-days';
import {countTripPointsForDay} from '@/db/repositories/trip-points';
import {listTripsForDay, countTripsForDay} from '@/db/repositories/trips';
import {getMomentsDayFingerprint} from '@/db/repositories/moments';
import {getTodayDateKey} from '@/lib/day-utils';
import {sealedThroughMs} from '@/lib/today-sealed-history';
import {TRIP_DETECTION_VERSION, TRIP_GEOMETRY_VERSION} from '@/lib/trip-settings';

/** Cache key for history timeline — GPS, moments, and materialized trip generation. */
export async function getDayHistoryFingerprint(
  dateKey: string,
): Promise<string> {
  const isToday = dateKey === getTodayDateKey();
  const tripRows = isToday ? await listTripsForDay(dateKey) : [];
  const sealedEnd = isToday ? sealedThroughMs(tripRows) : null;

  const [locationFingerprint, momentsFingerprint, materializedDay, tripCount, tripPointCount] =
    await Promise.all([
      sealedEnd != null
        ? getLocationPointsFingerprintInRange(new Date(sealedEnd), new Date())
        : getLocationDayFingerprint(dateKey),
      getMomentsDayFingerprint(dateKey),
      getMaterializedDay(dateKey),
      countTripsForDay(dateKey),
      countTripPointsForDay(dateKey),
    ]);
  return [
    locationFingerprint,
    momentsFingerprint,
    TRIP_DETECTION_VERSION,
    TRIP_GEOMETRY_VERSION,
    materializedDay?.detectionVersion ?? 0,
    materializedDay?.status ?? 'none',
    tripCount,
    tripPointCount,
  ].join('|');
}
