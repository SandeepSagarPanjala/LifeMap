import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import type {DetectedTrip} from '@/lib/trip-detection';
import {
  DEFAULT_TRIP_DWELL_MINUTES,
  SAVED_PLACE_MIN_DWELL_MINUTES,
} from '@/lib/app-constants';
import type {TripDetectionConfig} from '@/lib/trip-settings';

export function isSavedPlaceVisit(stay: DetectedTrip): boolean {
  return stay.placeKind === 'saved' && stay.placeId != null;
}

/** Minimum minutes at a place before it counts as a visit. */
export function minimumVisitDwellMinutes(
  config: TripDetectionConfig,
  stay?: DetectedTrip,
  _savedPlaces: readonly SavedPlaceRow[] = [],
): number {
  if (stay != null && isSavedPlaceVisit(stay)) {
    return SAVED_PLACE_MIN_DWELL_MINUTES;
  }
  return config.dwellMinutes ?? DEFAULT_TRIP_DWELL_MINUTES;
}

export function minimumVisitDwellMs(
  config: TripDetectionConfig,
  stay?: DetectedTrip,
  savedPlaces: readonly SavedPlaceRow[] = [],
): number {
  return minimumVisitDwellMinutes(config, stay, savedPlaces) * 60_000;
}

export function stayMeetsMinimumVisitDwell(
  stay: DetectedTrip,
  config: TripDetectionConfig,
  savedPlaces: readonly SavedPlaceRow[] = [],
): boolean {
  return stay.durationMs >= minimumVisitDwellMs(config, stay, savedPlaces);
}
