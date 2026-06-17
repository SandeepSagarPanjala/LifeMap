import {differenceInMilliseconds} from 'date-fns';

/**
 * Visit / drive timeline detection.
 * Product rules (alternation, speed, continuity): docs/timeline-model.md
 */

import type {LocationPointRow} from '@/db/repositories/location-days';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {calculatePathDistanceKm, distanceKm} from '@/lib/location-geo';
import type {LocationPointLike} from '@/lib/location-geo';
import {buildDrawableRouteSegments} from '@/lib/route-segments';
import {toDateKey} from '@/lib/day-utils';
import {
  buildSegmentationTimeline,
  detectTripsFromPoints,
} from '@/lib/segmentation';
import {
  MIN_STOP_CLUSTER_RADIUS_METERS,
  MIN_TRIP_STOP_MINUTES,
  SAVED_PLACE_MIN_DWELL_MINUTES,
  type TripDetectionConfig,
} from '@/lib/trip-settings';

export type TripKind = 'travel' | 'stay' | 'gap';

/** Optional inputs that refine timeline detection without changing trip settings. */
export type TripTimelineOptions = {
  /** Capture times — pauses overlapping these are not split into visits. */
  momentTimestamps?: readonly Date[];
  /** Saved Home / Work / favorites — 150 m + 1 min visit rules from place center. */
  savedPlaces?: readonly SavedPlaceRow[];
};

const MOMENT_CAPTURE_STOP_BUFFER_MS = 3 * 60_000;

function spanOverlapsMoment(
  startMs: number,
  endMs: number,
  momentTimestamps: readonly Date[],
): boolean {
  if (momentTimestamps.length === 0) {
    return false;
  }

  const bufferedStart = startMs - MOMENT_CAPTURE_STOP_BUFFER_MS;
  const bufferedEnd = endMs + MOMENT_CAPTURE_STOP_BUFFER_MS;
  return momentTimestamps.some(timestamp => {
    const t = timestamp.getTime();
    return t >= bufferedStart && t <= bufferedEnd;
  });
}

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
  /** Persisted trip row — per-visit label overrides. */
  materializedTripId?: number;
  /** Display order within the day (1-based). */
  segmentOrder?: number;
  savedPlaceLabel?: string;
  savedPlaceId?: number;
  inferred?: boolean;
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

/** Long drives need multiple fixes — 2-point straight lines are tracking gaps, not routes. */
const MIN_TRAVEL_POINTS_FOR_LONG_DRIVE = 3;
const LONG_DRIVE_DISTANCE_M = 200;
/** Compact food/charger stops — skip dashed in-area paths (orange zone is enough). */
const MIN_VISIT_IN_AREA_SPREAD_M = 100;
const MIN_VISIT_IN_AREA_PATH_M = 120;

/** Long hops slower than this are gaps, not drives (see docs/timeline-model.md). */
const MIN_MEANINGFUL_DRIVE_IMPLIED_KMH = 8;

/** Few collinear fixes on a long chord — do not draw a road-following lie. */
const SPARSE_ROUTE_MAX_POINTS = 6;
const SPARSE_ROUTE_STRAIGHTNESS_RATIO = 0.9;

/** Turn-in faster than this stays on the drive path; slower = parked (visit starts). */
const VISIT_ARRIVAL_SPEED_MS = 2;

/**
 * Max distance from the arrival save for one visit envelope.
 * GPS path length can be much larger (lot drift); spread is what matters.
 */
const MAX_STAY_ENVELOPE_SPREAD_M = 250;

/** Interior stop on a drive — path above this is movement, not a pause. */
const MAX_STOP_CLUSTER_PATH_M = 250;

/** Mall / campus walking can stay inside this envelope around the arrival anchor. */
const VENUE_MAX_SPREAD_M = 400;

/** Path ÷ spread — walking loops score higher than driving away in one direction. */
const VENUE_MIN_PATH_SPREAD_RATIO = 2;

/** Net displacement ÷ spread — leaving the area ends near the envelope edge (~1). */
const VENUE_MAX_NET_SPREAD_RATIO = 0.95;

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
  if (trip.startAt.getTime() === trip.endAt.getTime()) {
    return false;
  }
  const distanceM = trip.distanceKm * 1000;
  if (
    trip.points.length < MIN_TRAVEL_POINTS_FOR_LONG_DRIVE &&
    distanceM >= LONG_DRIVE_DISTANCE_M
  ) {
    return false;
  }
  if (distanceM >= LONG_DRIVE_DISTANCE_M) {
    const impliedKmh = impliedSpeedKmh(distanceM, trip.durationMs);
    if (impliedKmh < MIN_MEANINGFUL_DRIVE_IMPLIED_KMH) {
      return false;
    }
  }
  /** Real hops (e.g. Whataburger → Tesla lot) can be short but hundreds of meters. */
  if (distanceM >= 100) {
    return true;
  }
  if (trip.durationMs < 60_000 && distanceM < MIN_TRAVEL_DISTANCE_M) {
    return false;
  }
  return distanceM >= MIN_TRAVEL_DISTANCE_M;
}

/** True when a drive has too few GPS fixes to draw a real path (avoid straight-line lies). */
export function isSparseTravelRoute(points: LocationPointRow[]): boolean {
  if (points.length < 2) {
    return true;
  }
  const pathM = calculatePathDistanceKm(points) * 1000;
  const straightM = distanceKm(points[0]!, points[points.length - 1]!) * 1000;
  if (pathM >= LONG_DRIVE_DISTANCE_M && straightM / Math.max(pathM, 1) >= SPARSE_ROUTE_STRAIGHTNESS_RATIO) {
    return points.length < SPARSE_ROUTE_MAX_POINTS;
  }
  if (points.length >= MIN_TRAVEL_POINTS_FOR_LONG_DRIVE) {
    return false;
  }
  return pathM >= LONG_DRIVE_DISTANCE_M;
}

const MAX_STAY_DEPARTURE_BRIDGE_MS = 5 * 60_000;

/** Short gap + lot-sized move → one drive from the last visit save (776→779). */
const SHORT_DEPARTURE_MAX_GAP_MS = 5 * 60_000;
const SHORT_DEPARTURE_MIN_DIST_M = 80;
const SHORT_DEPARTURE_MAX_DIST_M = 800;
const MIN_DEPARTURE_SPEED_KMH = 2.5;
const MAX_DEPARTURE_SPEED_KMH = 80;

/** Long gap + tiny offset → still at previous place (#786→#787 wake). */
const STALE_WAKE_MIN_GAP_MS = 10 * 60_000;
const STALE_WAKE_MAX_DIST_M = 400;
const STALE_WAKE_MAX_SPEED_KMH = 2;

/** Merge stay spans across sparse GPS at the same place (charger, meal, etc.). */
const SAME_PLACE_SPARSE_GAP_MAX_MS = 60 * 60_000;

function impliedSpeedKmh(distM: number, gapMs: number): number {
  if (gapMs <= 0) {
    return 0;
  }
  return (distM / 1000) / (gapMs / 3_600_000);
}

/** @internal Exported for tests */
export function isShortGapDeparture(
  from: LocationPointRow,
  to: LocationPointRow,
): boolean {
  const gapMs = to.timestamp.getTime() - from.timestamp.getTime();
  const distM = distanceKm(from, to) * 1000;
  if (gapMs <= 0 || gapMs > SHORT_DEPARTURE_MAX_GAP_MS) {
    return false;
  }
  if (distM < SHORT_DEPARTURE_MIN_DIST_M || distM > SHORT_DEPARTURE_MAX_DIST_M) {
    return false;
  }
  const speedKmh = impliedSpeedKmh(distM, gapMs);
  return speedKmh >= MIN_DEPARTURE_SPEED_KMH && speedKmh <= MAX_DEPARTURE_SPEED_KMH;
}

/** @internal Exported for tests */
export function isStaleWakeNotDeparture(
  from: LocationPointRow,
  to: LocationPointRow,
): boolean {
  const gapMs = to.timestamp.getTime() - from.timestamp.getTime();
  const distM = distanceKm(from, to) * 1000;
  if (gapMs < STALE_WAKE_MIN_GAP_MS || distM > STALE_WAKE_MAX_DIST_M) {
    return false;
  }
  return impliedSpeedKmh(distM, gapMs) < STALE_WAKE_MAX_SPEED_KMH;
}

function trimStaleWakeLeading(
  points: LocationPointRow[],
  priorStayLast: LocationPointRow | null,
): LocationPointRow[] {
  if (!priorStayLast || points.length === 0) {
    return points;
  }

  let start = 0;
  while (
    start < points.length - 1 &&
    isStaleWakeNotDeparture(priorStayLast, points[start]!)
  ) {
    start += 1;
  }

  return points.slice(start);
}

/**
 * When approach pings (779…) are clustered with the destination (784) as one stay,
 * peel off the short hop from the previous visit as travel starting at #776.
 */
function splitStayAfterShortDeparture(
  deduped: LocationPointRow[],
  span: StaySpan,
  priorStayEndIndex: number,
  config: TripDetectionConfig,
): {travelEnd: number; stay: StaySpan} {
  const lastPrev = deduped[priorStayEndIndex]!;
  const firstInSpan = deduped[span.start]!;

  if (!isShortGapDeparture(lastPrev, firstInSpan)) {
    return {travelEnd: span.start - 1, stay: span};
  }

  const destinationAnchor = deduped[span.end]!;
  const radiusKm = config.dwellRadiusMeters / 1000;
  let arriveIndex = span.start;

  for (let index = span.start; index <= span.end; index += 1) {
    if (distanceKm(destinationAnchor, deduped[index]!) <= radiusKm) {
      arriveIndex = index;
      break;
    }
  }

  if (arriveIndex <= span.start) {
    return {travelEnd: span.start - 1, stay: span};
  }

  return {
    travelEnd: arriveIndex - 1,
    stay: {start: arriveIndex, end: span.end},
  };
}

function buildTravelSlice(
  deduped: LocationPointRow[],
  sliceStart: number,
  sliceEnd: number,
  priorStayEndIndex: number | null,
): LocationPointRow[] {
  let start = sliceStart;
  if (
    priorStayEndIndex != null &&
    priorStayEndIndex < start &&
    isShortGapDeparture(deduped[priorStayEndIndex]!, deduped[start]!)
  ) {
    start = priorStayEndIndex;
  }

  const priorLast =
    priorStayEndIndex != null ? deduped[priorStayEndIndex]! : null;
  return trimStaleWakeLeading(
    deduped.slice(start, sliceEnd + 1),
    priorLast,
  );
}

/**
 * Visit ends when you leave: usually the next drive's start time. Mid-route stops
 * keep their last save when the next drive is far away in time (charger gap, etc.).
 * Overnight home can bridge a long sparse-GPS gap before the first outing.
 */
function pointSpeedMs(point: LocationPointRow): number | null {
  return point.speed;
}

function isStationarySave(point: LocationPointRow): boolean {
  const speed = pointSpeedMs(point);
  return speed == null || speed <= VISIT_ARRIVAL_SPEED_MS;
}

/** Saves after a road pause that still show movement into the lot (turn-in). */
const ROAD_PAUSE_LOOKAHEAD = 4;

/** First parked save in a stay cluster — turn-in pings before this belong on the drive. */
function findVisitArrivalIndex(
  points: LocationPointRow[],
  departureIndex: number,
): number {
  for (let index = 0; index <= departureIndex; index += 1) {
    if (!isStationarySave(points[index]!)) {
      continue;
    }
    // Red light / yield on the main road before turning into a parking lot —
    // the next few saves are still moving toward the store, not a real visit yet.
    const stillTurningIn = points
      .slice(
        index + 1,
        Math.min(index + 1 + ROAD_PAUSE_LOOKAHEAD, departureIndex + 1),
      )
      .some(point => !isStationarySave(point));
    if (stillTurningIn) {
      continue;
    }
    return index;
  }
  return 0;
}

/** Last parked save before leaving — departure pings belong on the next drive. */
function findVisitDepartureEndIndex(points: LocationPointRow[]): number {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (isStationarySave(points[index]!)) {
      return index;
    }
  }
  return points.length - 1;
}

/**
 * Clean visit/drive boundaries:
 * drive → … → arrival (#16329), visit = all in-area saves (sparse OK), next drive from departure.
 */
function isMidRouteVenueStop(stay: DetectedTrip): boolean {
  const minStopMs = MIN_TRIP_STOP_MINUTES * 60_000;
  if (stay.durationMs < minStopMs || stay.points.length === 0) {
    return false;
  }
  return stayMaxSpreadM(stay) <= MIN_STOP_CLUSTER_RADIUS_METERS * 2;
}

function normalizeVisitTravelBoundaries(trips: DetectedTrip[]): DetectedTrip[] {
  if (trips.length === 0) {
    return [];
  }

  const adjusted = trips.map(trip => ({...trip, points: [...trip.points]}));

  for (let index = 0; index < adjusted.length; index += 1) {
    const stay = adjusted[index]!;
    if (stay.kind !== 'stay' || stay.points.length === 0) {
      continue;
    }

    if (isMidRouteVenueStop(stay)) {
      continue;
    }

    const departureIndex = findVisitDepartureEndIndex(stay.points);
    const arrivalIndex = findVisitArrivalIndex(stay.points, departureIndex);
    const approach = stay.points.slice(0, arrivalIndex);
    const visitCore = stay.points.slice(arrivalIndex, departureIndex + 1);
    const departureLead = stay.points.slice(departureIndex + 1);

    adjusted[index] =
      visitCore.length > 0
        ? makeTrip(visitCore, 'stay', index)
        : {...stay, points: [], durationMs: 0};

    if (approach.length > 0) {
      const prevIndex = index - 1;
      if (prevIndex >= 0 && adjusted[prevIndex]!.kind === 'travel') {
        const prev = adjusted[prevIndex]!;
        const drivePoints = [...prev.points, ...approach];
        if (visitCore.length > 0) {
          const lastDrive = drivePoints[drivePoints.length - 1];
          const arrival = visitCore[0]!;
          if (lastDrive?.id !== arrival.id) {
            drivePoints.push(arrival);
          }
        }
        adjusted[prevIndex] = makeTrip(drivePoints, 'travel', prevIndex);
      }
    }

    if (departureLead.length > 0) {
      const nextIndex = index + 1;
      if (nextIndex < adjusted.length && adjusted[nextIndex]!.kind === 'travel') {
        const next = adjusted[nextIndex]!;
        adjusted[nextIndex] = makeTrip(
          [...departureLead, ...next.points],
          'travel',
          nextIndex,
        );
      }
    }
  }

  return adjusted.filter(
    trip =>
      trip.points.length > 0 &&
      (trip.kind === 'stay' || isMeaningfulTravel(trip)),
  );
}

function trimTripStart(trip: DetectedTrip, startAt: Date): DetectedTrip {
  const startMs = startAt.getTime();
  const points = trip.points.filter(point => point.timestamp.getTime() >= startMs);
  if (points.length === 0) {
    return {
      ...trip,
      startAt,
      durationMs: Math.max(0, differenceInMilliseconds(trip.endAt, startAt)),
    };
  }
  const remade = makeTrip(points, trip.kind, 0);
  return {
    ...remade,
    id: trip.id,
    materializedTripId: trip.materializedTripId,
    openThroughNow: trip.openThroughNow,
  };
}

function trimTripEnd(trip: DetectedTrip, endAt: Date): DetectedTrip {
  const endMs = endAt.getTime();
  const points = trip.points.filter(point => point.timestamp.getTime() <= endMs);
  if (points.length === 0) {
    return {
      ...trip,
      endAt,
      durationMs: Math.max(0, differenceInMilliseconds(endAt, trip.startAt)),
    };
  }
  const remade = makeTrip(points, trip.kind, 0);
  return {
    ...remade,
    id: trip.id,
    materializedTripId: trip.materializedTripId,
    openThroughNow: trip.openThroughNow,
  };
}

/**
 * Adjacent drive/visit cards must not overlap in time.
 * Arrival = drive ends → visit starts. Departure = visit ends → next drive starts.
 * See docs/timeline-model.md.
 */
function snapTripEndAt(trip: DetectedTrip, endAt: Date): DetectedTrip {
  if (trip.endAt.getTime() === endAt.getTime()) {
    return trip;
  }
  if (trip.endAt.getTime() < endAt.getTime()) {
    return {
      ...trip,
      endAt,
      durationMs: Math.max(0, differenceInMilliseconds(endAt, trip.startAt)),
    };
  }
  return trimTripEnd(trip, endAt);
}

function snapTripStartAt(trip: DetectedTrip, startAt: Date): DetectedTrip {
  if (trip.startAt.getTime() === startAt.getTime()) {
    return trip;
  }
  if (trip.startAt.getTime() > startAt.getTime()) {
    return {
      ...trip,
      startAt,
      durationMs: Math.max(0, differenceInMilliseconds(trip.endAt, startAt)),
    };
  }
  return trimTripStart(trip, startAt);
}

function mergeConsecutiveTravels(trips: DetectedTrip[]): DetectedTrip[] {
  const merged: DetectedTrip[] = [];

  for (const trip of trips) {
    const last = merged[merged.length - 1];
    if (last?.kind === 'travel' && trip.kind === 'travel') {
      merged[merged.length - 1] = makeTrip(
        [...last.points, ...trip.points],
        'travel',
        merged.length - 1,
      );
      continue;
    }
    merged.push(trip);
  }

  return merged;
}

function shouldBridgeBetweenStays(
  left: DetectedTrip,
  right: DetectedTrip,
): boolean {
  const gapMs = right.startAt.getTime() - left.endAt.getTime();
  if (gapMs > MIN_TIMELINE_GAP_MS) {
    return false;
  }
  const from = left.points[left.points.length - 1];
  const to = right.points[0];
  if (from == null || to == null) {
    return false;
  }
  const distM = distanceKm(from, to) * 1000;
  return distM >= MIN_TRAVEL_DISTANCE_M && distM <= SHORT_DEPARTURE_MAX_DIST_M;
}

function bridgeTravelBetweenStays(
  left: DetectedTrip,
  right: DetectedTrip,
): DetectedTrip | null {
  const from = left.points[left.points.length - 1];
  const to = right.points[0];
  if (from == null || to == null || from.id === to.id) {
    return null;
  }
  const travel = makeTrip([from, to], 'travel', 0);
  if (travel.distanceKm * 1000 < MIN_TRAVEL_DISTANCE_M) {
    return null;
  }
  return travel;
}

/** Rule 1: never drive→drive or visit→visit in the final timeline. */
function enforceStrictAlternation(
  trips: DetectedTrip[],
  config: TripDetectionConfig,
): DetectedTrip[] {
  let result = mergeConsecutiveTravels(trips);
  const resolved: DetectedTrip[] = [];
  let index = 0;

  while (index < result.length) {
    const current = result[index]!;
    index += 1;

    if (
      current.kind === 'stay' &&
      index < result.length &&
      result[index]!.kind === 'stay'
    ) {
      let combined = current;
      while (index < result.length && result[index]!.kind === 'stay') {
        const next = result[index]!;
        if (staysWithinMergeRadius(combined, next, config)) {
          combined = makeTrip(
            [...combined.points, ...next.points],
            'stay',
            resolved.length,
          );
          index += 1;
          continue;
        }

        const bridge = shouldBridgeBetweenStays(combined, next)
          ? bridgeTravelBetweenStays(combined, next)
          : null;
        resolved.push({
          ...combined,
          id: `stay-${resolved.length}-${combined.startAt.getTime()}`,
        });
        if (bridge != null) {
          resolved.push({
            ...bridge,
            id: `travel-${resolved.length}-${bridge.startAt.getTime()}`,
          });
        }
        combined = next;
        index += 1;
      }
      resolved.push({
        ...combined,
        id: `${combined.kind}-${resolved.length}-${combined.startAt.getTime()}`,
      });
      continue;
    }

    resolved.push({
      ...current,
      id: `${current.kind}-${resolved.length}-${current.startAt.getTime()}`,
    });
  }

  return mergeConsecutiveTravels(resolved);
}

function enforceAdjacentContinuity(trips: DetectedTrip[]): DetectedTrip[] {
  if (trips.length === 0) {
    return [];
  }

  const adjusted = trips.map(trip => ({...trip, points: [...trip.points]}));

  for (let index = 0; index < adjusted.length - 1; index += 1) {
    const left = adjusted[index]!;
    const right = adjusted[index + 1]!;

    if (left.kind === 'travel' && right.kind === 'stay') {
      const boundary = right.startAt;
      adjusted[index] = snapTripEndAt(left, boundary);
      adjusted[index + 1] = snapTripStartAt(right, boundary);
    }

    if (left.kind === 'stay' && right.kind === 'travel') {
      const boundary = right.startAt;
      adjusted[index] = snapTripEndAt(left, boundary);
      adjusted[index + 1] = snapTripStartAt(right, boundary);
    }
  }

  return adjusted.filter(
    trip =>
      trip.points.length > 0 &&
      trip.endAt.getTime() >= trip.startAt.getTime() &&
      (trip.kind === 'stay' ||
        isMeaningfulTravel(trip) ||
        isSparseTravelRoute(trip.points)),
  );
}

function closeStayEndsAtNextLeg(
  trips: DetectedTrip[],
  config: TripDetectionConfig,
): DetectedTrip[] {
  const adjusted = trips.map(trip => ({...trip}));

  for (let index = 0; index < adjusted.length - 1; index += 1) {
    const stay = adjusted[index]!;
    const travel = adjusted[index + 1]!;
    if (stay.kind !== 'stay' || travel.kind !== 'travel') {
      continue;
    }

    const lastPoint = stay.points[stay.points.length - 1]!;
    const lastSave = lastPoint.timestamp;
    const gapMs = travel.startAt.getTime() - lastSave.getTime();
    const anchor = stay.points[0]!;
    const departSave = travel.points[0]!;
    const leftArea =
      distanceKm(anchor, departSave) * 1000 > config.dwellRadiusMeters + 5;
    /** Last save still inside the visit envelope (lot drift can be ≫ dwell radius). */
    const lastStillAtStay =
      distanceKm(anchor, lastPoint) * 1000 <= MAX_STAY_ENVELOPE_SPREAD_M;
    const bridgeOvernightGap =
      index === 0 && leftArea && lastStillAtStay && gapMs > MAX_STAY_DEPARTURE_BRIDGE_MS;
    /** Charger / meal: no pings for 20+ min, then drive away — visit runs until that leg starts. */
    const bridgeStationaryGap =
      index > 0 &&
      leftArea &&
      lastStillAtStay &&
      gapMs > MAX_STAY_DEPARTURE_BRIDGE_MS &&
      gapMs <= SAVED_PLACE_DEPARTURE_GRACE_MS;
    const shortHopToNextStop =
      travel.durationMs < 2 * 60_000 &&
      travel.distanceKm * 1000 < 300;

    const endAt =
      (gapMs <= MAX_STAY_DEPARTURE_BRIDGE_MS && !shortHopToNextStop) ||
      bridgeOvernightGap ||
      bridgeStationaryGap
        ? travel.startAt
        : lastSave;

    if (endAt.getTime() <= stay.startAt.getTime()) {
      continue;
    }

    adjusted[index] = {
      ...stay,
      endAt,
      durationMs: differenceInMilliseconds(endAt, stay.startAt),
    };
  }

  return adjusted;
}

function dropNoiseTravels(trips: DetectedTrip[]): DetectedTrip[] {
  return trips.filter(trip => trip.kind !== 'travel' || isMeaningfulTravel(trip));
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

export function firstPlayableTimelineIndex(
  entries: DayTimelineEntry[],
): number {
  for (let index = 0; index < entries.length; index += 1) {
    if (isPlayableTimelineEntry(entries[index]!)) {
      return index;
    }
  }
  return -1;
}

export function lastPlayableTimelineIndex(
  entries: DayTimelineEntry[],
): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (isPlayableTimelineEntry(entries[index]!)) {
      return index;
    }
  }
  return -1;
}

export function findNextPlayableTimelineIndex(
  entries: DayTimelineEntry[],
  fromIndex: number,
): number {
  for (let index = fromIndex + 1; index < entries.length; index += 1) {
    if (isPlayableTimelineEntry(entries[index]!)) {
      return index;
    }
  }
  return -1;
}

export function findPrevPlayableTimelineIndex(
  entries: DayTimelineEntry[],
  fromIndex: number,
): number {
  for (let index = fromIndex - 1; index >= 0; index -= 1) {
    if (isPlayableTimelineEntry(entries[index]!)) {
      return index;
    }
  }
  return -1;
}

type StaySpan = {start: number; end: number};

const SAVED_PLACE_MIN_DWELL_MS = SAVED_PLACE_MIN_DWELL_MINUTES * 60_000;
/** Brief GPS drift outside a saved-place radius does not end the visit. */
const SAVED_PLACE_DEPARTURE_GRACE_MS = 10 * 60_000;

function pointAtSavedPlace(
  point: LocationPointRow,
  place: SavedPlaceRow,
): boolean {
  return distanceKm(point, place) * 1000 <= place.radiusMeters;
}

function awayMsBetweenIndices(
  points: LocationPointRow[],
  fromIndex: number,
  toIndex: number,
  place: SavedPlaceRow,
): number {
  if (toIndex <= fromIndex + 1) {
    return 0;
  }

  let awayMs = 0;
  let awaySince: number | null = null;
  for (let index = fromIndex + 1; index < toIndex; index += 1) {
    const timestampMs = points[index]!.timestamp.getTime();
    if (pointAtSavedPlace(points[index]!, place)) {
      if (awaySince != null) {
        awayMs += timestampMs - awaySince;
        awaySince = null;
      }
    } else if (awaySince == null) {
      awaySince = timestampMs;
    }
  }

  if (awaySince != null) {
    awayMs += points[toIndex]!.timestamp.getTime() - awaySince;
  }

  return awayMs;
}

function mergeStaySpans(spans: StaySpan[]): StaySpan[] {
  if (spans.length === 0) {
    return [];
  }

  const sorted = [...spans].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  const merged: StaySpan[] = [{...sorted[0]!}];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]!;
    const previous = merged[merged.length - 1]!;
    if (current.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, current.end);
    } else {
      merged.push({...current});
    }
  }

  return merged;
}

/**
 * Saved places: any saves within the place radius (typically 150 m from center).
 * Qualifies at ≥ 1 minute; brief excursions outside the radius are GPS drift.
 */
/** @internal Test helper */
export function findSavedPlaceStaySpans(
  points: LocationPointRow[],
  places: readonly SavedPlaceRow[],
): StaySpan[] {
  if (points.length === 0 || places.length === 0) {
    return [];
  }

  const spans: StaySpan[] = [];

  for (const place of places) {
    let index = 0;
    while (index < points.length) {
      while (
        index < points.length &&
        !pointAtSavedPlace(points[index]!, place)
      ) {
        index += 1;
      }
      if (index >= points.length) {
        break;
      }

      const start = index;
      let lastAtPlace = index;
      index += 1;

      while (index < points.length) {
        if (pointAtSavedPlace(points[index]!, place)) {
          lastAtPlace = index;
          index += 1;
          continue;
        }

        let nextAtPlace = index;
        while (
          nextAtPlace < points.length &&
          !pointAtSavedPlace(points[nextAtPlace]!, place)
        ) {
          nextAtPlace += 1;
        }
        if (nextAtPlace >= points.length) {
          break;
        }

        const awayMs = awayMsBetweenIndices(
          points,
          lastAtPlace,
          nextAtPlace,
          place,
        );
        if (awayMs <= SAVED_PLACE_DEPARTURE_GRACE_MS) {
          lastAtPlace = nextAtPlace;
          index = nextAtPlace + 1;
        } else {
          break;
        }
      }

      const spanMs =
        points[lastAtPlace]!.timestamp.getTime() -
        points[start]!.timestamp.getTime();
      const atEndOfDay = lastAtPlace === points.length - 1;
      if (spanMs >= SAVED_PLACE_MIN_DWELL_MS || atEndOfDay) {
        spans.push({start, end: lastAtPlace});
      }
    }
  }

  return mergeStaySpans(spans);
}

function clipGenericSpansAtSavedPlaceDepartures(
  generic: StaySpan[],
  saved: StaySpan[],
): StaySpan[] {
  if (saved.length === 0) {
    return generic;
  }

  return generic.flatMap(span => {
    let end = span.end;
    for (const savedSpan of saved) {
      if (span.start <= savedSpan.end && span.end >= savedSpan.start) {
        end = Math.min(end, savedSpan.end);
      }
    }
    if (end < span.start) {
      return [];
    }
    return [{start: span.start, end}];
  });
}

function findAllStaySpans(
  points: LocationPointRow[],
  config: TripDetectionConfig,
  savedPlaces: readonly SavedPlaceRow[],
): StaySpan[] {
  const generic = mergeStaySpansAcrossSparseGaps(
    points,
    findStaySpans(points, config),
    config,
  );
  if (savedPlaces.length === 0) {
    return generic;
  }
  const saved = findSavedPlaceStaySpans(points, savedPlaces);
  return mergeStaySpans([
    ...clipGenericSpansAtSavedPlaceDepartures(generic, saved),
    ...saved,
  ]);
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

function growSpreadEnvelopeCluster(
  points: LocationPointRow[],
  startIndex: number,
  maxSpreadM: number,
): number {
  let end = startIndex;
  while (end + 1 < points.length) {
    const next = points[end + 1]!;
    if (maxSpreadFromAnchorM(points, startIndex, end + 1) > maxSpreadM) {
      break;
    }
    if (isShortGapDeparture(points[end]!, next)) {
      break;
    }
    end += 1;
  }
  return end;
}

function growVenueEnvelopeCluster(
  points: LocationPointRow[],
  startIndex: number,
): number {
  return growSpreadEnvelopeCluster(points, startIndex, VENUE_MAX_SPREAD_M);
}

function isVenueWalkCluster(clusterPoints: LocationPointRow[]): boolean {
  const pathM = calculatePathDistanceKm(clusterPoints) * 1000;
  const spreadM = maxSpreadFromAnchorM(
    clusterPoints,
    0,
    clusterPoints.length - 1,
  );
  if (spreadM <= MAX_STOP_CLUSTER_PATH_M) {
    return false;
  }
  if (pathM / spreadM < VENUE_MIN_PATH_SPREAD_RATIO) {
    return false;
  }
  const netM =
    distanceKm(
      clusterPoints[0]!,
      clusterPoints[clusterPoints.length - 1]!,
    ) * 1000;
  return spreadM > 0 && netM / spreadM <= VENUE_MAX_NET_SPREAD_RATIO;
}

/** Peel mall-style walking off the end of a long drive (GPS hops are > 25 m apart). */
function findVenueWalkTailStart(
  points: LocationPointRow[],
  minDwellMs: number,
): number | null {
  for (let start = 0; start < points.length; start += 1) {
    const venueEnd = growVenueEnvelopeCluster(points, start);
    if (venueEnd !== points.length - 1) {
      continue;
    }
    const spanMs =
      points[venueEnd]!.timestamp.getTime() -
      points[start]!.timestamp.getTime();
    if (spanMs < minDwellMs) {
      continue;
    }
    if (isVenueWalkCluster(points.slice(start, venueEnd + 1))) {
      return start;
    }
  }
  return null;
}

function peelVenueWalkTail(
  travel: DetectedTrip,
  config: TripDetectionConfig,
): DetectedTrip[] {
  const minDwellMs = config.dwellMinutes * 60_000;
  const tailStart = findVenueWalkTailStart(travel.points, minDwellMs);
  if (tailStart == null || tailStart === 0) {
    return [travel];
  }

  const drivePoints = travel.points.slice(0, tailStart);
  const visitPoints = travel.points.slice(tailStart);
  const pieces: DetectedTrip[] = [];

  if (drivePoints.length > 0) {
    const drive = makeTrip(drivePoints, 'travel', 0);
    if (isMeaningfulTravel(drive)) {
      pieces.push(drive);
    }
  }
  if (visitPoints.length > 0) {
    pieces.push(makeTrip(visitPoints, 'stay', pieces.length));
  }

  return pieces.length > 0 ? pieces : [travel];
}

/**
 * Stay = saves that stay within {@link MAX_STAY_ENVELOPE_SPREAD_M} of the arrival
 * anchor (spread, not GPS path length — lot drift can walk hundreds of meters).
 * Qualifies when span ≥ dwell minutes, last cluster (open visit), or a mid-route
 * stop (≥ {@link MIN_TRIP_STOP_MINUTES} between movement — e.g. food, charger).
 */
/** @internal Test helper */
export function findStaySpans(
  points: LocationPointRow[],
  config: TripDetectionConfig,
): StaySpan[] {
  if (points.length === 0) {
    return [];
  }

  const minDwellMs = config.dwellMinutes * 60_000;
  const minTripStopMs = MIN_TRIP_STOP_MINUTES * 60_000;
  const spans: StaySpan[] = [];
  let index = 0;

  while (index < points.length) {
    const end = growSpreadEnvelopeCluster(
      points,
      index,
      MAX_STAY_ENVELOPE_SPREAD_M,
    );
    const spanMs =
      points[end]!.timestamp.getTime() - points[index]!.timestamp.getTime();
    const betweenMovement = index > 0 && end < points.length - 1;
    const atEndOfDay = end === points.length - 1;
    const midRouteStop = betweenMovement && spanMs >= minTripStopMs;
    const spreadM = maxSpreadFromAnchorM(points, index, end);
    const stationary = spreadM <= MAX_STAY_ENVELOPE_SPREAD_M;

    if (
      stationary &&
      (spanMs >= minDwellMs || atEndOfDay || midRouteStop)
    ) {
      spans.push({start: index, end});
      index = end + 1;
    } else {
      index = end + 1;
    }
  }

  return spans;
}

function isSamePlaceSparseGapResume(
  points: LocationPointRow[],
  previous: StaySpan,
  next: StaySpan,
  config: TripDetectionConfig,
): boolean {
  if (next.start <= previous.end) {
    return false;
  }
  const gapMs =
    points[next.start]!.timestamp.getTime() -
    points[previous.end]!.timestamp.getTime();
  if (gapMs < STALE_WAKE_MIN_GAP_MS || gapMs > SAME_PLACE_SPARSE_GAP_MAX_MS) {
    return false;
  }
  const lastPrev = points[previous.end]!;
  const firstNext = points[next.start]!;
  if (arePointsSamePlace(lastPrev, firstNext, config)) {
    return true;
  }
  return distanceKm(lastPrev, firstNext) * 1000 <= VENUE_MAX_SPREAD_M;
}

/** @internal Test helper */
export function mergeStaySpansAcrossSparseGaps(
  points: LocationPointRow[],
  spans: StaySpan[],
  config: TripDetectionConfig,
): StaySpan[] {
  if (spans.length <= 1) {
    return spans;
  }

  const minDwellMs = config.dwellMinutes * 60_000;
  const merged: StaySpan[] = [spans[0]!];

  for (let index = 1; index < spans.length; index += 1) {
    const current = spans[index]!;
    const previous = merged[merged.length - 1]!;

    if (
      isSamePlaceSparseGapResume(points, previous, current, config) &&
      points[current.end]!.timestamp.getTime() -
        points[previous.start]!.timestamp.getTime() >=
        minDwellMs
    ) {
      merged[merged.length - 1] = {
        start: previous.start,
        end: current.end,
      };
      continue;
    }

    merged.push(current);
  }

  return merged;
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

function stayMaxSpreadM(stay: DetectedTrip): number {
  if (stay.points.length === 0) {
    return 0;
  }
  return maxSpreadFromAnchorM(stay.points, 0, stay.points.length - 1);
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
  if (closestStayDistanceM(previous, next) <= limitM) {
    return true;
  }

  // Same large venue split by sparse GPS (e.g. ice skating with no pings).
  return closestStayDistanceM(previous, next) <= VENUE_MAX_SPREAD_M;
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
        const travelDistanceM = next.distanceKm * 1000;
        const absorbsVenueHop =
          afterTravel.kind === 'stay' &&
          staysWithinMergeRadius(current, afterTravel, config) &&
          travelDistanceM <= VENUE_MAX_SPREAD_M + 200 &&
          next.durationMs <= 15 * 60_000 &&
          stayMaxSpreadM(current) >= MAX_STOP_CLUSTER_PATH_M &&
          stayMaxSpreadM(afterTravel) >= MAX_STOP_CLUSTER_PATH_M;
        if (
          absorbsVenueHop ||
          (!isMeaningfulTravel(next) &&
            afterTravel.kind === 'stay' &&
            staysWithinMergeRadius(current, afterTravel, config))
        ) {
          current = makeTrip(
            absorbsVenueHop
              ? [...current.points, ...next.points, ...afterTravel.points]
              : [...current.points, ...afterTravel.points],
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

function growPlaceClusterFromAnchor(
  points: LocationPointRow[],
  startIndex: number,
  radiusKm: number,
): number {
  const anchor = points[startIndex]!;
  let end = startIndex;
  while (
    end + 1 < points.length &&
    distanceKm(anchor, points[end + 1]!) <= radiusKm
  ) {
    end += 1;
  }
  return end;
}

/** Find pauses inside a drive (wide radius — parking lots drift > 25 m). */
function findStopSpansInTravel(
  points: LocationPointRow[],
  momentTimestamps: readonly Date[] = [],
): StaySpan[] {
  if (points.length < 2) {
    return [];
  }

  const wideRadiusKm = MIN_STOP_CLUSTER_RADIUS_METERS / 1000;
  const minTripStopMs = MIN_TRIP_STOP_MINUTES * 60_000;
  const spans: StaySpan[] = [];
  let index = 0;

  while (index < points.length) {
    const end = growPlaceClusterFromAnchor(points, index, wideRadiusKm);
    const spanMs =
      points[end]!.timestamp.getTime() - points[index]!.timestamp.getTime();
    const clusterPoints = points.slice(index, end + 1);
    const stationary =
      calculatePathDistanceKm(clusterPoints) * 1000 <= MAX_STOP_CLUSTER_PATH_M;
    const interior = index > 0 && end < points.length - 1;
    const arrivalStop = end === points.length - 1 && index > 0;

    if (
      stationary &&
      (interior || arrivalStop) &&
      spanMs >= minTripStopMs
    ) {
      const stopStartMs = points[index]!.timestamp.getTime();
      const stopEndMs = points[end]!.timestamp.getTime();
      if (!spanOverlapsMoment(stopStartMs, stopEndMs, momentTimestamps)) {
        spans.push({start: index, end});
      }
    }

    index = end + 1;
  }

  return spans;
}

function prependDeparturePoint(
  slice: LocationPointRow[],
  departFrom: LocationPointRow | null,
): LocationPointRow[] {
  if (
    slice.length === 0 ||
    departFrom == null ||
    slice[0]!.id === departFrom.id
  ) {
    return slice;
  }
  if (isShortGapDeparture(departFrom, slice[0]!)) {
    return [departFrom, ...slice];
  }
  return slice;
}

function splitTravelAtInteriorStops(
  travel: DetectedTrip,
  startTripIndex: number,
  momentTimestamps: readonly Date[] = [],
): DetectedTrip[] {
  const stops = findStopSpansInTravel(travel.points, momentTimestamps);
  if (stops.length === 0) {
    return [travel];
  }

  const pieces: DetectedTrip[] = [];
  let tripIndex = startTripIndex;
  let cursor = 0;
  let lastStopDepartFrom: LocationPointRow | null = null;

  for (const stop of stops) {
    if (stop.start > cursor) {
      let slice = travel.points.slice(cursor, stop.start);
      slice = prependDeparturePoint(slice, lastStopDepartFrom);
      if (slice.length > 0) {
        const leg = makeTrip(slice, 'travel', tripIndex);
        if (isMeaningfulTravel(leg)) {
          pieces.push(leg);
          tripIndex += 1;
        }
      }
    }

    pieces.push(
      makeTrip(travel.points.slice(stop.start, stop.end + 1), 'stay', tripIndex),
    );
    tripIndex += 1;
    lastStopDepartFrom = travel.points[stop.end]!;
    cursor = stop.end + 1;
  }

  if (cursor < travel.points.length) {
    let tail = travel.points.slice(cursor);
    tail = prependDeparturePoint(tail, lastStopDepartFrom);
    if (tail.length > 0) {
      const leg = makeTrip(tail, 'travel', tripIndex);
      if (isMeaningfulTravel(leg)) {
        pieces.push(leg);
      }
    }
  }

  return pieces.length > 0 ? pieces : [travel];
}

function splitTravelAtStops(
  travel: DetectedTrip,
  startTripIndex: number,
  config: TripDetectionConfig,
  momentTimestamps: readonly Date[] = [],
): DetectedTrip[] {
  const peeled = peelVenueWalkTail(travel, config);
  const pieces: DetectedTrip[] = [];
  let tripIndex = startTripIndex;

  for (const segment of peeled) {
    if (segment.kind === 'stay') {
      pieces.push({
        ...segment,
        id: `stay-${tripIndex}-${segment.startAt.getTime()}`,
      });
      tripIndex += 1;
      continue;
    }

    const split = splitTravelAtInteriorStops(
      segment,
      tripIndex,
      momentTimestamps,
    );
    pieces.push(...split);
    tripIndex += split.length;
  }

  return pieces.length > 0 ? pieces : [travel];
}

function splitTravelsAtStops(
  trips: DetectedTrip[],
  config: TripDetectionConfig,
  momentTimestamps: readonly Date[] = [],
): DetectedTrip[] {
  const split: DetectedTrip[] = [];
  let tripIndex = 0;

  for (const trip of trips) {
    if (trip.kind === 'travel') {
      const pieces = splitTravelAtStops(
        trip,
        tripIndex,
        config,
        momentTimestamps,
      );
      split.push(...pieces);
      tripIndex += pieces.length;
    } else {
      split.push({...trip, id: `${trip.kind}-${tripIndex}-${trip.startAt.getTime()}`});
      tripIndex += 1;
    }
  }

  return split;
}

/** Rejoin drive → brief stop → drive when the stop was a moment capture pause. */
function collapseMomentCaptureStays(
  trips: DetectedTrip[],
  momentTimestamps: readonly Date[],
  config: TripDetectionConfig,
): DetectedTrip[] {
  if (momentTimestamps.length === 0 || trips.length < 3) {
    return trips;
  }

  const maxCollapseStayMs = config.dwellMinutes * 60_000;
  const merged: DetectedTrip[] = [];
  let index = 0;

  while (index < trips.length) {
    const current = trips[index]!;
    const next = trips[index + 1];
    const after = trips[index + 2];

    if (
      current.kind === 'travel' &&
      next?.kind === 'stay' &&
      after?.kind === 'travel' &&
      next.durationMs < maxCollapseStayMs &&
      spanOverlapsMoment(
        next.startAt.getTime(),
        next.endAt.getTime(),
        momentTimestamps,
      )
    ) {
      merged.push(
        makeTrip(
          [...current.points, ...next.points, ...after.points],
          'travel',
          merged.length,
        ),
      );
      index += 3;
      continue;
    }

    merged.push({
      ...current,
      id: `${current.kind}-${merged.length}-${current.startAt.getTime()}`,
    });
    index += 1;
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
 * Product rules: docs/timeline-model.md
 * - Stay: ≥ dwell minutes in one area, or open visit through last save.
 * - Trip: saves from the moment you leave until the next stay begins.
 * - Gap: no rows in DB and next save is far away (not same-area hole).
 */
export function detectTrips(
  points: LocationPointRow[],
  config: TripDetectionConfig,
  options: TripTimelineOptions = {},
): DetectedTrip[] {
  return detectTripsFromPoints(points, config, options);
}

function inferPrimaryDateKey(points: LocationPointRow[]): string {
  if (points.length === 0) {
    return toDateKey(new Date());
  }
  const counts = new Map<string, number>();
  for (const point of points) {
    const key = toDateKey(point.timestamp);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0]!;
}

export function buildDayTimeline(
  points: LocationPointRow[],
  config: TripDetectionConfig,
  options: TripTimelineOptions = {},
): DayTimelineEntry[] {
  const dateKey = inferPrimaryDateKey(points);
  return buildSegmentationTimeline(dateKey, points, config, options);
}

/** @deprecated Use mergeAdjacentSameAreaStays */
export function mergeSameAreaTrips(
  trips: DetectedTrip[],
  config: TripDetectionConfig,
): DetectedTrip[] {
  return mergeAdjacentSameAreaStays(trips, config);
}

export function buildDayTimelineNewestFirst(
  points: LocationPointRow[],
  config: TripDetectionConfig,
  options: TripTimelineOptions = {},
): DayTimelineEntry[] {
  return [...buildDayTimeline(points, config, options)].reverse();
}

/** @deprecated Use buildDayTimelineNewestFirst */
export function detectTripsNewestFirst(
  points: LocationPointRow[],
  config: TripDetectionConfig,
  options: TripTimelineOptions = {},
): DetectedTrip[] {
  return [...detectTrips(points, config, options)].reverse();
}

const LONG_GAP_BEFORE_TRAVEL_MS = 10 * 60_000;
const DEPARTURE_BRIDGE_M = 80;

function previousStayDepartureAnchor(
  stay: DetectedTrip,
): LocationPointRow | null {
  if (stay.points.length === 0) {
    return null;
  }

  const last = stay.points[stay.points.length - 1]!;
  const marker = stayMapMarkerCoordinate(stay);
  const markerDistM =
    distanceKm(
      {lat: last.lat, lng: last.lng},
      {lat: marker.latitude, lng: marker.longitude},
    ) * 1000;

  // Materialized rows can end on the departure road — anchor at the visit pin instead.
  if (markerDistM > DEPARTURE_BRIDGE_M) {
    return {
      ...last,
      lat: marker.latitude,
      lng: marker.longitude,
    };
  }

  return last;
}

function shouldBridgeDeparture(
  anchor: LocationPointRow,
  points: LocationPointRow[],
): boolean {
  if (points.length === 0) {
    return false;
  }
  return distanceKm(points[0]!, anchor) * 1000 > DEPARTURE_BRIDGE_M;
}

function minDistanceToStayM(
  point: LocationPointLike,
  stay: DetectedTrip,
): number {
  let minM = Number.POSITIVE_INFINITY;
  for (const save of stay.points) {
    minM = Math.min(minM, distanceKm(point, save) * 1000);
  }
  return minM;
}

/**
 * History map route: drop GPS-wake points at an earlier stop after a long gap, and
 * prepend the prior visit's last save so the line starts where you actually were (e.g. Tesla).
 */
export function staysBeforeEntryIndex(
  entries: DayTimelineEntry[],
  index: number,
): DetectedTrip[] {
  const stays: DetectedTrip[] = [];
  for (let entryIndex = 0; entryIndex < index; entryIndex += 1) {
    const entry = entries[entryIndex]!;
    if (entry.kind === 'stay') {
      stays.push(entry);
    }
  }
  return stays;
}

export function stayBeforeEntryIndex(
  entries: DayTimelineEntry[],
  index: number,
): DetectedTrip | null {
  for (let entryIndex = index - 1; entryIndex >= 0; entryIndex -= 1) {
    const entry = entries[entryIndex]!;
    if (entry.kind === 'stay') {
      return entry;
    }
  }
  return null;
}

export function stayAfterEntryIndex(
  entries: DayTimelineEntry[],
  index: number,
): DetectedTrip | null {
  for (let entryIndex = index + 1; entryIndex < entries.length; entryIndex += 1) {
    const entry = entries[entryIndex]!;
    if (entry.kind === 'stay') {
      return entry;
    }
  }
  return null;
}

export function adjacentStaysForTravelIndex(
  entries: DayTimelineEntry[],
  travelIndex: number,
): {
  previousStay: DetectedTrip | null;
  nextStay: DetectedTrip | null;
} {
  return {
    previousStay: stayBeforeEntryIndex(entries, travelIndex),
    nextStay: stayAfterEntryIndex(entries, travelIndex),
  };
}

export function getTravelDisplayPoints(
  travel: DetectedTrip,
  previousStay: DetectedTrip | null,
  otherStays: DetectedTrip[],
  config: TripDetectionConfig,
): LocationPointRow[] {
  if (travel.points.length === 0) {
    return travel.points;
  }

  let points = travel.points;
  const limitM = config.dwellRadiusMeters + 15;
  const departureAnchor = previousStay
    ? previousStayDepartureAnchor(previousStay)
    : null;
  const lastStaySave = departureAnchor;
  const gapMs = departureAnchor
    ? travel.startAt.getTime() - departureAnchor.timestamp.getTime()
    : 0;

  if (previousStay && gapMs >= LONG_GAP_BEFORE_TRAVEL_MS) {
    let start = 0;
    while (start < points.length - 2) {
      const point = points[start]!;
      if (minDistanceToStayM(point, previousStay) <= limitM) {
        break;
      }
      const nearOtherStay = otherStays.some(
        stay =>
          stay.id !== previousStay.id &&
          minDistanceToStayM(point, stay) <= limitM,
      );
      if (!nearOtherStay) {
        break;
      }
      start += 1;
    }
    if (start > 0) {
      points = points.slice(start);
    }
  }

  if (
    previousStay &&
    departureAnchor &&
    shouldBridgeDeparture(departureAnchor, points) &&
    points[0] !== departureAnchor
  ) {
    return [departureAnchor, ...points];
  }

  return points;
}

function mergeRoutePoints(
  base: LocationPointRow[],
  extra: LocationPointRow[],
): LocationPointRow[] {
  if (extra.length === 0) {
    return base;
  }
  const merged = [...base];
  let lastId = merged[merged.length - 1]?.id;
  for (const point of extra) {
    if (point.id === lastId) {
      continue;
    }
    merged.push(point);
    lastId = point.id;
  }
  return merged;
}

function sortedStayPoints(stay: DetectedTrip): LocationPointRow[] {
  return [...stay.points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
}

/** Turn-in saves before the parked arrival — belong on the solid inbound drive. */
export function visitArrivalPointsForInbound(visit: DetectedTrip): LocationPointRow[] {
  const sorted = sortedStayPoints(visit);
  if (sorted.length === 0) {
    return [];
  }
  const departureIndex = findVisitDepartureEndIndex(sorted);
  const arrivalIndex = findVisitArrivalIndex(sorted, departureIndex);
  return sorted.slice(0, arrivalIndex + 1);
}

/** In-area saves after arrival and before departure — movement inside the visit. */
export function visitCorePoints(visit: DetectedTrip): LocationPointRow[] {
  const sorted = sortedStayPoints(visit);
  if (sorted.length === 0) {
    return [];
  }
  const departureIndex = findVisitDepartureEndIndex(sorted);
  const arrivalIndex = findVisitArrivalIndex(sorted, departureIndex);
  return sorted.slice(arrivalIndex, departureIndex + 1);
}

/** Map display uses in-area core — not turn-in pings still attached to the visit row. */
export function stayMapDisplayPoints(stay: DetectedTrip): LocationPointRow[] {
  if (stay.kind !== 'stay') {
    return stay.points;
  }
  const core = visitCorePoints(stay);
  return core.length > 0 ? core : stay.points;
}

export function stayMapCentroid(stay: DetectedTrip): {
  latitude: number;
  longitude: number;
} {
  const displayPoints = stayMapDisplayPoints(stay);
  if (displayPoints.length === 0) {
    return stayTripCentroid(stay);
  }
  return stayTripCentroid({...stay, points: displayPoints});
}

export function stayMapMarkerCoordinate(
  stay: DetectedTrip,
  options?: {ongoing?: boolean},
): {latitude: number; longitude: number} {
  if (options?.ongoing && stay.points.length > 0) {
    return stayTripMarkerCoordinate(stay, options);
  }
  return stayMapCentroid(stay);
}

/** Dashed map paths for wandering inside the orange visit area. */
export function shouldDrawVisitInAreaPaths(visit: DetectedTrip): boolean {
  const core = visitCorePoints(visit);
  if (core.length < 3) {
    return false;
  }
  const spreadM = maxSpreadFromAnchorM(core, 0, core.length - 1);
  if (spreadM < MIN_VISIT_IN_AREA_SPREAD_M) {
    return false;
  }
  const pathM = calculatePathDistanceKm(core) * 1000;
  return pathM >= MIN_VISIT_IN_AREA_PATH_M;
}

export function visitInAreaRouteSegments(
  visit: DetectedTrip,
  config: TripDetectionConfig,
): {latitude: number; longitude: number}[][] {
  if (!shouldDrawVisitInAreaPaths(visit)) {
    return [];
  }
  return buildDrawableRouteSegments(visitCorePoints(visit), config);
}

export function extendTravelToVisitArrival(
  travelPoints: LocationPointRow[],
  visit: DetectedTrip | null,
): LocationPointRow[] {
  if (visit == null) {
    return travelPoints;
  }
  return mergeRoutePoints(travelPoints, visitArrivalPointsForInbound(visit));
}

/**
 * History visit map: inbound drive through turn-in until the visit arrival save.
 */
export function getVisitInboundTravelPoints(
  inboundTravel: DetectedTrip,
  visit: DetectedTrip,
  previousStay: DetectedTrip | null,
  otherStays: DetectedTrip[],
  config: TripDetectionConfig,
): LocationPointRow[] {
  const base = getTravelDisplayPoints(
    inboundTravel,
    previousStay,
    otherStays,
    config,
  );
  return mergeRoutePoints(base, visitArrivalPointsForInbound(visit));
}

/** @deprecated Use visitInAreaRouteSegments — only tiny parking-lot bridges if needed. */
export const VISIT_CONNECTOR_MIN_GAP_M = 8;
/** @deprecated Use visitInAreaRouteSegments for in-area movement. */
export const VISIT_CONNECTOR_MAX_GAP_M = 35;

/**
 * @deprecated Prefer visitInAreaRouteSegments. Short bridge only when arrival save
 * is still a few meters outside the drawn visit pin.
 */
export function visitApproachConnectorCoordinates(
  routePoints: LocationPointRow[],
  visit: DetectedTrip,
  minGapM = VISIT_CONNECTOR_MIN_GAP_M,
  maxGapM = VISIT_CONNECTOR_MAX_GAP_M,
): {latitude: number; longitude: number}[] | null {
  if (routePoints.length === 0 || visit.points.length === 0) {
    return null;
  }

  const last = routePoints[routePoints.length - 1]!;
  const target = stayTripMarkerCoordinate(visit);
  const gapM =
    distanceKm(
      {lat: last.lat, lng: last.lng},
      {lat: target.latitude, lng: target.longitude},
    ) * 1000;

  if (gapM < minGapM || gapM > maxGapM) {
    return null;
  }

  return [
    {latitude: last.lat, longitude: last.lng},
    {latitude: target.latitude, longitude: target.longitude},
  ];
}

/** Radius for picking the densest visit cluster (ignores approach/departure along roads). */
const STAY_CENTROID_CLUSTER_M = 80;

/**
 * Map placement for visit circle and pin — mean of the densest GPS cluster,
 * not the middle index (approach/departure legs skew that on quick stops).
 */
export function stayTripCentroid(trip: DetectedTrip): {
  latitude: number;
  longitude: number;
} {
  const points = trip.points;
  if (points.length === 0) {
    return {latitude: 0, longitude: 0};
  }
  if (points.length === 1) {
    const only = points[0]!;
    return {latitude: only.lat, longitude: only.lng};
  }

  let bestAnchor = points[0]!;
  let bestNeighbors = 0;
  for (const candidate of points) {
    const neighbors = points.filter(
      p => distanceKm(candidate, p) * 1000 <= STAY_CENTROID_CLUSTER_M,
    ).length;
    if (neighbors > bestNeighbors) {
      bestNeighbors = neighbors;
      bestAnchor = candidate;
    }
  }

  const core = points.filter(
    p => distanceKm(bestAnchor, p) * 1000 <= STAY_CENTROID_CLUSTER_M,
  );
  return {
    latitude: core.reduce((sum, p) => sum + p.lat, 0) / core.length,
    longitude: core.reduce((sum, p) => sum + p.lng, 0) / core.length,
  };
}

/**
 * Map pin for the visit time label.
 * Ongoing visit → latest save; completed visit → centroid (center of orange circle).
 */
export function stayTripMarkerCoordinate(
  trip: DetectedTrip,
  options?: {ongoing?: boolean},
): {latitude: number; longitude: number} {
  if (options?.ongoing && trip.points.length > 0) {
    const sorted = [...trip.points].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
    const point = sorted[sorted.length - 1]!;
    return {
      latitude: point.lat,
      longitude: point.lng,
    };
  }
  return stayTripCentroid(trip);
}
