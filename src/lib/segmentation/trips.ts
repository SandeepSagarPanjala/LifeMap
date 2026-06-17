import {
  addDaysToDateKey,
  dateKeyForTimestamp,
  dayEndExclusive,
  dayStart,
} from '@/lib/segmentation/day-bounds';
import {
  matchDriveEndSavedPlace,
  matchDriveStartSavedPlace,
  matchSavedPlaceForPoint,
  matchSavedPlaceForStop,
} from '@/lib/segmentation/saved-places';
import {
  DEFAULT_STOP_CONFIG,
  detectStops,
  isMovingPoint,
  prepareTripPoints,
  type Stop,
  type StopDetectionConfig,
} from '@/lib/segmentation/stops';
import type {ParsedPoint, SavedPlaceRow} from '@/lib/segmentation/types';

/**
 * A drive must show real movement. Stationary residue around a stay (e.g. a
 * trailing fix that could not fit the stay's radius) has no moving points and
 * ~0 m of travel, so it is not a real drive.
 */
export const MIN_DRIVE_DISTANCE_M = 30;
export const SAVED_PLACE_MIN_DWELL_MS = 5 * 60 * 1000;

/**
 * Two consecutive stays at the same place are merged into one continuous stay,
 * even with a long sparse-GPS gap between them.
 */
export const MERGE_STAY_MAX_DISTANCE_M = 200;

/**
 * A "missing" gap (phone off, no GPS) requires BOTH a meaningful distance and
 * time between segment boundaries — avoids false positives from brief dropouts.
 */
export const MISSING_MIN_DISTANCE_M = 500;
export const MISSING_MIN_GAP_MS = 15 * 60 * 1000;

export type StaySegment = {
  kind: 'stay';
  id: string;
  /** Position in the overall stay/drive sequence (1-based when displayed). */
  order: number;
  stop: Stop;
  startAt: Date;
  endAt: Date;
  durationMs: number;
  points: ParsedPoint[];
  /** Saved place label when the stay falls inside a user-defined place. */
  savedPlaceLabel?: string;
  savedPlaceId?: number;
};

export type DriveSegment = {
  kind: 'drive';
  id: string;
  order: number;
  startAt: Date;
  endAt: Date;
  durationMs: number;
  distanceM: number;
  points: ParsedPoint[];
  fromStop: Stop | null;
  toStop: Stop | null;
  fromSavedPlaceLabel?: string;
  fromSavedPlaceId?: number;
  toSavedPlaceLabel?: string;
  toSavedPlaceId?: number;
};

export type MissingSegment = {
  kind: 'missing';
  id: string;
  order: number;
  startAt: Date;
  endAt: Date;
  durationMs: number;
  /** Straight-line distance between where the previous segment ended and the next began. */
  distanceM: number;
  fromKind: 'stay' | 'drive';
  toKind: 'stay' | 'drive';
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  points: [];
};

export type TripSegment = StaySegment | DriveSegment | MissingSegment;

export type TripResult = {
  /** Cleaned/merged points the segments were built from. */
  points: ParsedPoint[];
  stops: Stop[];
  segments: TripSegment[];
};

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

function pathLengthM(points: ParsedPoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += haversineM(points[i]!, points[i + 1]!);
  }
  return total;
}

function makeStopFromPoints(
  points: ParsedPoint[],
  id: string,
  inferred = false,
): Stop {
  const sum = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    {lat: 0, lng: 0},
  );
  const centre = {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length,
  };
  return {
    id,
    lat: centre.lat,
    lng: centre.lng,
    arrivedAt: points[0]!.at,
    leftAt: points[points.length - 1]!.at,
    durationMs:
      points[points.length - 1]!.at.getTime() - points[0]!.at.getTime(),
    pointCount: points.length,
    spreadM: points.reduce(
      (max, point) => Math.max(max, haversineM(centre, point)),
      0,
    ),
    pointIds: points.map(point => point.id),
    inferred,
  };
}

function pushSavedPlaceRun(
  points: ParsedPoint[],
  runStart: number,
  runEnd: number,
  runPlace: SavedPlaceRow,
  extra: Stop[],
): void {
  if (runEnd <= runStart) {
    return;
  }
  const runPoints = points.slice(runStart, runEnd);
  const durationMs =
    runPoints[runPoints.length - 1]!.at.getTime() - runPoints[0]!.at.getTime();
  if (runPoints.length > 1 && durationMs >= SAVED_PLACE_MIN_DWELL_MS) {
    extra.push(
      makeStopFromPoints(
        runPoints,
        `saved-place-${runPlace.id}-${runPoints[0]!.id}`,
        true,
      ),
    );
  }
}

function detectSavedPlaceStops(
  points: ParsedPoint[],
  places: SavedPlaceRow[],
  config: StopDetectionConfig = DEFAULT_STOP_CONFIG,
): Stop[] {
  if (places.length === 0 || points.length === 0) {
    return [];
  }
  const extra: Stop[] = [];
  let runStart = -1;
  let runPlace: SavedPlaceRow | null = null;

  const closeRun = (end: number) => {
    if (runPlace != null && runStart >= 0) {
      pushSavedPlaceRun(points, runStart, end, runPlace, extra);
    }
    runStart = -1;
    runPlace = null;
  };

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]!;
    if (isMovingPoint(point, config)) {
      closeRun(i);
      continue;
    }
    const place = matchSavedPlaceForPoint(point, places);
    if (place != null && runPlace != null && place.id === runPlace.id) {
      continue;
    }
    closeRun(i);
    if (place != null) {
      runStart = i;
      runPlace = place;
    }
  }
  closeRun(points.length);
  return extra;
}

/** A real drive needs motion/path evidence; loop-back routes can end near the start. */
function isRealDrive(
  points: ParsedPoint[],
  config: StopDetectionConfig,
): boolean {
  if (points.length < 2) {
    return false;
  }
  const displacementM = haversineM(points[0]!, points[points.length - 1]!);
  const pathM = pathLengthM(points);
  const hasMoving = points.some(p => isMovingPoint(p, config));
  const durationMs =
    points[points.length - 1]!.at.getTime() - points[0]!.at.getTime();
  // Long elapsed time with almost no path is sparse geofence drift, not a drive.
  if (durationMs >= 30 * 60 * 1000 && pathM < 1000) {
    return false;
  }
  // Round trips (leave and return near the same spot) still count when path is long.
  if (hasMoving && pathM >= MIN_DRIVE_DISTANCE_M) {
    return true;
  }
  // Prevent jitter loops near a stay from becoming Home→Home micro-drives.
  if (displacementM < config.radiusM) {
    return false;
  }
  if (hasMoving) {
    return true;
  }
  return pathM >= MIN_DRIVE_DISTANCE_M;
}

function makeDrive(
  points: ParsedPoint[],
  fromStop: Stop | null,
  toStop: Stop | null,
  order: number,
): DriveSegment {
  const startAt = points[0]!.at;
  const endAt = points[points.length - 1]!.at;
  return {
    kind: 'drive',
    id: `drive-${points[0]!.id}-${points[points.length - 1]!.id}`,
    order,
    startAt,
    endAt,
    durationMs: endAt.getTime() - startAt.getTime(),
    distanceM: pathLengthM(points),
    points,
    fromStop,
    toStop,
  };
}

function segmentStart(seg: TripSegment): {lat: number; lng: number} {
  if (seg.kind === 'missing') {
    return {lat: seg.fromLat, lng: seg.fromLng};
  }
  const p = seg.points[0]!;
  return {lat: p.lat, lng: p.lng};
}

function segmentEnd(seg: TripSegment): {lat: number; lng: number} {
  if (seg.kind === 'missing') {
    return {lat: seg.toLat, lng: seg.toLng};
  }
  const p = seg.points[seg.points.length - 1]!;
  return {lat: p.lat, lng: p.lng};
}

function mergeStays(a: StaySegment, b: StaySegment): StaySegment {
  const points = [...a.points, ...b.points];
  const arrivedAt = a.startAt;
  const leftAt = b.endAt;
  const durationMs = leftAt.getTime() - arrivedAt.getTime();
  const mergedStop: Stop = {
    ...a.stop,
    leftAt,
    durationMs,
    pointCount: a.stop.pointCount + b.stop.pointCount,
    pointIds: [...a.stop.pointIds, ...b.stop.pointIds],
    spreadM: Math.max(a.stop.spreadM, b.stop.spreadM),
  };
  return {
    kind: 'stay',
    id: `stay-${a.stop.id}-merged-${b.stop.id}`,
    order: a.order,
    stop: mergedStop,
    startAt: arrivedAt,
    endAt: leftAt,
    durationMs,
    points,
  };
}

function makeMissing(
  prev: TripSegment,
  next: TripSegment,
  gapMs: number,
  distanceM: number,
): MissingSegment {
  const from = segmentEnd(prev);
  const to = segmentStart(next);
  return {
    kind: 'missing',
    id: `missing-${prev.id}-${next.id}`,
    order: 0,
    startAt: prev.endAt,
    endAt: next.startAt,
    durationMs: gapMs,
    distanceM,
    fromKind: prev.kind as 'stay' | 'drive',
    toKind: next.kind as 'stay' | 'drive',
    fromLat: from.lat,
    fromLng: from.lng,
    toLat: to.lat,
    toLng: to.lng,
    points: [],
  };
}

/**
 * Post-process raw stay/drive segments:
 * 1. Merge consecutive stays at the same place (spread-limit artifact).
 * 2. Insert "missing" when two stays or two drives abut with a large gap in
 *    both distance and time (phone off / no GPS).
 */
function reconcileSegments(segments: TripSegment[]): TripSegment[] {
  if (segments.length === 0) {
    return segments;
  }

  // Pass 1: merge adjacent stays that are clearly the same place.
  let list = segments;
  let didMerge = true;
  while (didMerge) {
    didMerge = false;
    const next: TripSegment[] = [];
    for (let i = 0; i < list.length; i += 1) {
      const cur = list[i]!;
      const following = list[i + 1];
      if (
        cur.kind === 'stay' &&
        following?.kind === 'stay'
      ) {
        const dist = haversineM(segmentEnd(cur), segmentStart(following));
        if (dist < MERGE_STAY_MAX_DISTANCE_M) {
          next.push(mergeStays(cur, following));
          i += 1;
          didMerge = true;
          continue;
        }
      }
      next.push(cur);
    }
    list = next;
  }

  // Pass 2: insert missing gaps between consecutive same-kind segments.
  const result: TripSegment[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const cur = list[i]!;
    result.push(cur);
    const following = list[i + 1];
    if (following == null) {
      continue;
    }

    const sameKind =
      (cur.kind === 'stay' && following.kind === 'stay') ||
      (cur.kind === 'drive' && following.kind === 'drive');
    if (!sameKind) {
      continue;
    }

    const gapMs = following.startAt.getTime() - cur.endAt.getTime();
    const dist = haversineM(segmentEnd(cur), segmentStart(following));
    if (
      dist >= MISSING_MIN_DISTANCE_M &&
      gapMs >= MISSING_MIN_GAP_MS
    ) {
      result.push(makeMissing(cur, following, gapMs, dist));
    }
  }

  result.forEach((seg, index) => {
    seg.order = index + 1;
  });
  return result;
}

/**
 * Build the chronological stay/drive sequence:
 *   stay(home) → drive(home→work) → stay(work) → drive(work→home) → stay(home)
 *
 * Stays are the detected stops. Drives are the runs of points between one
 * stay's last point and the next stay's first point (inclusive of both endpoints
 * so the drive line connects stop-to-stop). Leading/trailing drives are emitted
 * when there is movement before the first stay or after the last stay.
 */
export function buildTripSegments(
  points: ParsedPoint[],
  stops: Stop[],
  config: StopDetectionConfig = DEFAULT_STOP_CONFIG,
): TripSegment[] {
  const segments: TripSegment[] = [];

  if (stops.length === 0) {
    if (isRealDrive(points, config)) {
      segments.push(makeDrive(points, null, null, 1));
    }
    return segments;
  }

  const idxById = new Map<number, number>();
  points.forEach((p, i) => idxById.set(p.id, i));

  const ranges = stops
    .map(stop => ({
      stop,
      start: idxById.get(stop.pointIds[0]!) ?? -1,
      end: idxById.get(stop.pointIds[stop.pointIds.length - 1]!) ?? -1,
    }))
    .filter(r => r.start >= 0 && r.end >= 0)
    .sort((a, b) => a.start - b.start);

  let order = 0;

  // Leading drive: movement before the first stay.
  const first = ranges[0]!;
  if (first.start > 0) {
    const slice = points.slice(0, first.start + 1);
    if (isRealDrive(slice, config)) {
      order += 1;
      segments.push(makeDrive(slice, null, first.stop, order));
    }
  }

  for (let r = 0; r < ranges.length; r += 1) {
    const range = ranges[r]!;
    order += 1;
    const stayPoints = points.slice(range.start, range.end + 1);
    segments.push({
      kind: 'stay',
      id: `stay-${range.stop.id}`,
      order,
      stop: range.stop,
      startAt: range.stop.arrivedAt,
      endAt: range.stop.leftAt,
      durationMs: range.stop.durationMs,
      points: stayPoints,
    });

    const nextRange = ranges[r + 1];
    if (nextRange != null) {
      const slice = points.slice(range.end, nextRange.start + 1);
      if (isRealDrive(slice, config)) {
        order += 1;
        segments.push(makeDrive(slice, range.stop, nextRange.stop, order));
      }
    }
  }

  // Trailing drive: movement after the last stay.
  const last = ranges[ranges.length - 1]!;
  if (last.end < points.length - 1) {
    const slice = points.slice(last.end);
    if (isRealDrive(slice, config)) {
      order += 1;
      segments.push(makeDrive(slice, last.stop, null, order));
    }
  }

  return reconcileSegments(segments);
}

function annotateSegments(
  segments: TripSegment[],
  savedPlaces: SavedPlaceRow[],
): TripSegment[] {
  if (savedPlaces.length === 0) {
    return segments;
  }

  const withStays = segments.map(segment => {
    if (segment.kind !== 'stay') {
      return segment;
    }
    const place = matchSavedPlaceForStop(
      segment.stop,
      segment.points,
      savedPlaces,
    );
    if (place == null) {
      return segment;
    }
    return {
      ...segment,
      savedPlaceLabel: place.label,
      savedPlaceId: place.id,
    };
  });

  return withStays.map((segment, index) => {
    if (segment.kind !== 'drive') {
      return segment;
    }
    const fromPlace = matchDriveStartSavedPlace(
      segment,
      withStays[index - 1],
      savedPlaces,
    );
    const toPlace = matchDriveEndSavedPlace(
      segment,
      withStays[index + 1],
      savedPlaces,
    );
    if (fromPlace == null && toPlace == null) {
      return segment;
    }
    return {
      ...segment,
      fromSavedPlaceLabel: fromPlace?.label,
      fromSavedPlaceId: fromPlace?.id,
      toSavedPlaceLabel: toPlace?.label,
      toSavedPlaceId: toPlace?.id,
    };
  });
}

function isHomeStay(
  segment: StaySegment,
  savedPlaces: SavedPlaceRow[],
): boolean {
  if (segment.savedPlaceId != null) {
    return (
      savedPlaces.find(place => place.id === segment.savedPlaceId)?.kind ===
      'home'
    );
  }
  return false;
}

function segmentDateKeys(segment: TripSegment): {startKey: string; endKey: string} {
  return {
    startKey: dateKeyForTimestamp(segment.startAt),
    endKey: dateKeyForTimestamp(segment.endAt),
  };
}

function clipStay(
  segment: StaySegment,
  from: Date,
  to: Date,
): StaySegment | null {
  const points = segment.points.filter(
    point => point.at >= from && point.at <= to,
  );
  if (points.length === 0) {
    return null;
  }
  const durationMs = to.getTime() - from.getTime();
  return {
    ...segment,
    id: `${segment.id}-clipped-${from.getTime()}`,
    startAt: from,
    endAt: to,
    durationMs,
    points,
    stop: {
      ...segment.stop,
      arrivedAt: from,
      leftAt: to,
      durationMs,
      pointCount: points.length,
      pointIds: points.map(point => point.id),
    },
  };
}

/**
 * Per-day trip view:
 * - Home stays crossing midnight are split at midnight.
 * - Drives and non-home stays crossing midnight appear in full on both days.
 */
export function projectSegmentsForDay(
  segments: TripSegment[],
  dayKey: string,
  savedPlaces: SavedPlaceRow[] = [],
): TripSegment[] {
  const dayStartAt = dayStart(dayKey);
  const dayEndAt = dayEndExclusive(dayKey);
  const projected: Array<{segment: TripSegment; sortKey: number}> = [];

  for (const segment of segments) {
    const overlapsDay =
      segment.endAt > dayStartAt && segment.startAt < dayEndAt;
    if (!overlapsDay) {
      continue;
    }

    const {startKey, endKey} = segmentDateKeys(segment);
    const crossesMidnight = startKey !== endKey;

    if (
      segment.kind === 'stay' &&
      isHomeStay(segment, savedPlaces) &&
      crossesMidnight
    ) {
      if (startKey === dayKey) {
        const clipped = clipStay(segment, segment.startAt, dayEndAt);
        if (clipped != null) {
          projected.push({segment: clipped, sortKey: segment.startAt.getTime()});
        }
      }
      if (endKey === dayKey) {
        const clipped = clipStay(segment, dayStartAt, segment.endAt);
        if (clipped != null) {
          projected.push({segment: clipped, sortKey: dayStartAt.getTime()});
        }
      }
      continue;
    }

    const spansMidnightAsWhole =
      crossesMidnight &&
      (segment.kind === 'drive' ||
        segment.kind === 'missing' ||
        (segment.kind === 'stay' && !isHomeStay(segment, savedPlaces)));

    if (spansMidnightAsWhole) {
      if (dayKey === startKey || dayKey === endKey) {
        let sortKey = segment.startAt.getTime();
        if (dayKey === startKey) {
          sortKey = dayEndAt.getTime() + 1;
        } else {
          sortKey = dayStartAt.getTime() - 1;
        }
        projected.push({segment, sortKey});
      }
      continue;
    }

    if (startKey === dayKey) {
      projected.push({segment, sortKey: segment.startAt.getTime()});
    }
  }

  projected.sort((a, b) => a.sortKey - b.sortKey);
  return projected.map((entry, index) => ({
    ...entry.segment,
    order: index + 1,
  }));
}

export function detectTrips(
  rawPoints: ParsedPoint[],
  config: StopDetectionConfig = DEFAULT_STOP_CONFIG,
  savedPlaces: SavedPlaceRow[] = [],
): TripResult {
  const points = prepareTripPoints(rawPoints, config);
  const baseStops = detectStops(rawPoints, config);
  const occupiedPointIds = new Set<number>(
    baseStops.flatMap(stop => stop.pointIds),
  );
  const savedPlaceStops = detectSavedPlaceStops(points, savedPlaces, config).filter(
    stop => stop.pointIds.every(id => !occupiedPointIds.has(id)),
  );
  const stops = [...baseStops, ...savedPlaceStops].sort(
    (a, b) => a.arrivedAt.getTime() - b.arrivedAt.getTime(),
  );
  const segments = annotateSegments(
    buildTripSegments(points, stops, config),
    savedPlaces,
  );
  return {points, stops, segments};
}

/** Build trips for one calendar day, including cross-midnight boundary rules. */
export function detectTripsForDay(
  dayKey: string,
  allRawPoints: ParsedPoint[],
  config: StopDetectionConfig = DEFAULT_STOP_CONFIG,
  savedPlaces: SavedPlaceRow[] = [],
): TripResult {
  const prevKey = addDaysToDateKey(dayKey, -1);
  const nextKey = addDaysToDateKey(dayKey, 1);
  const windowKeys = new Set([prevKey, dayKey, nextKey]);
  const windowPoints = allRawPoints.filter(point => windowKeys.has(point.dateKey));
  const full = detectTrips(windowPoints, config, savedPlaces);
  const segments = projectSegmentsForDay(full.segments, dayKey, savedPlaces);

  const segmentStopIds = new Set<string>();
  const segmentPointIds = new Set<number>();
  for (const segment of segments) {
    if (segment.kind !== 'missing') {
      for (const point of segment.points) {
        segmentPointIds.add(point.id);
      }
    }
    if (segment.kind === 'stay') {
      segmentStopIds.add(segment.stop.id);
    } else if (segment.kind === 'drive') {
      if (segment.fromStop != null) {
        segmentStopIds.add(segment.fromStop.id);
      }
      if (segment.toStop != null) {
        segmentStopIds.add(segment.toStop.id);
      }
    }
  }

  return {
    points: full.points.filter(point => segmentPointIds.has(point.id)),
    stops: full.stops.filter(stop => segmentStopIds.has(stop.id)),
    segments,
  };
}

export function formatDistance(m: number): string {
  if (m < 1000) {
    return `${Math.round(m)} m`;
  }
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
}
