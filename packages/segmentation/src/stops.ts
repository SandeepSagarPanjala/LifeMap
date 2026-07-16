import {
  DEFAULT_STOP_DETECTION_CONFIG,
  TRAVEL_MODE_ACTIVITY_CONFIDENCE_MIN,
  TRAVEL_MODE_DASH_MIN_PATH_M,
} from '@lifemap/constants';
import {
  isFootMotionActivity,
  isWheeledMotionActivity,
  normalizeMotionActivity,
} from './activity';
import { TRIP_PLOT_SOURCES } from './sources';
import type { ParsedPoint } from './types';

export type Stop = {
  id: string;
  lat: number;
  lng: number;
  arrivedAt: Date;
  leftAt: Date;
  durationMs: number;
  pointCount: number;
  spreadM: number;
  /** Point ids that formed this stop (for highlighting on the map). */
  pointIds: number[];
  /** True when inferred from a sparse GPS gap (time high, distance low). */
  inferred?: boolean;
};

export type StopDetectionConfig = {
  /** Max spread from the rolling centre to still count as the same stop. */
  radiusM: number;
  /** Minimum dwell to count as a real stop (shorter = absorbed into the drive). */
  minDwellMs: number;
  /** Drop fixes worse than this so a bad fix does not fake movement. */
  maxAccuracyM: number;
  /**
   * Speed (m/s) at or above which a point is treated as DRIVING and can never
   * belong to a stop. ~2 m/s ≈ 4.5 mph. A point with no speed (null) or a
   * negative/unknown reading is treated as stationary.
   */
  movingSpeedMps: number;
  /**
   * When consecutive fixes are farther apart than this, a stay can still
   * continue if the next fix is within `sparseBridgeMaxDistanceM` of the
   * cluster centre (sparse GPS while genuinely on site).
   */
  sparseBridgeMinGapMs: number;
  /** Max centre→fix distance allowed when bridging a sparse gap. */
  sparseBridgeMaxDistanceM: number;
  /**
   * Brief moving bursts (e.g. walking to the car) that return to the same
   * spot within this window are absorbed into the stay.
   */
  movingBurstReturnMaxMs: number;
};

export const DEFAULT_STOP_CONFIG: StopDetectionConfig = {
  ...DEFAULT_STOP_DETECTION_CONFIG,
};

function canSparseBridge(
  centre: { lat: number; lng: number },
  anchor: ParsedPoint,
  next: ParsedPoint,
  config: StopDetectionConfig,
): boolean {
  const gapMs = next.at.getTime() - anchor.at.getTime();
  if (gapMs < config.minDwellMs) {
    return false;
  }
  const toCentre = haversineM(centre, next);
  const toAnchor = haversineM(anchor, next);
  return (
    toCentre <= config.sparseBridgeMaxDistanceM ||
    toAnchor <= config.sparseBridgeMaxDistanceM
  );
}

/**
 * If `startIdx` is moving, skip the burst when the next stationary fix returns
 * to the cluster within `movingBurstReturnMaxMs`.
 */
function findMovingBurstReturnIndex(
  points: ParsedPoint[],
  startIdx: number,
  centre: { lat: number; lng: number },
  config: StopDetectionConfig,
  spreadLimitM: number,
): number | null {
  if (!isMovingPoint(points[startIdx]!, config)) {
    return null;
  }
  let k = startIdx;
  while (k < points.length && isMovingPoint(points[k]!, config)) {
    k += 1;
  }
  if (k >= points.length) {
    return null;
  }
  const burstStart = points[startIdx]!;
  const next = points[k]!;
  const burstMs = next.at.getTime() - burstStart.at.getTime();
  if (burstMs > config.movingBurstReturnMaxMs) {
    return null;
  }
  // Meaningful on-foot bursts (parking → door) are real travel, not stay jitter.
  if (footPathLengthM(points, startIdx, k) >= TRAVEL_MODE_DASH_MIN_PATH_M) {
    return null;
  }
  if (haversineM(centre, next) <= spreadLimitM) {
    return k;
  }
  return null;
}

function footPathLengthM(
  points: ParsedPoint[],
  startIdx: number,
  endIdxExclusive: number,
): number {
  let pathM = 0;
  for (let i = startIdx; i < endIdxExclusive - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const activity = normalizeMotionActivity(a.activityType);
    if (!isFootMotionActivity(activity)) {
      continue;
    }
    pathM += haversineM(a, b);
  }
  return pathM;
}

function pushStop(
  stops: Stop[],
  cluster: ParsedPoint[],
  centre: { lat: number; lng: number },
  leftAt: Date,
  config: StopDetectionConfig,
  inferred = false,
): void {
  if (cluster.length === 0) {
    return;
  }
  const arrivedAt = cluster[0]!.at;
  const durationMs = leftAt.getTime() - arrivedAt.getTime();
  if (durationMs < config.minDwellMs) {
    return;
  }
  stops.push({
    id: inferred
      ? `stop-${cluster[0]!.id}-inferred-${cluster[cluster.length - 1]!.id}`
      : `stop-${cluster[0]!.id}`,
    lat: centre.lat,
    lng: centre.lng,
    arrivedAt,
    leftAt,
    durationMs,
    pointCount: cluster.length,
    spreadM: maxSpreadM(cluster, centre),
    pointIds: cluster.map(point => point.id),
    inferred: inferred || undefined,
  });
}

function inferSparseGapStop(
  cluster: ParsedPoint[],
  nextPoint: ParsedPoint,
  config: StopDetectionConfig,
): Stop | null {
  const anchor = cluster[cluster.length - 1]!;
  const gapMs = nextPoint.at.getTime() - anchor.at.getTime();
  if (gapMs < config.minDwellMs) {
    return null;
  }
  if (haversineM(anchor, nextPoint) > config.radiusM) {
    return null;
  }
  const arrivedAt = cluster[0]!.at;
  // Stay ends on the last cluster GPS — the moving point belongs to the drive.
  // Drive construction shares that last stay point as its start vertex.
  const leftAt = anchor.at;
  const durationMs = leftAt.getTime() - arrivedAt.getTime();
  if (durationMs < config.minDwellMs) {
    return null;
  }
  const centre = {
    lat: cluster.reduce((sum, p) => sum + p.lat, 0) / cluster.length,
    lng: cluster.reduce((sum, p) => sum + p.lng, 0) / cluster.length,
  };
  return {
    id: `stop-${cluster[0]!.id}-inferred-${nextPoint.id}`,
    lat: centre.lat,
    lng: centre.lng,
    arrivedAt,
    leftAt,
    durationMs,
    pointCount: cluster.length,
    spreadM: maxSpreadM(cluster, centre),
    pointIds: cluster.map(point => point.id),
    inferred: true,
  };
}

/**
 * Moving = evidence of travel. Prefers SDK activity / is_moving when confident;
 * falls back to GPS speed. High-confidence `still` is never moving.
 *
 * Bare `isMoving: true` is not enough when activity is still/unknown/missing and
 * speed is low — indoor GPS often flips that flag during jitter, which would
 * prematurely end a stay and flash a fake drive until absorb can prove return.
 */
export function isMovingPoint(
  point: ParsedPoint,
  config: StopDetectionConfig = DEFAULT_STOP_CONFIG,
): boolean {
  const activity = normalizeMotionActivity(point.activityType);
  const confidence = point.activityConfidence;
  const confident =
    confidence != null && confidence >= TRAVEL_MODE_ACTIVITY_CONFIDENCE_MIN;

  if (activity === 'still' && confident) {
    return false;
  }
  if (
    confident &&
    (isFootMotionActivity(activity) || isWheeledMotionActivity(activity))
  ) {
    return true;
  }
  if (point.isMoving === true) {
    if (
      activity == null ||
      activity === 'unknown' ||
      activity === 'still'
    ) {
      return point.speed != null && point.speed >= config.movingSpeedMps;
    }
    return true;
  }
  if (point.isMoving === false && activity === 'still') {
    return false;
  }
  return point.speed != null && point.speed >= config.movingSpeedMps;
}

const EARTH_RADIUS_M = 6_371_000;

function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
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

/** Geometry sources used for the track; motion_arrival excluded. */
const TRIP_SOURCE_SET = new Set<string>(TRIP_PLOT_SOURCES);

/** Merge + clean points the same way trip detection will consume them. */
export function prepareTripPoints(
  points: ParsedPoint[],
  config: StopDetectionConfig = DEFAULT_STOP_CONFIG,
): ParsedPoint[] {
  const cleaned = points.filter(point => {
    if (!TRIP_SOURCE_SET.has(point.source)) {
      return false;
    }
    if (point.accuracy != null && point.accuracy > config.maxAccuracyM) {
      return false;
    }
    return true;
  });

  cleaned.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id);

  // Collapse shadow pairs (same instant + same coordinates).
  const deduped: ParsedPoint[] = [];
  let prev: ParsedPoint | null = null;
  for (const point of cleaned) {
    if (
      prev != null &&
      prev.at.getTime() === point.at.getTime() &&
      prev.lat === point.lat &&
      prev.lng === point.lng
    ) {
      continue;
    }
    deduped.push(point);
    prev = point;
  }
  return deduped;
}

function maxSpreadM(
  points: ParsedPoint[],
  centre: { lat: number; lng: number },
): number {
  let max = 0;
  for (const point of points) {
    const d = haversineM(centre, point);
    if (d > max) {
      max = d;
    }
  }
  return max;
}

/**
 * Stay-first detection: a stop is a maximal run of points staying within
 * `radiusM` of the run's rolling centre, lasting at least `minDwellMs`.
 * Runs shorter than the dwell are absorbed into the surrounding drive.
 */
export function detectStops(
  rawPoints: ParsedPoint[],
  config: StopDetectionConfig = DEFAULT_STOP_CONFIG,
): Stop[] {
  const points = prepareTripPoints(rawPoints, config);
  const stops: Stop[] = [];
  const n = points.length;
  let i = 0;

  while (i < n) {
    // Skip points that are clearly driving — they belong to the drive, not a
    // stop, even if they pass within the radius of where you eventually parked.
    if (isMovingPoint(points[i]!, config)) {
      i += 1;
      continue;
    }

    const cluster: ParsedPoint[] = [points[i]!];
    // Incremental centroid via running sums, plus a maintained upper bound on
    // the spread, so each candidate is O(1) in the common case. We only fall
    // back to an exact O(k) spread scan on the rare boundary case. This keeps
    // detection linear even for one huge continuous stay (thousands of fixes
    // in the same spot), which would otherwise be O(k²).
    let sumLat = points[i]!.lat;
    let sumLng = points[i]!.lng;
    let count = 1;
    let centre = { lat: points[i]!.lat, lng: points[i]!.lng };
    let maxBound = 0;
    let sparseAnchored = false;
    let j = i + 1;
    let departureAt: Date | null = null;
    let handled = false;

    while (j < n) {
      const candidate = points[j]!;

      if (isMovingPoint(candidate, config)) {
        const spreadLimit = sparseAnchored
          ? config.sparseBridgeMaxDistanceM
          : config.radiusM;
        const returnIdx = findMovingBurstReturnIndex(
          points,
          j,
          centre,
          config,
          spreadLimit,
        );
        if (returnIdx != null) {
          j = returnIdx;
          continue;
        }
        const inferred = inferSparseGapStop(cluster, candidate, config);
        if (inferred != null) {
          stops.push(inferred);
          handled = true;
          break;
        }
        departureAt = candidate.at;
        break;
      }

      const anchor = cluster[cluster.length - 1]!;
      const gapMs = candidate.at.getTime() - anchor.at.getTime();
      const sparseGap = gapMs > config.sparseBridgeMinGapMs;

      if (sparseGap) {
        if (!canSparseBridge(centre, anchor, candidate, config)) {
          break;
        }
        sparseAnchored = true;
      } else if (
        !sparseAnchored &&
        haversineM(centre, candidate) > config.radiusM
      ) {
        break;
      }

      const nextCentre = {
        lat: (sumLat + candidate.lat) / (count + 1),
        lng: (sumLng + candidate.lng) / (count + 1),
      };

      const spreadLimit = sparseAnchored
        ? config.sparseBridgeMaxDistanceM
        : config.radiusM;

      if (!sparseGap && !sparseAnchored) {
        const delta = haversineM(centre, nextCentre);
        const candDist = haversineM(nextCentre, candidate);
        const spreadBound = Math.max(maxBound + delta, candDist);

        let nextMax = spreadBound;
        if (spreadBound > spreadLimit) {
          const exact = Math.max(maxSpreadM(cluster, nextCentre), candDist);
          if (exact > spreadLimit) {
            break;
          }
          nextMax = exact;
        }
        maxBound = nextMax;
      } else {
        const exact = maxSpreadM([...cluster, candidate], nextCentre);
        if (exact > spreadLimit) {
          break;
        }
        maxBound = exact;
      }

      cluster.push(candidate);
      sumLat += candidate.lat;
      sumLng += candidate.lng;
      count += 1;
      centre = nextCentre;
      j += 1;
    }

    if (handled) {
      i = j + 1;
      continue;
    }

    if (cluster.length > 0 && (j > i + 1 || departureAt != null)) {
      // Stay end = last cluster GPS. Moving departure time must not extend
      // leftAt past that point — trailing drive starts on the same vertex.
      const leftAt = cluster[cluster.length - 1]!.at;
      pushStop(stops, cluster, centre, leftAt, config, departureAt != null);
      i = departureAt != null ? j + 1 : j;
    } else {
      i += 1;
    }
  }

  return stops;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) {
    return `${totalMin} min`;
  }
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return min === 0 ? `${hours} hr` : `${hours} hr ${min} min`;
}
