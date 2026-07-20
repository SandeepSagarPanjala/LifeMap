import { distanceKm, type LocationPointLike } from '@/lib/location-geo';
import { PLACE_LOOKUP_VENUE_RADIUS_M } from '@/lib/app-constants';
import type { ResolvedPlaceFields } from '@/lib/resolved-place';

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
  T extends { anchorLat: number; anchorLng: number; venueRadiusMeters: number },
>(anchor: LocationPointLike, rows: T[]): T | null {
  let best: T | null = null;
  let bestDistanceM = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const cachedAnchor = { lat: row.anchorLat, lng: row.anchorLng };
    const limitM = Math.max(row.venueRadiusMeters, PLACE_LOOKUP_VENUE_RADIUS_M);
    const distanceM = distanceMeters(anchor, cachedAnchor);
    if (distanceM <= limitM && distanceM < bestDistanceM) {
      best = row;
      bestDistanceM = distanceM;
    }
  }

  return best;
}

function cacheMatchesStayAnchor(
  stayAnchor: LocationPointLike,
  cache: { anchorLat: number; anchorLng: number; venueRadiusMeters: number },
): boolean {
  const limitM = Math.max(cache.venueRadiusMeters, PLACE_LOOKUP_VENUE_RADIUS_M);
  return isWithinPlaceLookupVenue(
    stayAnchor,
    { lat: cache.anchorLat, lng: cache.anchorLng },
    limitM,
  );
}

/**
 * Drop a preserved cache placeId when it is not near this stay (e.g. another
 * visit's folder leaked onto this row). Prefer detection at the stay anchor.
 */
export function reconcileCachePlaceLabelForStayAnchor(
  labels: ResolvedPlaceFields,
  stayAnchor: LocationPointLike,
  cacheById: ReadonlyMap<
    number,
    { anchorLat: number; anchorLng: number; venueRadiusMeters: number }
  >,
  detected?: ResolvedPlaceFields | null,
): ResolvedPlaceFields {
  if (labels.placeKind !== 'cache' || labels.placeId == null) {
    return labels;
  }

  const linked = cacheById.get(labels.placeId);
  if (linked != null && cacheMatchesStayAnchor(stayAnchor, linked)) {
    return labels;
  }

  if (detected?.placeKind === 'cache' && detected.placeId != null) {
    const detectedCache = cacheById.get(detected.placeId);
    if (
      detectedCache != null &&
      cacheMatchesStayAnchor(stayAnchor, detectedCache)
    ) {
      return {
        placeLabel: detected.placeLabel ?? labels.placeLabel,
        placeId: detected.placeId,
        placeKind: 'cache',
        poiId: detected.poiId ?? null,
        poiLabel: detected.poiLabel ?? null,
        poiCategory: detected.poiCategory ?? null,
      };
    }
  }

  return {
    placeLabel: detected?.placeLabel ?? labels.placeLabel,
    placeId: null,
    placeKind: null,
    poiId: null,
    poiLabel: null,
    poiCategory: null,
  };
}
