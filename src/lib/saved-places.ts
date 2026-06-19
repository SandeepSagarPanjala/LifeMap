import type {SavedPlaceKind, SavedPlaceRow} from '@/db/repositories/saved-places';
import {distanceKm, type LocationPointLike} from '@/lib/location-geo';
import type {DetectedTrip} from '@/lib/trip-detection';
import {stayTripCentroid} from '@/lib/trip-detection';

const KIND_PRIORITY: Record<SavedPlaceRow['kind'], number> = {
  home: 0,
  work: 1,
  favorite: 2,
};

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

export function matchSavedPlaceForStay(
  stay: DetectedTrip,
  places: readonly SavedPlaceRow[],
): SavedPlaceRow | null {
  if (places.length === 0 || stay.points.length === 0) {
    return null;
  }

  const centroid = stayTripCentroid(stay);
  const centroidMatch = matchSavedPlaceForPoint(
    {lat: centroid.latitude, lng: centroid.longitude},
    places,
  );
  if (centroidMatch != null) {
    return centroidMatch;
  }

  for (const point of stay.points) {
    const match = matchSavedPlaceForPoint(point, places);
    if (match != null) {
      return match;
    }
  }

  return null;
}

/** Only Home visits are cut at midnight; other stays show the full span on both days. */
export function shouldSplitStayAtMidnight(
  stay: DetectedTrip,
  savedPlaces: readonly SavedPlaceRow[],
): boolean {
  return matchSavedPlaceForStay(stay, savedPlaces)?.kind === 'home';
}

export function matchSavedPlaceForTripEndpoint(
  trip: DetectedTrip,
  endpoint: 'start' | 'end',
  places: readonly SavedPlaceRow[],
): SavedPlaceRow | null {
  if (trip.points.length === 0 || places.length === 0) {
    return null;
  }
  const point =
    endpoint === 'start'
      ? trip.points[0]!
      : trip.points[trip.points.length - 1]!;
  return matchSavedPlaceForPoint(point, places);
}

/** Drive end — last GPS is often still on the road; use the next visit when needed. */
export function matchDriveEndSavedPlace(
  travel: DetectedTrip,
  nextStay: DetectedTrip | null,
  places: readonly SavedPlaceRow[],
): SavedPlaceRow | null {
  const fromEndpoint = matchSavedPlaceForTripEndpoint(travel, 'end', places);
  if (fromEndpoint != null) {
    return fromEndpoint;
  }
  if (nextStay != null) {
    return matchSavedPlaceForStay(nextStay, places);
  }
  return null;
}

/** Drive start — parking-lot departure GPS may sit outside the saved-place radius. */
export function matchDriveStartSavedPlace(
  travel: DetectedTrip,
  previousStay: DetectedTrip | null,
  places: readonly SavedPlaceRow[],
): SavedPlaceRow | null {
  const fromEndpoint = matchSavedPlaceForTripEndpoint(travel, 'start', places);
  if (fromEndpoint != null) {
    return fromEndpoint;
  }
  if (previousStay != null) {
    return matchSavedPlaceForStay(previousStay, places);
  }
  return null;
}

export function savedPlaceDisplayLabel(place: SavedPlaceRow): string {
  return place.label;
}

export const MAX_SAVED_PLACES = 20;

export class SavedPlaceLimitError extends Error {
  constructor() {
    super(`You can save up to ${MAX_SAVED_PLACES} places. Remove one to add another.`);
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
