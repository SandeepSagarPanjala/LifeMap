import type {MomentRow} from '@/db/repositories/moments';

import type {ParsedPoint} from './types';
import type {StaySegment, TripSegment} from './trips';
import {pathLengthM} from './trips';
import {canonicalizeTravelSegmentPoints} from './travel-geometry';

/** Turn-in faster than this stays on the drive; slower = parked (visit starts). */
const VISIT_ARRIVAL_SPEED_MS = 2;

/** Compact food/charger stops — skip in-area paths (visit zone is enough). */
export const MIN_VISIT_IN_AREA_SPREAD_M = 100;
export const MIN_VISIT_IN_AREA_PATH_M = 120;

const VENUE_DOUGLAS_PEUCKER_EPSILON_M = 20;

const EARTH_RADIUS_M = 6_371_000;

function haversineM(
  a: {lat: number; lng: number},
  b: {lat: number; lng: number},
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function sortedPoints(points: ParsedPoint[]): ParsedPoint[] {
  return [...points].sort(
    (a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id,
  );
}

function isStationarySave(point: ParsedPoint): boolean {
  return point.speed == null || point.speed <= VISIT_ARRIVAL_SPEED_MS;
}

function maxSpreadFromAnchorM(
  points: ParsedPoint[],
  anchorIndex: number,
  endIndex: number,
): number {
  const anchor = points[anchorIndex]!;
  let maxM = 0;
  for (let i = anchorIndex; i <= endIndex; i += 1) {
    maxM = Math.max(maxM, haversineM(anchor, points[i]!));
  }
  return maxM;
}

function findVisitArrivalIndex(
  points: ParsedPoint[],
  departureIndex: number,
): number {
  const roadPauseLookahead = 4;
  for (let index = 0; index <= departureIndex; index += 1) {
    if (!isStationarySave(points[index]!)) {
      continue;
    }
    const stillTurningIn = points
      .slice(
        index + 1,
        Math.min(index + 1 + roadPauseLookahead, departureIndex + 1),
      )
      .some(point => !isStationarySave(point));
    if (stillTurningIn) {
      continue;
    }
    return index;
  }
  return 0;
}

function findVisitDepartureEndIndex(points: ParsedPoint[]): number {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (isStationarySave(points[index]!)) {
      return index;
    }
  }
  return points.length - 1;
}

export function visitCorePoints(points: ParsedPoint[]): ParsedPoint[] {
  const sorted = sortedPoints(points);
  if (sorted.length === 0) {
    return [];
  }
  const departureIndex = findVisitDepartureEndIndex(sorted);
  const arrivalIndex = findVisitArrivalIndex(sorted, departureIndex);
  return sorted.slice(arrivalIndex, departureIndex + 1);
}

function closestPointTo(
  points: ParsedPoint[],
  target: {lat: number; lng: number},
): ParsedPoint | null {
  if (points.length === 0) {
    return null;
  }
  let best = points[0]!;
  let bestM = haversineM(best, target);
  for (let i = 1; i < points.length; i += 1) {
    const candidate = points[i]!;
    const distM = haversineM(candidate, target);
    if (distM < bestM) {
      best = candidate;
      bestM = distM;
    }
  }
  return best;
}

function farthestPointFrom(
  points: ParsedPoint[],
  anchor: {lat: number; lng: number},
  excludeIds: ReadonlySet<number>,
): ParsedPoint | null {
  let best: ParsedPoint | null = null;
  let bestM = -1;
  for (const point of points) {
    if (excludeIds.has(point.id)) {
      continue;
    }
    const distM = haversineM(anchor, point);
    if (distM > bestM) {
      best = point;
      bestM = distM;
    }
  }
  return best;
}

function pointLineDistanceM(
  point: ParsedPoint,
  lineStart: ParsedPoint,
  lineEnd: ParsedPoint,
): number {
  const total = haversineM(lineStart, lineEnd);
  if (total < 1) {
    return haversineM(point, lineStart);
  }
  const a = haversineM(lineStart, point);
  const b = haversineM(point, lineEnd);
  const s = (total + a + b) / 2;
  const area = Math.max(0, s * (s - total) * (s - a) * (s - b));
  return (2 * Math.sqrt(area)) / total;
}

function douglasPeucker(points: ParsedPoint[], epsilonM: number): ParsedPoint[] {
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
    const at = new Date(moment.timestamp).getTime();
    return at >= startMs && at <= endMs;
  });
}

function nearestPointForMoment(
  core: ParsedPoint[],
  moment: MomentRow,
): ParsedPoint | null {
  if (core.length === 0) {
    return null;
  }
  if (moment.lat != null && moment.lng != null) {
    return closestPointTo(core, {lat: moment.lat, lng: moment.lng});
  }
  const targetMs = new Date(moment.timestamp).getTime();
  let best = core[0]!;
  let bestDelta = Math.abs(best.at.getTime() - targetMs);
  for (let i = 1; i < core.length; i += 1) {
    const candidate = core[i]!;
    const delta = Math.abs(candidate.at.getTime() - targetMs);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return best;
}

export function shouldUseVenueWanderGeometry(segment: StaySegment): boolean {
  if (segment.savedPlaceLabel != null) {
    return false;
  }
  const core = visitCorePoints(segment.points);
  if (core.length < 3) {
    return false;
  }
  const spreadM = maxSpreadFromAnchorM(core, 0, core.length - 1);
  if (spreadM < MIN_VISIT_IN_AREA_SPREAD_M) {
    return false;
  }
  return pathLengthM(core) >= MIN_VISIT_IN_AREA_PATH_M;
}

function collectKeyPoints(
  keys: Array<ParsedPoint | null | undefined>,
): ParsedPoint[] {
  const byId = new Map<number, ParsedPoint>();
  for (const point of keys) {
    if (point != null) {
      byId.set(point.id, point);
    }
  }
  return sortedPoints([...byId.values()]);
}

export function canonicalizeStaySegmentPoints(
  segment: StaySegment,
  moments: readonly MomentRow[] = [],
): ParsedPoint[] {
  const core = visitCorePoints(segment.points);
  if (core.length === 0) {
    return [];
  }

  const arrival = core[0]!;
  const departure = core[core.length - 1]!;
  const centroid = closestPointTo(core, {
    lat: segment.stop.lat,
    lng: segment.stop.lng,
  });

  const stayMoments = momentsInStayWindow(
    moments,
    segment.startAt,
    segment.endAt,
  );
  const momentPoints = stayMoments
    .map(moment => nearestPointForMoment(core, moment))
    .filter((point): point is ParsedPoint => point != null);

  if (shouldUseVenueWanderGeometry(segment)) {
    const anchor = arrival;
    const simplified = douglasPeucker(core, VENUE_DOUGLAS_PEUCKER_EPSILON_M);
    const keepIds = new Set<number>([
      arrival.id,
      departure.id,
      ...(centroid != null ? [centroid.id] : []),
      ...momentPoints.map(point => point.id),
      ...simplified.map(point => point.id),
    ]);
    const extreme = farthestPointFrom(core, anchor, keepIds);
    return collectKeyPoints([
      arrival,
      departure,
      centroid,
      ...momentPoints,
      ...simplified,
      extreme,
    ]);
  }

  return collectKeyPoints([arrival, departure, centroid, ...momentPoints]);
}

export function displayPointsForSegment(
  segment: TripSegment,
  canonicalizeStays: boolean,
  moments: readonly MomentRow[] = [],
  canonicalizeDrives = false,
): ParsedPoint[] {
  if (segment.kind === 'missing') {
    return [];
  }
  if (segment.kind === 'stay' && canonicalizeStays) {
    return canonicalizeStaySegmentPoints(segment, moments);
  }
  if (segment.kind === 'drive' && canonicalizeDrives) {
    return canonicalizeTravelSegmentPoints(segment);
  }
  return segment.points;
}

export function plotPointsFromSegments(
  segments: readonly TripSegment[],
  canonicalizeStays: boolean,
  moments: readonly MomentRow[] = [],
  canonicalizeDrives = false,
): ParsedPoint[] {
  const byId = new Map<number, ParsedPoint>();
  for (const segment of segments) {
    for (const point of displayPointsForSegment(
      segment,
      canonicalizeStays,
      moments,
      canonicalizeDrives,
    )) {
      byId.set(point.id, point);
    }
  }
  return sortedPoints([...byId.values()]);
}

export function usesCanonicalSegmentGeometry(
  canonicalizeStays: boolean,
  canonicalizeDrives: boolean,
): boolean {
  return canonicalizeStays || canonicalizeDrives;
}
