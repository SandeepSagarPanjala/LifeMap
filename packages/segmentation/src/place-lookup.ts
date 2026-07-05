import {distanceMeters, type LocationPointLike} from './geo';
import type {PlaceLookupRow} from './types';
import {PLACE_LOOKUP_VENUE_RADIUS_M} from '@lifemap/constants';

export {PLACE_LOOKUP_VENUE_RADIUS_M};

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

export function matchCompletePlaceLookupAtAnchor(
  anchor: {lat: number; lng: number},
  cacheRows: readonly PlaceLookupRow[],
): PlaceLookupRow | null {
  if (cacheRows.length === 0) {
    return null;
  }
  const row = findNearestPlaceLookupMatch(anchor, [...cacheRows]);
  if (!row || row.lookupStatus !== 'complete') {
    return null;
  }
  return row;
}
