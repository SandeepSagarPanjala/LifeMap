import type {LocationPointRow} from '@/db/repositories/location-days';
import type {MomentRow} from '@/db/repositories/moments';
import type {PersistTripPointInput} from '@/db/repositories/trip-points';
import {momentTimestampInSegment} from '@/lib/moment-refs';
import {distanceKm} from '@/lib/location-geo';

/** Perpendicular distance threshold for straight / gentle curve segments. */
export const DRIVE_DOUGLAS_PEUCKER_EPSILON_M = 15;

/** Keep vertices where heading change exceeds this (turns, U-turns, ramps). */
export const DRIVE_MIN_TURN_BEARING_DEG = 25;

/** Skip simplification for very short drives. */
export const DRIVE_MIN_POINTS_TO_SIMPLIFY = 30;

function sortedPoints(points: LocationPointRow[]): LocationPointRow[] {
  return [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.id - b.id,
  );
}

function bearingDegrees(
  a: {lat: number; lng: number},
  b: {lat: number; lng: number},
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function bearingChangeDegrees(fromDeg: number, toDeg: number): number {
  const delta = Math.abs(toDeg - fromDeg) % 360;
  return delta > 180 ? 360 - delta : delta;
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

/** Interior indices where the route bends sharply — never dropped. */
export function findTurnAnchorIndices(
  points: readonly LocationPointRow[],
  minTurnDeg = DRIVE_MIN_TURN_BEARING_DEG,
): number[] {
  if (points.length < 3) {
    return [];
  }
  const anchors: number[] = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const inbound = bearingDegrees(prev, current);
    const outbound = bearingDegrees(current, next);
    if (bearingChangeDegrees(inbound, outbound) >= minTurnDeg) {
      anchors.push(index);
    }
  }
  return anchors;
}

/** Turn-anchored Douglas–Peucker simplification for drive GPS. */
export function canonicalizeTravelGeometry(
  points: readonly LocationPointRow[],
  options: {
    epsilonM?: number;
    minTurnDeg?: number;
    minPointsToSimplify?: number;
  } = {},
): LocationPointRow[] {
  const epsilonM = options.epsilonM ?? DRIVE_DOUGLAS_PEUCKER_EPSILON_M;
  const minTurnDeg = options.minTurnDeg ?? DRIVE_MIN_TURN_BEARING_DEG;
  const minPointsToSimplify =
    options.minPointsToSimplify ?? DRIVE_MIN_POINTS_TO_SIMPLIFY;

  const sorted = sortedPoints([...points]);
  if (sorted.length <= minPointsToSimplify) {
    return sorted;
  }

  const anchorSet = new Set<number>([
    0,
    sorted.length - 1,
    ...findTurnAnchorIndices(sorted, minTurnDeg),
  ]);
  const anchors = [...anchorSet].sort((a, b) => a - b);

  const byId = new Map<number, LocationPointRow>();
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const startIndex = anchors[i]!;
    const endIndex = anchors[i + 1]!;
    const slice = sorted.slice(startIndex, endIndex + 1);
    for (const point of douglasPeucker(slice, epsilonM)) {
      byId.set(point.id, point);
    }
  }

  return sortedPoints([...byId.values()]);
}

function nearestPointByTimestamp(
  points: readonly LocationPointRow[],
  timestamp: Date,
): LocationPointRow | null {
  if (points.length === 0) {
    return null;
  }
  const targetMs = timestamp.getTime();
  let best = points[0]!;
  let bestDelta = Math.abs(best.timestamp.getTime() - targetMs);
  for (let index = 1; index < points.length; index += 1) {
    const candidate = points[index]!;
    const delta = Math.abs(candidate.timestamp.getTime() - targetMs);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return best;
}

function locationPointToPersist(
  point: LocationPointRow,
  momentId: number | null = null,
): PersistTripPointInput {
  return {
    lat: point.lat,
    lng: point.lng,
    recordedAt: point.timestamp,
    locationPointId: point.id > 0 ? point.id : null,
    source: point.source ?? 'gps',
    momentId,
  };
}

function sortPersistPoints(
  points: PersistTripPointInput[],
): PersistTripPointInput[] {
  return [...points].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime() || a.lat - b.lat,
  );
}

/** Drive canonical geometry with forced anchors for in-segment moments. */
export function canonicalizeTravelGeometryForPersist(
  points: readonly LocationPointRow[],
  moments: readonly MomentRow[],
  startAt: Date,
  endAt: Date,
  options: {
    epsilonM?: number;
    minTurnDeg?: number;
    minPointsToSimplify?: number;
    canonicalize?: boolean;
  } = {},
): PersistTripPointInput[] {
  const sorted = sortedPoints([...points]);
  if (sorted.length === 0) {
    return [];
  }

  const canonicalize = options.canonicalize ?? true;
  const simplified = canonicalize
    ? canonicalizeTravelGeometry(sorted, options)
    : sorted;
  const output = simplified.map(point => locationPointToPersist(point));
  const byLocationPointId = new Map<number, PersistTripPointInput>();
  for (const row of output) {
    if (row.locationPointId != null) {
      byLocationPointId.set(row.locationPointId, row);
    }
  }

  for (const moment of moments) {
    if (!momentTimestampInSegment(moment, startAt, endAt)) {
      continue;
    }
    const nearest = nearestPointByTimestamp(sorted, moment.timestamp);
    if (nearest == null) {
      continue;
    }
    const locationPointId = nearest.id > 0 ? nearest.id : null;
    const existing =
      locationPointId != null ? byLocationPointId.get(locationPointId) : undefined;
    if (existing != null) {
      if (existing.momentId == null) {
        existing.momentId = moment.id;
      } else if (existing.momentId !== moment.id) {
        output.push(locationPointToPersist(nearest, moment.id));
      }
      continue;
    }
    const forced = locationPointToPersist(nearest, moment.id);
    output.push(forced);
    if (locationPointId != null) {
      byLocationPointId.set(locationPointId, forced);
    }
  }

  return sortPersistPoints(output);
}
