import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import type {DetectedTrip} from '@/lib/trip-detection';
import {stayMapCentroid} from '@/lib/trip-detection';

export type StayMapCircle = {
  key: string;
  center: {latitude: number; longitude: number};
  radiusMeters: number;
};

/** Saved places already have a pin — skip the orange dwell circle. */
export function staysNeedingVisitAreaOverlay(
  stays: readonly DetectedTrip[],
  _savedPlaces: readonly SavedPlaceRow[],
): DetectedTrip[] {
  return stays.filter(stay => stay.savedPlaceId == null);
}

export function buildStayMapCircles(
  stays: DetectedTrip[],
  dwellRadiusMeters: number,
  savedPlaces: readonly SavedPlaceRow[] = [],
): StayMapCircle[] {
  const visible = staysNeedingVisitAreaOverlay(stays, savedPlaces);
  return visible.map(stay => ({
    key: stay.id,
    center: stayMapCentroid(stay),
    radiusMeters: dwellRadiusMeters,
  }));
}
