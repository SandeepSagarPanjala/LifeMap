import type {LocationPointRow} from '@/db/repositories/location-days';
import {
  bearingDegrees,
  distanceKm,
  type LocationPointLike,
} from '@/lib/location-geo';

const MIN_BEARING_DEGREES = 22;
const MAX_CHORD_DISTANCE_METERS = 14;
const SAFETY_MAX_ROUTE_POINTS = 500;

function bearingDeltaDegrees(
  a: LocationPointLike,
  b: LocationPointLike,
  c: LocationPointLike,
): number {
  const first = bearingDegrees(a, b);
  const second = bearingDegrees(b, c);
  return Math.abs(((second - first + 540) % 360) - 180);
}

/** Shortest distance from `point` to the segment a→b, in meters. */
export function pointToSegmentDistanceMeters(
  point: LocationPointLike,
  segmentStart: LocationPointLike,
  segmentEnd: LocationPointLike,
): number {
  const segmentKm = distanceKm(segmentStart, segmentEnd);
  if (segmentKm === 0) {
    return distanceKm(point, segmentStart) * 1000;
  }

  const latScale = 111_320;
  const lngScale =
    latScale * Math.cos(((segmentStart.lat + segmentEnd.lat) * Math.PI) / 360);

  const ax = 0;
  const ay = 0;
  const bx = (segmentEnd.lng - segmentStart.lng) * lngScale;
  const by = (segmentEnd.lat - segmentStart.lat) * latScale;
  const px = (point.lng - segmentStart.lng) * lngScale;
  const py = (point.lat - segmentStart.lat) * latScale;

  const ab2 = bx * bx + by * by;
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / ab2));
  const closestX = ax + t * bx;
  const closestY = ay + t * by;
  const dx = px - closestX;
  const dy = py - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Drop only redundant dense points; keep corners (bearing changes) so turns
 * are not straight-lined.
 */
export function simplifyDriveRoute(
  points: readonly LocationPointRow[],
): LocationPointLike[] {
  if (points.length <= 2) {
    return points.map(point => ({lat: point.lat, lng: point.lng}));
  }

  const kept: LocationPointLike[] = [
    {lat: points[0]!.lat, lng: points[0]!.lng},
  ];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = kept[kept.length - 1]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const currentLike = {lat: current.lat, lng: current.lng};
    const bearingDelta = bearingDeltaDegrees(previous, currentLike, next);
    const chordDistanceM = pointToSegmentDistanceMeters(
      currentLike,
      previous,
      next,
    );

    if (
      bearingDelta >= MIN_BEARING_DEGREES ||
      chordDistanceM > MAX_CHORD_DISTANCE_METERS
    ) {
      kept.push(currentLike);
    }
  }

  kept.push({
    lat: points[points.length - 1]!.lat,
    lng: points[points.length - 1]!.lng,
  });

  if (kept.length <= SAFETY_MAX_ROUTE_POINTS) {
    return kept;
  }

  return downsampleEvenly(kept, SAFETY_MAX_ROUTE_POINTS);
}

function downsampleEvenly(
  points: readonly LocationPointLike[],
  maxPoints: number,
): LocationPointLike[] {
  if (points.length <= maxPoints) {
    return [...points];
  }
  const step = (points.length - 1) / (maxPoints - 1);
  const result: LocationPointLike[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const index = Math.min(points.length - 1, Math.round(i * step));
    result.push(points[index]!);
  }
  return result;
}
