import {getLocationDayFingerprint} from '@/db/repositories/location-days';
import {getMaterializedDay} from '@/db/repositories/materialized-days';
import {countTripsForDay} from '@/db/repositories/trips';
import {getMomentsDayFingerprint} from '@/db/repositories/moments';
import {TRIP_DETECTION_VERSION} from '@/lib/trip-settings';

/** Cache key for history timeline — GPS, moments, and materialized trip generation. */
export async function getDayHistoryFingerprint(
  dateKey: string,
): Promise<string> {
  const [locationFingerprint, momentsFingerprint, materializedDay, tripCount] =
    await Promise.all([
      getLocationDayFingerprint(dateKey),
      getMomentsDayFingerprint(dateKey),
      getMaterializedDay(dateKey),
      countTripsForDay(dateKey),
    ]);
  return [
    locationFingerprint,
    momentsFingerprint,
    TRIP_DETECTION_VERSION,
    materializedDay?.detectionVersion ?? 0,
    materializedDay?.status ?? 'none',
    tripCount,
  ].join('|');
}
