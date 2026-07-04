import type {SavedPlaceKind, SavedPlaceRow} from '@/db/repositories/saved-places';
import {APP_COPY} from '@/lib/app-copy';
import {
  MAX_SAVED_PLACE_LABEL_LENGTH,
  MAX_SAVED_PLACES,
} from '@/lib/app-constants';
import {distanceKm, type LocationPointLike} from '@/lib/location-geo';
import type {DetectedTrip} from '@/lib/trip-detection';

const KIND_PRIORITY: Record<SavedPlaceRow['kind'], number> = {
  home: 0,
  work: 1,
  favorite: 2,
};

/** Resolve a saved place row from a trip-linked id (detection / DB — no GPS scan). */
export function lookupSavedPlaceById(
  savedPlaceId: number | null | undefined,
  places: readonly SavedPlaceRow[],
): SavedPlaceRow | null {
  if (savedPlaceId == null || places.length === 0) {
    return null;
  }
  return places.find(place => place.id === savedPlaceId) ?? null;
}

/** Used by detection (`visit-anchor`), moments, and geofence helpers — not trip display. */
export function matchSavedPlaceForPoint(
  point: LocationPointLike,
  places: readonly SavedPlaceRow[],
): SavedPlaceRow | null {
  let match: SavedPlaceRow | null = null;
  let matchPriority = Number.POSITIVE_INFINITY;
  let matchDistanceM = Number.POSITIVE_INFINITY;

  for (const place of places) {
    const distanceM = distanceKm(point, place) * 1000;
    if (distanceM > place.radiusMeters) {
      continue;
    }

    const priority = KIND_PRIORITY[place.kind];
    if (
      priority < matchPriority ||
      (priority === matchPriority && distanceM < matchDistanceM)
    ) {
      match = place;
      matchPriority = priority;
      matchDistanceM = distanceM;
    }
  }

  return match;
}

/** Trip saved-place link from detection or DB — id only, no geofence rescan. */
export function matchSavedPlaceForStay(
  stay: DetectedTrip | null,
  places: readonly SavedPlaceRow[],
): SavedPlaceRow | null {
  if (stay == null) {
    return null;
  }
  return lookupSavedPlaceById(stay.savedPlaceId, places);
}

/** Only Home visits are cut at midnight; other stays show the full span on both days. */
export function shouldSplitStayAtMidnight(
  stay: DetectedTrip,
  savedPlaces: readonly SavedPlaceRow[],
): boolean {
  return lookupSavedPlaceById(stay.savedPlaceId, savedPlaces)?.kind === 'home';
}

/** Drive endpoint label — from detection ids on the drive or adjacent stay. */
export function matchSavedPlaceForTripEndpoint(
  trip: DetectedTrip,
  endpoint: 'start' | 'end',
  places: readonly SavedPlaceRow[],
): SavedPlaceRow | null {
  const savedPlaceId =
    endpoint === 'start' ? trip.fromSavedPlaceId : trip.toSavedPlaceId;
  return lookupSavedPlaceById(savedPlaceId, places);
}

/** Drive end — detection `toSavedPlaceId`, else the following stay's saved place id. */
export function matchDriveEndSavedPlace(
  travel: DetectedTrip,
  nextStay: DetectedTrip | null,
  places: readonly SavedPlaceRow[],
): SavedPlaceRow | null {
  const fromDrive = lookupSavedPlaceById(travel.toSavedPlaceId, places);
  if (fromDrive != null) {
    return fromDrive;
  }
  return matchSavedPlaceForStay(nextStay, places);
}

/** Drive start — detection `fromSavedPlaceId`, else the previous stay's saved place id. */
export function matchDriveStartSavedPlace(
  travel: DetectedTrip,
  previousStay: DetectedTrip | null,
  places: readonly SavedPlaceRow[],
): SavedPlaceRow | null {
  const fromDrive = lookupSavedPlaceById(travel.fromSavedPlaceId, places);
  if (fromDrive != null) {
    return fromDrive;
  }
  return matchSavedPlaceForStay(previousStay, places);
}

export function savedPlaceDisplayLabel(place: SavedPlaceRow): string {
  return place.label;
}

export function normalizeSavedPlaceLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error(APP_COPY.savedPlaces.placeNameRequired);
  }
  if (trimmed.length > MAX_SAVED_PLACE_LABEL_LENGTH) {
    throw new Error(APP_COPY.savedPlaces.placeNameTooLong);
  }
  return trimmed;
}

export class SavedPlaceLimitError extends Error {
  constructor() {
    super(APP_COPY.savedPlaces.limitReached);
    this.name = 'SavedPlaceLimitError';
  }
}

export function canAddSavedPlace(
  places: readonly SavedPlaceRow[],
  kind: SavedPlaceKind,
): boolean {
  if (kind === 'home' && places.some(place => place.kind === 'home')) {
    return true;
  }
  if (kind === 'work' && places.some(place => place.kind === 'work')) {
    return true;
  }
  return places.length < MAX_SAVED_PLACES;
}

export type SavedPlaceAddByAddressOptions = {
  hasHome: boolean;
  hasWork: boolean;
  canSaveHome: boolean;
  canSaveWork: boolean;
  canSaveFavorite: boolean;
  canAddByAddress: boolean;
};

export function savedPlaceAddByAddressOptions(
  places: readonly SavedPlaceRow[],
): SavedPlaceAddByAddressOptions {
  const hasHome = places.some(place => place.kind === 'home');
  const hasWork = places.some(place => place.kind === 'work');
  const canSaveHome = !hasHome && canAddSavedPlace(places, 'home');
  const canSaveWork = !hasWork && canAddSavedPlace(places, 'work');
  const canSaveFavorite = canAddSavedPlace(places, 'favorite');

  return {
    hasHome,
    hasWork,
    canSaveHome,
    canSaveWork,
    canSaveFavorite,
    canAddByAddress: canSaveHome || canSaveWork || canSaveFavorite,
  };
}
