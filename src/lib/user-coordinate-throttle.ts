import {distanceKm} from '@/lib/location-geo';

export type MapUserCoordinate = {
  latitude: number;
  longitude: number;
};

/** Label proximity only — the native blue puck updates on its own. */
export const USER_COORDINATE_MIN_INTERVAL_MS = 10_000;
export const USER_COORDINATE_MIN_MOVE_METERS = 25;

export function shouldRefreshUserCoordinate(
  previous: MapUserCoordinate | null,
  next: MapUserCoordinate,
  lastRefreshMs: number,
  nowMs: number = Date.now(),
): boolean {
  if (previous == null) {
    return true;
  }

  if (nowMs - lastRefreshMs >= USER_COORDINATE_MIN_INTERVAL_MS) {
    return true;
  }

  const movedMeters =
    distanceKm(
      {lat: previous.latitude, lng: previous.longitude},
      {lat: next.latitude, lng: next.longitude},
    ) * 1000;
  return movedMeters >= USER_COORDINATE_MIN_MOVE_METERS;
}
