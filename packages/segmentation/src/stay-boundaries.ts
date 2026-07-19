import {
  DEFAULT_STOP_DETECTION_CONFIG,
  STAY_BOUNDARY_LOOKBACK_M,
  STAY_BOUNDARY_LOOKBACK_MS,
  STAY_BOUNDARY_OUTBOUND_RADIUS_FRACTION,
  TRAVEL_MODE_ACTIVITY_CONFIDENCE_MIN,
} from '@lifemap/constants';
import {
  isFootMotionActivity,
  isWheeledMotionActivity,
  normalizeMotionActivity,
} from './activity';
import { distanceMeters } from './geo';
import type { Stop, StopDetectionConfig } from './stops';
import type { ParsedPoint } from './types';

const DEFAULT_CONFIG: StopDetectionConfig = {
  ...DEFAULT_STOP_DETECTION_CONFIG,
};

function isConfident(
  point: ParsedPoint,
  minConfidence = TRAVEL_MODE_ACTIVITY_CONFIDENCE_MIN,
): boolean {
  return (
    point.activityConfidence != null &&
    point.activityConfidence >= minConfidence
  );
}

function isConfidentFoot(point: ParsedPoint): boolean {
  const activity = normalizeMotionActivity(point.activityType);
  return isConfident(point) && isFootMotionActivity(activity);
}

function isConfidentWheeled(point: ParsedPoint): boolean {
  const activity = normalizeMotionActivity(point.activityType);
  return isConfident(point) && isWheeledMotionActivity(activity);
}

function isConfidentStill(point: ParsedPoint): boolean {
  return isConfident(point) && normalizeMotionActivity(point.activityType) === 'still';
}

function isUnknownActivity(point: ParsedPoint): boolean {
  const activity = normalizeMotionActivity(point.activityType);
  return activity === 'unknown' || activity == null;
}

function isFastPoint(
  point: ParsedPoint,
  config: StopDetectionConfig,
): boolean {
  if (point.speed != null) {
    return point.speed >= config.movingSpeedMps;
  }
  // Missing speed: confident wheeled still counts as driving approach.
  return isConfidentWheeled(point);
}

function isParkedSpeed(
  point: ParsedPoint,
  config: StopDetectionConfig,
): boolean {
  return point.speed == null || point.speed < config.movingSpeedMps;
}

/**
 * Core from the earlier stay body so departure tails do not pull the centre.
 * Uses the first ~70% of the cluster (skip a small arrival head on long stays).
 */
export function stayCoreCenter(
  cluster: readonly ParsedPoint[],
): { lat: number; lng: number } {
  if (cluster.length === 0) {
    return { lat: 0, lng: 0 };
  }
  if (cluster.length <= 3) {
    const lat = cluster.reduce((sum, p) => sum + p.lat, 0) / cluster.length;
    const lng = cluster.reduce((sum, p) => sum + p.lng, 0) / cluster.length;
    return { lat, lng };
  }
  const hi = Math.max(2, Math.floor(cluster.length * 0.7));
  const lo = Math.min(Math.floor(hi * 0.15), hi - 1);
  const body = cluster.slice(lo, hi);
  const lat = body.reduce((sum, p) => sum + p.lat, 0) / body.length;
  const lng = body.reduce((sum, p) => sum + p.lng, 0) / body.length;
  return { lat, lng };
}

function lookbackStartIndex(
  points: readonly ParsedPoint[],
  geoStartIdx: number,
  core: { lat: number; lng: number },
): number {
  const anchor = points[geoStartIdx]!;
  let lo = geoStartIdx;
  while (lo > 0) {
    const prev = points[lo - 1]!;
    const dt = anchor.at.getTime() - prev.at.getTime();
    if (dt > STAY_BOUNDARY_LOOKBACK_MS) {
      break;
    }
    const toCore = distanceMeters(prev, core);
    const toAnchor = distanceMeters(prev, anchor);
    if (toCore > STAY_BOUNDARY_LOOKBACK_M && toAnchor > STAY_BOUNDARY_LOOKBACK_M) {
      break;
    }
    lo -= 1;
  }
  return lo;
}

/**
 * Preferred start: first confident foot near arrival, then look back to parked
 * vehicle (Ex1) or first point after vehicle (Ex2).
 */
function activityStartIndex(
  points: readonly ParsedPoint[],
  geoStartIdx: number,
  geoEndIdx: number,
  core: { lat: number; lng: number },
  config: StopDetectionConfig,
): number | null {
  const lo = lookbackStartIndex(points, geoStartIdx, core);
  const hi = Math.min(geoEndIdx, geoStartIdx + 12);
  let firstFoot = -1;
  for (let i = lo; i <= hi; i += 1) {
    if (isConfidentFoot(points[i]!)) {
      firstFoot = i;
      break;
    }
  }
  if (firstFoot < 0) {
    return null;
  }

  let lastWheeled = -1;
  for (let i = firstFoot - 1; i >= lo; i -= 1) {
    if (isConfidentWheeled(points[i]!)) {
      lastWheeled = i;
      break;
    }
    // Stop walking back through another foot burst.
    if (isConfidentFoot(points[i]!)) {
      break;
    }
  }
  if (lastWheeled < 0) {
    return null;
  }

  // Ex1: vehicle immediately before foot → parked vehicle is start.
  if (lastWheeled === firstFoot - 1) {
    const vehicle = points[lastWheeled]!;
    if (isParkedSpeed(vehicle, config)) {
      return lastWheeled;
    }
    return firstFoot;
  }

  // Ex2: bridge between vehicle and foot → first point after vehicle.
  return lastWheeled + 1;
}

/**
 * Fallback start: after last fast approach, last slowed park point before the
 * geometric stay start.
 */
function fallbackStartIndex(
  points: readonly ParsedPoint[],
  geoStartIdx: number,
  core: { lat: number; lng: number },
  config: StopDetectionConfig,
): number {
  const lo = lookbackStartIndex(points, geoStartIdx, core);
  let lastFast = -1;
  for (let i = lo; i < geoStartIdx; i += 1) {
    if (isFastPoint(points[i]!, config)) {
      lastFast = i;
    }
  }
  if (lastFast < 0) {
    return geoStartIdx;
  }
  let park = -1;
  for (let i = lastFast + 1; i < geoStartIdx; i += 1) {
    if (!isFastPoint(points[i]!, config)) {
      park = i;
    }
  }
  return park >= 0 ? park : geoStartIdx;
}

/**
 * Preferred end: last confident foot in the window; include following still.
 */
function activityEndIndex(
  points: readonly ParsedPoint[],
  startIdx: number,
  geoEndIdx: number,
): number | null {
  let lastFoot = -1;
  for (let i = startIdx; i <= geoEndIdx; i += 1) {
    if (isConfidentFoot(points[i]!)) {
      lastFoot = i;
    }
  }
  if (lastFoot < 0) {
    return null;
  }
  if (lastFoot + 1 < points.length && isConfidentStill(points[lastFoot + 1]!)) {
    const still = points[lastFoot + 1]!;
    const foot = points[lastFoot]!;
    const dt = still.at.getTime() - foot.at.getTime();
    // Prefer still when it sits in/just after the geometric window.
    if (lastFoot + 1 <= geoEndIdx || dt <= 5 * 60_000) {
      return lastFoot + 1;
    }
  }
  return lastFoot;
}

/**
 * Fallback end: trim outbound / pre-drive bridge points using core distance.
 */
function fallbackEndIndex(
  points: readonly ParsedPoint[],
  startIdx: number,
  geoEndIdx: number,
  core: { lat: number; lng: number },
  config: StopDetectionConfig,
): number {
  let end = geoEndIdx;
  const outboundM = config.radiusM * STAY_BOUNDARY_OUTBOUND_RADIUS_FRACTION;

  // Trim leave-bridge points immediately before a fast departure — but never
  // peel settled core points (null-activity Home stays).
  while (end > startIdx && end + 1 < points.length) {
    const next = points[end + 1]!;
    if (!isFastPoint(next, config)) {
      break;
    }
    const p = points[end]!;
    const d = distanceMeters(p, core);
    if (d <= outboundM && isParkedSpeed(p, config)) {
      // Settled at/near core — keep as stay end (Home, store still).
      if (
        isConfidentStill(p) ||
        p.speed == null ||
        p.speed < 0.5 ||
        !isUnknownActivity(p)
      ) {
        break;
      }
    }
    if (isUnknownActivity(p) && d > outboundM * 0.5) {
      end -= 1;
      continue;
    }
    if (d > outboundM) {
      end -= 1;
      continue;
    }
    break;
  }

  // Trim monotonic outbound tail away from the core.
  while (end > startIdx) {
    const d = distanceMeters(points[end]!, core);
    if (d <= outboundM) {
      break;
    }
    const prevD = distanceMeters(points[end - 1]!, core);
    if (d > prevD + 8) {
      end -= 1;
      continue;
    }
    // Far from core and next is fast — drop.
    if (end + 1 < points.length && isFastPoint(points[end + 1]!, config)) {
      end -= 1;
      continue;
    }
    break;
  }

  return end;
}

function rebuildStop(
  points: readonly ParsedPoint[],
  startIdx: number,
  endIdx: number,
  prior: Stop,
  config: StopDetectionConfig,
): Stop {
  const cluster = points.slice(startIdx, endIdx + 1);
  if (cluster.length === 0) {
    return prior;
  }
  const core = stayCoreCenter(cluster);
  const arrivedAt = cluster[0]!.at;
  const leftAt = cluster[cluster.length - 1]!.at;
  const durationMs = leftAt.getTime() - arrivedAt.getTime();
  if (durationMs < config.minDwellMs) {
    return prior;
  }
  let spreadM = 0;
  for (const point of cluster) {
    spreadM = Math.max(spreadM, distanceMeters(point, core));
  }
  return {
    ...prior,
    id: prior.inferred
      ? `stop-${cluster[0]!.id}-inferred-${cluster[cluster.length - 1]!.id}`
      : `stop-${cluster[0]!.id}`,
    lat: core.lat,
    lng: core.lng,
    arrivedAt,
    leftAt,
    durationMs,
    pointCount: cluster.length,
    spreadM,
    pointIds: cluster.map(point => point.id),
  };
}

/**
 * Snap stay start/end: activity preferred, speed/core fallback.
 * Geometry still decided the stay exists; this only fixes edges.
 */
export function refineStopBoundaries(
  stop: Stop,
  points: readonly ParsedPoint[],
  config: StopDetectionConfig = DEFAULT_CONFIG,
): Stop {
  if (stop.pointIds.length === 0 || points.length === 0) {
    return stop;
  }
  const idxById = new Map<number, number>();
  points.forEach((point, index) => idxById.set(point.id, index));

  const geoStartIdx = idxById.get(stop.pointIds[0]!);
  const geoEndIdx = idxById.get(stop.pointIds[stop.pointIds.length - 1]!);
  if (geoStartIdx == null || geoEndIdx == null || geoEndIdx < geoStartIdx) {
    return stop;
  }

  const geoCluster = points.slice(geoStartIdx, geoEndIdx + 1);
  const core = stayCoreCenter(geoCluster);

  const activityStart = activityStartIndex(
    points,
    geoStartIdx,
    geoEndIdx,
    core,
    config,
  );
  const startIdx =
    activityStart ??
    fallbackStartIndex(points, geoStartIdx, core, config);

  const activityEnd = activityEndIndex(points, startIdx, geoEndIdx);
  const endIdx =
    activityEnd ??
    fallbackEndIndex(points, startIdx, geoEndIdx, core, config);

  if (endIdx < startIdx) {
    return stop;
  }
  return rebuildStop(points, startIdx, endIdx, stop, config);
}

/** Refine all stops, then clamp so ranges stay chronological and non-overlapping. */
export function refineAllStopBoundaries(
  stops: readonly Stop[],
  points: readonly ParsedPoint[],
  config: StopDetectionConfig = DEFAULT_CONFIG,
): Stop[] {
  if (stops.length === 0) {
    return [];
  }
  const idxById = new Map<number, number>();
  points.forEach((point, index) => idxById.set(point.id, index));

  const refined = stops.map(stop => refineStopBoundaries(stop, points, config));
  refined.sort(
    (a, b) => a.arrivedAt.getTime() - b.arrivedAt.getTime() || a.pointIds[0]! - b.pointIds[0]!,
  );

  const result: Stop[] = [];
  for (const stop of refined) {
    const startIdx = idxById.get(stop.pointIds[0]!);
    const endIdx = idxById.get(stop.pointIds[stop.pointIds.length - 1]!);
    if (startIdx == null || endIdx == null) {
      continue;
    }
    let lo = startIdx;
    let hi = endIdx;
    if (result.length > 0) {
      const prev = result[result.length - 1]!;
      const prevEnd = idxById.get(prev.pointIds[prev.pointIds.length - 1]!);
      if (prevEnd != null && lo <= prevEnd) {
        lo = prevEnd + 1;
      }
    }
    if (hi < lo) {
      continue;
    }
    result.push(rebuildStop(points, lo, hi, stop, config));
  }
  return result;
}
