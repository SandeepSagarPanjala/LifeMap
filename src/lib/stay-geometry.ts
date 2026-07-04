import type {MomentRow} from '@/db/repositories/moments';
import type {LocationPointRow} from '@/db/repositories/location-days';
import {calculatePathDistanceKm, distanceKm} from '@/lib/location-geo';
import type {DetectedTrip} from '@/lib/trip-detection';
import {visitCorePoints} from '@/lib/trip-detection';

import {
  MIN_VISIT_IN_AREA_PATH_M,
  MIN_VISIT_IN_AREA_SPREAD_M,
} from '@/lib/app-constants';

export {
  MIN_VISIT_IN_AREA_PATH_M,
  MIN_VISIT_IN_AREA_SPREAD_M,
};

const VENUE_DOUGLAS_PEUCKER_EPSILON_M = 20;

function sortedPoints(points: LocationPointRow[]): LocationPointRow[] {
  return [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.id - b.id,
  );
}

function maxSpreadFromAnchorM(
  points: LocationPointRow[],
  anchorIndex: number,
  endIndex: number,
): number {
  const anchor = points[anchorIndex]!;
  let maxM = 0;
  for (let i = anchorIndex; i <= endIndex; i += 1) {
    maxM = Math.max(maxM, distanceKm(anchor, points[i]!) * 1000);
  }
  return maxM;
}

function closestPointTo(
  points: LocationPointRow[],
  target: {lat: number; lng: number},
): LocationPointRow | null {
  if (points.length === 0) {
    return null;
  }
  let best = points[0]!;
  let bestM = distanceKm(best, target) * 1000;
  for (let i = 1; i < points.length; i += 1) {
    const candidate = points[i]!;
    const distM = distanceKm(candidate, target) * 1000;
    if (distM < bestM) {
      best = candidate;
      bestM = distM;
    }
  }
  return best;
}

function farthestPointFrom(
  points: LocationPointRow[],
  anchor: {lat: number; lng: number},
  excludeIds: ReadonlySet<number>,
): LocationPointRow | null {
  let best: LocationPointRow | null = null;
  let bestM = -1;
  for (const point of points) {
    if (excludeIds.has(point.id)) {
      continue;
    }
    const distM = distanceKm(anchor, point) * 1000;
    if (distM > bestM) {
      best = point;
      bestM = distM;
    }
  }
  return best;
}

function pointLineDistanceM(
  point: LocationPointRow,
  lineStart: LocationPointRow,
  lineEnd: LocationPointRow,
): number {
  const total = distanceKm(lineStart, lineEnd) * 1000;
  if (total < 1) {
    return distanceKm(point, lineStart) * 1000;
  }
  const a = distanceKm(lineStart, point) * 1000;
  const b = distanceKm(point, lineEnd) * 1000;
  const s = (total + a + b) / 2;
  const area = Math.max(0, s * (s - total) * (s - a) * (s - b));
  return (2 * Math.sqrt(area)) / total;
}

function douglasPeucker(
  points: LocationPointRow[],
  epsilonM: number,
): LocationPointRow[] {
  if (points.length <= 2) {
    return points;
  }
  const start = points[0]!;
  const end = points[points.length - 1]!;
  let maxDist = 0;
  let maxIndex = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const dist = pointLineDistanceM(points[i]!, start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }
  if (maxDist <= epsilonM) {
    return [start, end];
  }
  const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilonM);
  const right = douglasPeucker(points.slice(maxIndex), epsilonM);
  return [...left.slice(0, -1), ...right];
}

function momentsInStayWindow(
  moments: readonly MomentRow[],
  startAt: Date,
  endAt: Date,
): MomentRow[] {
  const startMs = startAt.getTime();
  const endMs = endAt.getTime();
  return moments.filter(moment => {
    const at = moment.timestamp.getTime();
    return at >= startMs && at <= endMs;
  });
}

function nearestPointForMoment(
  core: LocationPointRow[],
  moment: MomentRow,
): LocationPointRow | null {
  if (core.length === 0) {
    return null;
  }
  if (moment.lat != null && moment.lng != null) {
    return closestPointTo(core, {lat: moment.lat, lng: moment.lng});
  }
  const targetMs = moment.timestamp.getTime();
  let best = core[0]!;
  let bestDelta = Math.abs(best.timestamp.getTime() - targetMs);
  for (let i = 1; i < core.length; i += 1) {
    const candidate = core[i]!;
    const delta = Math.abs(candidate.timestamp.getTime() - targetMs);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return best;
}

function collectKeyPoints(
  keys: Array<LocationPointRow | null | undefined>,
): LocationPointRow[] {
  const byId = new Map<number, LocationPointRow>();
  for (const point of keys) {
    if (point != null) {
      byId.set(point.id, point);
    }
  }
  return sortedPoints([...byId.values()]);
}

export function shouldUseVenueWanderGeometry(stay: DetectedTrip): boolean {
  if (stay.kind !== 'stay') {
    return false;
  }
  if (stay.savedPlaceLabel != null || stay.savedPlaceId != null) {
    return false;
  }
  const core = visitCorePoints(stay);
  if (core.length < 3) {
    return false;
  }
  const spreadM = maxSpreadFromAnchorM(core, 0, core.length - 1);
  if (spreadM < MIN_VISIT_IN_AREA_SPREAD_M) {
    return false;
  }
  return calculatePathDistanceKm(core) * 1000 >= MIN_VISIT_IN_AREA_PATH_M;
}

/** Reduce stay GPS to canonical geometry for trip_points + map display. */
export function canonicalizeStayGeometry(
  stay: DetectedTrip,
  centroid: {lat: number; lng: number},
  moments: readonly MomentRow[] = [],
): LocationPointRow[] {
  if (stay.kind !== 'stay') {
    return stay.points;
  }

  const core = visitCorePoints(stay);
  if (core.length === 0) {
    return stay.points;
  }

  const arrival = core[0]!;
  const departure = core[core.length - 1]!;
  const centroidPoint = closestPointTo(core, centroid);
  const stayMoments = momentsInStayWindow(moments, stay.startAt, stay.endAt);
  const momentPoints = stayMoments
    .map(moment => nearestPointForMoment(core, moment))
    .filter((point): point is LocationPointRow => point != null);

  if (shouldUseVenueWanderGeometry(stay)) {
    const simplified = douglasPeucker(core, VENUE_DOUGLAS_PEUCKER_EPSILON_M);
    const keepIds = new Set<number>([
      arrival.id,
      departure.id,
      ...(centroidPoint != null ? [centroidPoint.id] : []),
      ...momentPoints.map(point => point.id),
      ...simplified.map(point => point.id),
    ]);
    const extreme = farthestPointFrom(core, arrival, keepIds);
    return collectKeyPoints([
      arrival,
      departure,
      centroidPoint,
      ...momentPoints,
      ...simplified,
      extreme,
    ]);
  }

  return collectKeyPoints([arrival, departure, centroidPoint, ...momentPoints]);
}
