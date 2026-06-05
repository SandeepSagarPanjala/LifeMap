import {differenceInMilliseconds} from 'date-fns';

import type {LocationPointRow} from '@/db/repositories/location-days';
import {calculatePathDistanceKm, distanceKm} from '@/lib/location-geo';
import type {LocationPointLike} from '@/lib/location-geo';
import {
  MIN_STOP_CLUSTER_RADIUS_METERS,
  MIN_TRIP_STOP_MINUTES,
  type TripDetectionConfig,
} from '@/lib/trip-settings';

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

/** Stay cluster path above this is driving, not a stop (parking-lot drift is much smaller). */
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
  /** Real hops (e.g. Whataburger → Tesla lot) can be short but hundreds of meters. */
  if (distanceM >= 100) {
    return true;
  }
  if (trip.durationMs < 60_000 && distanceM < MIN_TRAVEL_DISTANCE_M) {
    return false;
  }
  return distanceM >= MIN_TRAVEL_DISTANCE_M;
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
    const lastNearAnchor =
      distanceKm(anchor, lastPoint) * 1000 <= config.dwellRadiusMeters + 5;
    const bridgeOvernightGap =
      index === 0 && leftArea && lastNearAnchor && gapMs > MAX_STAY_DEPARTURE_BRIDGE_MS;
    /** Charger / meal: no pings for 20+ min, then drive away — visit runs until that leg starts. */
    const bridgeStationaryGap =
      index > 0 &&
      leftArea &&
      lastNearAnchor &&
      gapMs > MAX_STAY_DEPARTURE_BRIDGE_MS;
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

type StaySpan = {start: number; end: number};

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

function growVenueEnvelopeCluster(
  points: LocationPointRow[],
  startIndex: number,
): number {
  let end = startIndex;
  while (end + 1 < points.length) {
    if (
      maxSpreadFromAnchorM(points, startIndex, end + 1) > VENUE_MAX_SPREAD_M
    ) {
      break;
    }
    end += 1;
  }
  return end;
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

function growPlaceCluster(
  points: LocationPointRow[],
  startIndex: number,
  radiusKm: number,
): number {
  let end = startIndex;
  while (end + 1 < points.length) {
    const next = points[end + 1]!;
    let inCluster = false;
    for (let k = startIndex; k <= end; k += 1) {
      if (distanceKm(points[k]!, next) <= radiusKm) {
        inCluster = true;
        break;
      }
    }
    if (!inCluster) {
      break;
    }
    end += 1;
  }
  return end;
}

/**
 * Stay = saves within dwell radius of the visit anchor (first save in the cluster).
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

  const radiusKm = config.dwellRadiusMeters / 1000;
  const minDwellMs = config.dwellMinutes * 60_000;
  const minTripStopMs = MIN_TRIP_STOP_MINUTES * 60_000;
  const spans: StaySpan[] = [];
  let index = 0;

  while (index < points.length) {
    const end = growPlaceCluster(points, index, radiusKm);
    const spanMs =
      points[end]!.timestamp.getTime() - points[index]!.timestamp.getTime();
    const betweenMovement = index > 0 && end < points.length - 1;
    const atEndOfDay = end === points.length - 1;
    const midRouteStop = betweenMovement && spanMs >= minTripStopMs;
    const clusterPoints = points.slice(index, end + 1);
    const stationary =
      calculatePathDistanceKm(clusterPoints) * 1000 <= MAX_STOP_CLUSTER_PATH_M;

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

    if (stationary && interior && spanMs >= minTripStopMs) {
      spans.push({start: index, end});
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
): DetectedTrip[] {
  const stops = findStopSpansInTravel(travel.points);
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

    const split = splitTravelAtInteriorStops(segment, tripIndex);
    pieces.push(...split);
    tripIndex += split.length;
  }

  return pieces.length > 0 ? pieces : [travel];
}

function splitTravelsAtStops(
  trips: DetectedTrip[],
  _config: TripDetectionConfig,
): DetectedTrip[] {
  const split: DetectedTrip[] = [];
  let tripIndex = 0;

  for (const trip of trips) {
    if (trip.kind === 'travel') {
      const pieces = splitTravelAtStops(trip, tripIndex, _config);
      split.push(...pieces);
      tripIndex += pieces.length;
    } else {
      split.push({...trip, id: `${trip.kind}-${tripIndex}-${trip.startAt.getTime()}`});
      tripIndex += 1;
    }
  }

  return split;
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
    let staySpan = stays[stayIndex]!;
    let travelEnd = staySpan.start - 1;
    const priorStayEnd =
      stayIndex > 0 ? stays[stayIndex - 1]!.end : null;

    if (priorStayEnd != null) {
      const split = splitStayAfterShortDeparture(
        deduped,
        staySpan,
        priorStayEnd,
        config,
      );
      travelEnd = split.travelEnd;
      staySpan = split.stay;
    }

    if (travelEnd >= cursor) {
      const travelPoints = buildTravelSlice(
        deduped,
        cursor,
        travelEnd,
        priorStayEnd,
      );
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
        deduped.slice(staySpan.start, staySpan.end + 1),
        'stay',
        tripIndex,
      ),
    );
    tripIndex += 1;
    cursor = staySpan.end + 1;
  }

  if (cursor < deduped.length) {
    const lastStay = stays[stays.length - 1]!;
    const travelPoints = buildTravelSlice(
      deduped,
      cursor,
      deduped.length - 1,
      lastStay.end,
    );
    if (travelPoints.length > 0) {
      const travel = makeTrip(travelPoints, 'travel', tripIndex);
      if (isMeaningfulTravel(travel)) {
        trips.push(travel);
      }
    }
  }

  const merged = mergeAdjacentSameAreaStays(
    splitTravelsAtStops(trips, config),
    config,
  );
  const withoutNoise = dropNoiseTravels(merged);
  return closeStayEndsAtNextLeg(withoutNoise, config);
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

const LONG_GAP_BEFORE_TRAVEL_MS = 10 * 60_000;

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
  const lastStaySave = previousStay?.points[previousStay.points.length - 1];
  const gapMs = lastStaySave
    ? travel.startAt.getTime() - lastStaySave.timestamp.getTime()
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

  const lastSave = previousStay?.points[previousStay.points.length - 1];
  if (
    lastSave &&
    gapMs >= LONG_GAP_BEFORE_TRAVEL_MS &&
    points.length > 0 &&
    minDistanceToStayM(points[0]!, previousStay) > 80
  ) {
    return [lastSave, ...points];
  }

  return points;
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
