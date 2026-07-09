import { distanceKm, type LocationPointLike } from '@/lib/location-geo';
import { TRACKING_DISTANCE_FILTER_METERS } from '@/lib/app-constants';

export type LastPersistedFix = {
  timestampMs: number;
  lat: number;
  lng: number;
};

/** Skip exact duplicate rows the SDK may emit in a burst. */
export function isExactDuplicatePersist(
  last: LastPersistedFix | null,
  timestampMs: number,
  lat: number,
  lng: number,
): boolean {
  return (
    last != null &&
    last.timestampMs === timestampMs &&
    last.lat === lat &&
    last.lng === lng
  );
}

/** Motion callbacks can fire far more often than GPS — never out-save onLocation. */
export function shouldSkipMotionPersist(
  last: LastPersistedFix | null,
  point: LocationPointLike,
  timestampMs: number,
  minIntervalMs = 5_000,
): boolean {
  if (last == null) {
    return false;
  }
  const elapsedMs = timestampMs - last.timestampMs;
  if (elapsedMs < 0) {
    return false;
  }
  if (elapsedMs >= minIntervalMs) {
    return false;
  }
  const distM = distanceKm(last, point) * 1000;
  return distM < TRACKING_DISTANCE_FILTER_METERS;
}
