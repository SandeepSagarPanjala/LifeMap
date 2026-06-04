import {differenceInMilliseconds} from 'date-fns';

import type {LocationPointRow} from '@/db/repositories/location-days';
import {calculatePathDistanceKm, distanceKm} from '@/lib/location-geo';
import type {LocationPointLike} from '@/lib/location-geo';
import type {TripDetectionConfig} from '@/lib/trip-settings';

export type TripKind = 'travel' | 'stay' | 'gap';

export type DetectedTrip = {
  id: string;
  kind: 'travel' | 'stay';
  points: LocationPointRow[];
  startAt: Date;
  endAt: Date;
  distanceKm: number;
  durationMs: number;
  /** Last visit of the day with no newer saves — UI runs through `now`. */
  openThroughNow?: boolean;
};

export type TimelineGap = {
  id: string;
  kind: 'gap';
  points: [];
  startAt: Date;
  endAt: Date;
  durationMs: number;
  distanceKm: 0;
};

export type DayTimelineEntry = DetectedTrip | TimelineGap;

/** Gaps shorter than this are not shown as separate cards. */
const MIN_TIMELINE_GAP_MS = 2 * 60_000;

/** Below this, movement between stays is GPS noise — not a real trip. */
const MIN_TRAVEL_DISTANCE_M = 40;

const COORD_DECIMALS = 5;

function roundCoord(value: number): number {
  const factor = 10 ** COORD_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * Collapse duplicate DB rows (same instant + place) before timeline logic.
 */
export function dedupeLocationPoints(points: LocationPointRow[]): LocationPointRow[] {
  const sorted = [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const byKey = new Map<string, LocationPointRow>();

  for (const point of sorted) {
    const key = `${point.timestamp.getTime()}|${roundCoord(point.lat)}|${roundCoord(point.lng)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, point);
      continue;
    }
    if (
      point.accuracy != null &&
      (existing.accuracy == null || point.accuracy < existing.accuracy)
    ) {
      byKey.set(key, {...point, id: existing.id});
    }
  }

  return [...byKey.values()].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
}

function makeTrip(
  points: LocationPointRow[],
  kind: 'travel' | 'stay',
  index: number,
): DetectedTrip {
  const sorted = [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const startAt = sorted[0]!.timestamp;
  const endAt = sorted[sorted.length - 1]!.timestamp;
  const safeEnd = endAt.getTime() >= startAt.getTime() ? endAt : startAt;
  const durationMs = Math.max(0, differenceInMilliseconds(safeEnd, startAt));
  const distanceKm =
    kind === 'stay' ? 0 : calculatePathDistanceKm(sorted);

  return {
    id: `${kind}-${index}-${startAt.getTime()}`,
    kind,
    points: sorted,
    startAt,
    endAt: safeEnd,
    distanceKm,
    durationMs,
  };
}

function isMeaningfulTravel(trip: DetectedTrip): boolean {
  if (trip.points.length === 0) {
    return false;
  }
  if (trip.points.length === 1) {
    return trip.distanceKm * 1000 >= MIN_TRAVEL_DISTANCE_M;
  }
  return trip.distanceKm * 1000 >= MIN_TRAVEL_DISTANCE_M;
}

function makeGap(startAt: Date, endAt: Date, index: number): TimelineGap {
  return {
    id: `gap-${index}-${startAt.getTime()}`,
    kind: 'gap',
    points: [],
    startAt,
    endAt,
    durationMs: Math.max(0, differenceInMilliseconds(endAt, startAt)),
    distanceKm: 0,
  };
}

export function isPlayableTimelineEntry(
  entry: DayTimelineEntry,
): entry is DetectedTrip {
  return entry.kind !== 'gap';
}

type StaySpan = {start: number; end: number};

/**
 * Stay = saves within dwell radius of the visit anchor (first save in the cluster).
 * Qualifies when span ≥ dwell minutes, or last cluster of the day (open visit).
 * Time gaps in the same area do not split a stay — only leaving the area does.
 */
function findStaySpans(
  points: LocationPointRow[],
  config: TripDetectionConfig,
): StaySpan[] {
  if (points.length === 0) {
    return [];
  }

  const radiusKm = config.dwellRadiusMeters / 1000;
  const minDwellMs = config.dwellMinutes * 60_000;
  const spans: StaySpan[] = [];
  let index = 0;

  while (index < points.length) {
    const anchor = points[index]!;
    let end = index;
    while (
      end + 1 < points.length &&
      distanceKm(anchor, points[end + 1]!) <= radiusKm
    ) {
      end += 1;
    }

    const spanMs =
      points[end]!.timestamp.getTime() - points[index]!.timestamp.getTime();
    const atEndOfDay = end === points.length - 1;

    if (spanMs >= minDwellMs || atEndOfDay) {
      spans.push({start: index, end});
      index = end + 1;
    } else {
      index = end + 1;
    }
  }

  return spans;
}

/** Same place within dwell radius (+ GPS drift buffer). */
export function arePointsSamePlace(
  a: LocationPointLike,
  b: LocationPointLike,
  config: TripDetectionConfig,
): boolean {
  return distanceKm(a, b) * 1000 <= config.dwellRadiusMeters + 5;
}

/** Closest distance between any saves in two stays (handles anchor drift at one place). */
function closestStayDistanceM(
  previous: DetectedTrip,
  next: DetectedTrip,
): number {
  let minM = Number.POSITIVE_INFINITY;
  for (const a of previous.points) {
    for (const b of next.points) {
      minM = Math.min(minM, distanceKm(a, b) * 1000);
    }
  }
  return minM;
}

function staysWithinMergeRadius(
  previous: DetectedTrip,
  next: DetectedTrip,
  config: TripDetectionConfig,
): boolean {
  if (previous.kind !== 'stay' || next.kind !== 'stay') {
    return false;
  }
  const limitM = config.dwellRadiusMeters + 5;
  return closestStayDistanceM(previous, next) <= limitM;
}

/**
 * One visit per place: merge consecutive stays when the last save of A and the
 * first save of B are within dwell radius (covers time gaps with no DB rows).
 * Drops noise drives sandwiched between two same-area stays.
 */
export function mergeAdjacentSameAreaStays(
  trips: DetectedTrip[],
  config: TripDetectionConfig,
): DetectedTrip[] {
  if (trips.length === 0) {
    return [];
  }

  const merged: DetectedTrip[] = [];
  let index = 0;

  while (index < trips.length) {
    let current = trips[index]!;
    index += 1;

    while (index < trips.length) {
      const next = trips[index]!;

      if (
        current.kind === 'stay' &&
        next.kind === 'stay' &&
        staysWithinMergeRadius(current, next, config)
      ) {
        current = makeTrip(
          [...current.points, ...next.points],
          'stay',
          merged.length,
        );
        index += 1;
        continue;
      }

      if (
        current.kind === 'stay' &&
        next.kind === 'travel' &&
        index + 1 < trips.length
      ) {
        const afterTravel = trips[index + 1]!;
        if (
          !isMeaningfulTravel(next) &&
          afterTravel.kind === 'stay' &&
          staysWithinMergeRadius(current, afterTravel, config)
        ) {
          current = makeTrip(
            [...current.points, ...afterTravel.points],
            'stay',
            merged.length,
          );
          index += 2;
          continue;
        }
      }

      break;
    }

    merged.push(current);
  }

  return merged;
}

function shouldShowTimelineGap(
  previous: DetectedTrip,
  next: DetectedTrip,
  config: TripDetectionConfig,
): boolean {
  // Stay→trip and trip→stay are one journey; gaps are only missing DB rows.
  if (
    (previous.kind === 'stay' && next.kind === 'travel') ||
    (previous.kind === 'travel' && next.kind === 'stay')
  ) {
    return false;
  }

  const gapMs = next.startAt.getTime() - previous.endAt.getTime();
  if (gapMs < MIN_TIMELINE_GAP_MS) {
    return false;
  }

  const lastPrev = previous.points[previous.points.length - 1]!;
  const firstNext = next.points[0]!;
  const distM = distanceKm(lastPrev, firstNext) * 1000;

  return distM > config.dwellRadiusMeters;
}

/**
 * Life360-style timeline: stay → trip → stay → trip → stay.
 * - Stay: ≥ dwell minutes in one area, or open visit through last save.
 * - Trip: saves from the moment you leave until the next stay begins.
 * - Gap: no rows in DB and next save is far away (not same-area hole).
 */
export function detectTrips(
  points: LocationPointRow[],
  config: TripDetectionConfig,
): DetectedTrip[] {
  const deduped = dedupeLocationPoints(points);
  const stays = findStaySpans(deduped, config);
  if (stays.length === 0) {
    return [];
  }

  const trips: DetectedTrip[] = [];
  let tripIndex = 0;
  let cursor = 0;

  for (let stayIndex = 0; stayIndex < stays.length; stayIndex += 1) {
    const stay = stays[stayIndex]!;
    const travelEnd = stay.start - 1;

    if (travelEnd >= cursor) {
      const travelPoints = deduped.slice(cursor, travelEnd + 1);
      if (travelPoints.length > 0) {
        const travel = makeTrip(travelPoints, 'travel', tripIndex);
        if (isMeaningfulTravel(travel)) {
          trips.push(travel);
          tripIndex += 1;
        }
      }
    }

    trips.push(
      makeTrip(
        deduped.slice(stay.start, stay.end + 1),
        'stay',
        tripIndex,
      ),
    );
    tripIndex += 1;
    cursor = stay.end + 1;
  }

  if (cursor < deduped.length) {
    const travel = makeTrip(deduped.slice(cursor), 'travel', tripIndex);
    if (isMeaningfulTravel(travel)) {
      trips.push(travel);
    }
  }

  return mergeAdjacentSameAreaStays(trips, config);
}

/** @deprecated Use mergeAdjacentSameAreaStays */
export function mergeSameAreaTrips(
  trips: DetectedTrip[],
  config: TripDetectionConfig,
): DetectedTrip[] {
  return mergeAdjacentSameAreaStays(trips, config);
}

export function buildDayTimeline(
  points: LocationPointRow[],
  config: TripDetectionConfig,
): DayTimelineEntry[] {
  const trips = detectTrips(points, config);
  if (trips.length === 0) {
    return [];
  }

  const timeline: DayTimelineEntry[] = [];
  let gapIndex = 0;

  for (let index = 0; index < trips.length; index += 1) {
    const trip = trips[index]!;

    if (index > 0) {
      const previous = trips[index - 1]!;
      if (shouldShowTimelineGap(previous, trip, config)) {
        timeline.push(makeGap(previous.endAt, trip.startAt, gapIndex));
        gapIndex += 1;
      }
    }

    timeline.push(trip);
  }

  return timeline;
}

export function buildDayTimelineNewestFirst(
  points: LocationPointRow[],
  config: TripDetectionConfig,
): DayTimelineEntry[] {
  return [...buildDayTimeline(points, config)].reverse();
}

/** @deprecated Use buildDayTimelineNewestFirst */
export function detectTripsNewestFirst(
  points: LocationPointRow[],
  config: TripDetectionConfig,
): DetectedTrip[] {
  return [...detectTrips(points, config)].reverse();
}

/** Map label placement — middle of stay points. */
export function stayTripCentroid(trip: DetectedTrip): {
  latitude: number;
  longitude: number;
} {
  const point = trip.points[Math.floor(trip.points.length / 2)] ?? trip.points[0]!;
  return {
    latitude: point?.lat ?? 0,
    longitude: point?.lng ?? 0,
  };
}

/**
 * Exact saved coordinate for the map pin tip.
 * Ongoing visit → latest row; otherwise first save when the visit started.
 */
export function stayTripMarkerCoordinate(
  trip: DetectedTrip,
  options?: {ongoing?: boolean},
): {latitude: number; longitude: number} {
  const sorted = [...trip.points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const point =
    options?.ongoing && sorted.length > 0
      ? sorted[sorted.length - 1]!
      : sorted[0];
  return {
    latitude: point?.lat ?? 0,
    longitude: point?.lng ?? 0,
  };
}
