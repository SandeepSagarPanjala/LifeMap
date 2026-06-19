import type {ParsedPoint} from '../types';
import type {DriveSegment} from './trips';

/** Perpendicular distance threshold for straight / gentle curve segments. */
export const DRIVE_DOUGLAS_PEUCKER_EPSILON_M = 15;

/** Keep vertices where heading change exceeds this (turns, U-turns, ramps). */
export const DRIVE_MIN_TURN_BEARING_DEG = 25;

/** Skip simplification for very short drives. */
export const DRIVE_MIN_POINTS_TO_SIMPLIFY = 30;

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

/** Interior indices where the route bends sharply — never dropped. */
export function findTurnAnchorIndices(
  points: readonly ParsedPoint[],
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
export function canonicalizeTravelPoints(
  points: readonly ParsedPoint[],
  options: {
    epsilonM?: number;
    minTurnDeg?: number;
    minPointsToSimplify?: number;
  } = {},
): ParsedPoint[] {
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

  const byId = new Map<number, ParsedPoint>();
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

export function canonicalizeTravelSegmentPoints(segment: DriveSegment): ParsedPoint[] {
  return canonicalizeTravelPoints(segment.points);
}
