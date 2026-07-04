import {distanceKm, type LocationPointLike} from '@/lib/location-geo';

export {
  PLACE_LOOKUP_MAX_RADIUS_M,
  PLACE_LOOKUP_RADIUS_STEPS,
  PLACE_LOOKUP_SESSION_BUDGET,
  PLACE_LOOKUP_VENUE_RADIUS_M,
} from '@/lib/app-constants';

import {
  PLACE_LOOKUP_RADIUS_STEPS,
  PLACE_LOOKUP_VENUE_RADIUS_M,
} from '@/lib/app-constants';

export function nextPlaceLookupRadiusM(current: number): number | null {
  for (const step of PLACE_LOOKUP_RADIUS_STEPS) {
    if (step > current) {
      return step;
    }
  }
  return null;
}

export function placeLookupAnchorKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export function distanceMeters(
  a: LocationPointLike,
  b: LocationPointLike,
): number {
  return distanceKm(a, b) * 1000;
}

export function isWithinPlaceLookupVenue(
  anchor: LocationPointLike,
  cachedAnchor: LocationPointLike,
  venueRadiusM = PLACE_LOOKUP_VENUE_RADIUS_M,
): boolean {
  return distanceMeters(anchor, cachedAnchor) <= venueRadiusM;
}

export function findNearestPlaceLookupMatch<
  T extends {anchorLat: number; anchorLng: number; venueRadiusMeters: number},
>(anchor: LocationPointLike, rows: T[]): T | null {
  let best: T | null = null;
  let bestDistanceM = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const cachedAnchor = {lat: row.anchorLat, lng: row.anchorLng};
    const limitM = Math.max(row.venueRadiusMeters, PLACE_LOOKUP_VENUE_RADIUS_M);
    const distanceM = distanceMeters(anchor, cachedAnchor);
    if (distanceM <= limitM && distanceM < bestDistanceM) {
      best = row;
      bestDistanceM = distanceM;
    }
  }

  return best;
}
