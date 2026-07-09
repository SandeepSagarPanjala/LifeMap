import { distanceMeters, type LocationPointLike } from './geo';
import type { PlacePoiRow } from './types';

export function closestPlacePoiToAnchor(
  anchor: LocationPointLike,
  pois: readonly PlacePoiRow[],
): PlacePoiRow | null {
  let best: PlacePoiRow | null = null;
  let bestDistanceM = Number.POSITIVE_INFINITY;

  for (const poi of pois) {
    if (!Number.isFinite(poi.lat) || !Number.isFinite(poi.lng)) {
      continue;
    }
    const distanceM = distanceMeters(anchor, { lat: poi.lat, lng: poi.lng });
    if (distanceM < bestDistanceM) {
      best = poi;
      bestDistanceM = distanceM;
    }
  }

  return best;
}

export function listPlacePoisForCache(
  cacheId: number,
  pois: readonly PlacePoiRow[],
): PlacePoiRow[] {
  return pois.filter(poi => poi.cacheId === cacheId);
}
