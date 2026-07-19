import {
  DEFAULT_STOP_DETECTION_CONFIG,
  TRAVEL_MODE_ACTIVITY_CONFIDENCE_MIN,
} from '@lifemap/constants';

import {
  isFootMotionActivity,
  isWheeledMotionActivity,
  normalizeMotionActivity,
} from './activity';

/** Solid = drive / unknown; dashed = closed on-foot walk within a drive. */
export type TravelModeStyle = 'solid' | 'dashed';

/**
 * Walk dashes apply only to drive paths — never to stay geometry.
 * Stay callers should pass `pathKind: 'stay'` (always solid).
 */
export type TravelModePathKind = 'drive' | 'stay';

export type TravelModePoint = {
  id: number;
  activityType?: string | null;
  activityConfidence?: number | null;
  speed?: number | null;
};

export type TravelModePointRun<T extends TravelModePoint> = {
  style: TravelModeStyle;
  /** Inclusive chronological slice; adjacent runs share the boundary point. */
  points: T[];
};

export type SplitTravelModeRunsOptions = {
  /**
   * Speeds above this end a walk (m/s). Defaults to stop movingSpeed + 0.5 so
   * brisk walking stays dashed while vehicle hops terminate.
   */
  maxWalkSpeedMps?: number;
  minActivityConfidence?: number;
  /**
   * `drive` (default): closed on-foot spans may be dashed.
   * `stay`: always a single solid path — never dash walks inside a visit.
   */
  pathKind?: TravelModePathKind;
};

function pointTimeMs(point: {
  at?: Date;
  timestamp?: Date;
}): number {
  const value = point.at ?? point.timestamp;
  return value instanceof Date ? value.getTime() : 0;
}

function isConfidentFoot(
  point: TravelModePoint,
  minConfidence: number,
): boolean {
  const activity = normalizeMotionActivity(point.activityType);
  if (!isFootMotionActivity(activity)) {
    return false;
  }
  const confidence = point.activityConfidence;
  return confidence == null || confidence >= minConfidence;
}

function isWalkTerminator(
  point: TravelModePoint,
  maxWalkSpeedMps: number,
): boolean {
  const activity = normalizeMotionActivity(point.activityType);
  if (isWheeledMotionActivity(activity)) {
    return true;
  }
  const speed = point.speed;
  return speed != null && Number.isFinite(speed) && speed > maxWalkSpeedMps;
}

/**
 * Points that may continue a walk after a confident foot start: foot, still,
 * unknown, or missing activity — until vehicle / non-walk speed.
 * Trailing still/unknown after the last foot are trimmed off the dashed span.
 */
function isWalkCompatible(
  point: TravelModePoint,
  maxWalkSpeedMps: number,
): boolean {
  if (isWalkTerminator(point, maxWalkSpeedMps)) {
    return false;
  }
  const speed = point.speed;
  if (speed != null && Number.isFinite(speed) && speed > maxWalkSpeedMps) {
    return false;
  }
  const activity = normalizeMotionActivity(point.activityType);
  if (activity == null || activity === 'unknown' || activity === 'still') {
    return true;
  }
  return isFootMotionActivity(activity);
}

/** Last confident foot in [fromInclusive, toInclusive]; -1 if none. */
function lastConfidentFootIndex<T extends TravelModePoint>(
  sorted: readonly T[],
  fromInclusive: number,
  toInclusive: number,
  minConfidence: number,
): number {
  for (let index = toInclusive; index >= fromInclusive; index -= 1) {
    if (isConfidentFoot(sorted[index]!, minConfidence)) {
      return index;
    }
  }
  return -1;
}

function pushRun<T extends TravelModePoint>(
  runs: TravelModePointRun<T>[],
  style: TravelModeStyle,
  sorted: readonly T[],
  fromInclusive: number,
  toInclusive: number,
): void {
  if (toInclusive - fromInclusive < 1) {
    return;
  }
  runs.push({
    style,
    points: sorted.slice(fromInclusive, toInclusive + 1),
  });
}

function solidOnlyRun<T extends TravelModePoint>(
  points: readonly T[],
): TravelModePointRun<T>[] {
  if (points.length < 2) {
    return points.length === 1
      ? [{ style: 'solid', points: [...points] }]
      : [];
  }
  const sorted = [...points].sort(
    (a, b) =>
      pointTimeMs(a as { at?: Date; timestamp?: Date }) -
        pointTimeMs(b as { at?: Date; timestamp?: Date }) || a.id - b.id,
  );
  return [{ style: 'solid', points: sorted }];
}

/**
 * Split a **drive** path into solid and dashed runs.
 *
 * Dashed only when a walk has a proper start (confident on_foot / walk / run)
 * and a proper end (vehicle / bicycle, speed above walk, or end of this drive).
 * Unknown/still between feet stay dashed; trailing still/unknown after the last
 * foot (e.g. parked idle before drive resumes) are not dashed.
 *
 * Pass `pathKind: 'stay'` to force a single solid path (never dash inside visits).
 */
export function splitTravelModeRuns<T extends TravelModePoint>(
  points: readonly T[],
  options: SplitTravelModeRunsOptions = {},
): TravelModePointRun<T>[] {
  if (options.pathKind === 'stay') {
    return solidOnlyRun(points);
  }

  if (points.length < 2) {
    return points.length === 1
      ? [{ style: 'solid', points: [...points] }]
      : [];
  }

  const sorted = [...points].sort(
    (a, b) =>
      pointTimeMs(a as { at?: Date; timestamp?: Date }) -
        pointTimeMs(b as { at?: Date; timestamp?: Date }) || a.id - b.id,
  );

  const maxWalkSpeedMps =
    options.maxWalkSpeedMps ??
    DEFAULT_STOP_DETECTION_CONFIG.movingSpeedMps + 0.5;
  const minConfidence =
    options.minActivityConfidence ?? TRAVEL_MODE_ACTIVITY_CONFIDENCE_MIN;

  const runs: TravelModePointRun<T>[] = [];
  let solidStart = 0;
  let cursor = 0;

  while (cursor < sorted.length) {
    let footIndex = -1;
    for (let index = cursor; index < sorted.length; index += 1) {
      if (isConfidentFoot(sorted[index]!, minConfidence)) {
        footIndex = index;
        break;
      }
    }

    if (footIndex < 0) {
      break;
    }

    // Include the prior point (often last vehicle) so the walk starts at the
    // vehicle→foot handoff vertex.
    let walkStart = footIndex > 0 ? footIndex - 1 : footIndex;
    walkStart = Math.max(walkStart, solidStart);

    let walkEnd = footIndex;
    let terminatorIndex = -1;
    for (let index = footIndex + 1; index < sorted.length; index += 1) {
      const point = sorted[index]!;
      if (isWalkTerminator(point, maxWalkSpeedMps)) {
        terminatorIndex = index;
        break;
      }
      if (isWalkCompatible(point, maxWalkSpeedMps)) {
        walkEnd = index;
        continue;
      }
      break;
    }

    const properEnd =
      terminatorIndex >= 0 || walkEnd === sorted.length - 1;
    if (properEnd && walkEnd > walkStart) {
      // Drop trailing still/unknown — dashed ends on last on_foot / walk / run.
      const lastFoot = lastConfidentFootIndex(
        sorted,
        walkStart,
        walkEnd,
        minConfidence,
      );
      if (lastFoot >= 0) {
        walkEnd = Math.max(lastFoot, walkStart);
      }

      if (walkEnd > walkStart) {
        if (walkStart > solidStart) {
          pushRun(runs, 'solid', sorted, solidStart, walkStart);
        }
        pushRun(runs, 'dashed', sorted, walkStart, walkEnd);
        solidStart = walkEnd;
        cursor = walkEnd + 1;
        continue;
      }
    }

    // Incomplete walk — keep solid; skip past this foot cluster.
    cursor = walkEnd + 1;
  }

  if (sorted.length - 1 > solidStart) {
    pushRun(runs, 'solid', sorted, solidStart, sorted.length - 1);
  } else if (runs.length === 0) {
    pushRun(runs, 'solid', sorted, 0, sorted.length - 1);
  }

  return runs;
}
