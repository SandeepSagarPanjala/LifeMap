import type {LocationPointRow} from '@/db/repositories/location-days';
import type {MapCoordinate} from '@/lib/location-geo';
import {toMapCoordinates} from '@/lib/location-geo';

export const TRIP_PLAYBACK_DURATION_MS = 45_000;

export type TripPlaybackFrame = {
  coordinate: MapCoordinate;
  point: LocationPointRow;
  pointIndex: number;
  progress: number;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Progress 0–1 mapped by timestamp along the trip. */
export function getTripPlaybackFrame(
  points: LocationPointRow[],
  progress: number,
): TripPlaybackFrame | null {
  if (points.length === 0) {
    return null;
  }

  const clamped = Math.min(1, Math.max(0, progress));
  if (points.length === 1) {
    const point = points[0]!;
    return {
      coordinate: {latitude: point.lat, longitude: point.lng},
      point,
      pointIndex: 0,
      progress: clamped,
    };
  }

  const startMs = points[0]!.timestamp.getTime();
  const endMs = points[points.length - 1]!.timestamp.getTime();
  const spanMs = Math.max(1, endMs - startMs);
  const targetMs = startMs + clamped * spanMs;

  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]!;
    const b = points[index + 1]!;
    const aMs = a.timestamp.getTime();
    const bMs = b.timestamp.getTime();

    if (targetMs < aMs && index === 0) {
      return {
        coordinate: {latitude: a.lat, longitude: a.lng},
        point: a,
        pointIndex: 0,
        progress: clamped,
      };
    }

    if (targetMs >= aMs && targetMs <= bMs) {
      const segmentSpan = Math.max(1, bMs - aMs);
      const t = (targetMs - aMs) / segmentSpan;
      return {
        coordinate: {
          latitude: lerp(a.lat, b.lat, t),
          longitude: lerp(a.lng, b.lng, t),
        },
        point: t < 0.5 ? a : b,
        pointIndex: index,
        progress: clamped,
      };
    }
  }

  const last = points[points.length - 1]!;
  return {
    coordinate: {latitude: last.lat, longitude: last.lng},
    point: last,
    pointIndex: points.length - 1,
    progress: clamped,
  };
}

export function getPlaybackCoordinates(
  points: LocationPointRow[],
  progress: number,
): MapCoordinate[] {
  const frame = getTripPlaybackFrame(points, progress);
  if (!frame || points.length === 0) {
    return [];
  }

  const coordinates = toMapCoordinates(points);
  if (coordinates.length <= 1) {
    return coordinates;
  }

  const startMs = points[0]!.timestamp.getTime();
  const endMs = points[points.length - 1]!.timestamp.getTime();
  const spanMs = Math.max(1, endMs - startMs);
  const targetMs = startMs + progress * spanMs;

  const result: MapCoordinate[] = [coordinates[0]!];

  for (let index = 0; index < points.length - 1; index += 1) {
    const aMs = points[index]!.timestamp.getTime();
    const bMs = points[index + 1]!.timestamp.getTime();

    if (targetMs > bMs) {
      result.push(coordinates[index + 1]!);
      continue;
    }

    if (targetMs >= aMs && targetMs <= bMs) {
      const frameAt = getTripPlaybackFrame(points, progress);
      if (frameAt) {
        result.push(frameAt.coordinate);
      }
      return result;
    }
  }

  return coordinates;
}
