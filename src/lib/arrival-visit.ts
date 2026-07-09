import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import { arePointsSamePlace, type DetectedTrip } from '@/lib/trip-detection';
import type { TripDetectionConfig } from '@/lib/trip-settings';
import { stayMeetsMinimumVisitDwell } from '@/lib/visit-dwell';

/** Drive ended and the next timeline row is a real visit at the same place (e.g. Whataburger). */
export function isArrivalVisitAfterDrive(
  drive: DetectedTrip,
  visit: DetectedTrip | null,
  config: TripDetectionConfig,
  savedPlaces: readonly SavedPlaceRow[] = [],
): boolean {
  if (drive.kind !== 'travel' || visit == null || visit.kind !== 'stay') {
    return false;
  }
  if (!stayMeetsMinimumVisitDwell(visit, config, savedPlaces)) {
    return false;
  }

  const lastDrivePoint = drive.points[drive.points.length - 1];
  const firstVisitPoint = visit.points[0];
  if (lastDrivePoint == null || firstVisitPoint == null) {
    return false;
  }

  return arePointsSamePlace(lastDrivePoint, firstVisitPoint, config);
}
