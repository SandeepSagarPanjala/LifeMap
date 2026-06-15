import type {LocationPointRow} from '@/db/repositories/location-days';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {distanceKm, type LocationPointLike} from '@/lib/location-geo';
import {matchSavedPlaceForPoint} from '@/lib/saved-places';

/** Point from the cluster that minimizes total distance to all others. */
export function geographicMedoid(
  points: readonly LocationPointLike[],
): LocationPointLike {
  if (points.length === 0) {
    return {lat: 0, lng: 0};
  }
  if (points.length === 1) {
    return points[0]!;
  }

  let best = points[0]!;
  let bestSum = Number.POSITIVE_INFINITY;
  for (const candidate of points) {
    let sum = 0;
    for (const point of points) {
      sum += distanceKm(candidate, point);
    }
    if (sum < bestSum) {
      bestSum = sum;
      best = candidate;
    }
  }
  return best;
}

/** Saved place wins; otherwise medoid of stay pings. */
export function resolveVisitAnchor(
  points: readonly LocationPointRow[],
  savedPlaces: readonly SavedPlaceRow[],
): {lat: number; lng: number} {
  if (points.length === 0) {
    return {lat: 0, lng: 0};
  }

  if (savedPlaces.length > 0) {
    const places = [...savedPlaces];
    const medoid = geographicMedoid(points);
    const medoidMatch = matchSavedPlaceForPoint(medoid, places);
    if (medoidMatch != null) {
      return {lat: medoidMatch.lat, lng: medoidMatch.lng};
    }

    for (const point of points) {
      const match = matchSavedPlaceForPoint(point, places);
      if (match != null) {
        return {lat: match.lat, lng: match.lng};
      }
    }
  }

  const medoid = geographicMedoid(points);
  return {lat: medoid.lat, lng: medoid.lng};
}
