import {distanceKm} from '@/lib/location-geo';
import {
  USER_COORDINATE_MIN_INTERVAL_MS,
  USER_COORDINATE_MIN_MOVE_METERS,
} from '@/lib/app-constants';

export type MapUserCoordinate = {
  latitude: number;
  longitude: number;
};

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
