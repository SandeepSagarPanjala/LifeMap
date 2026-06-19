/**
 * Timeline types and map/display helpers.
 * Detection lives in `@/lib/segmentation`.
 */

import type {LocationPointRow} from '@/db/repositories/location-days';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {calculatePathDistanceKm, distanceKm} from '@/lib/location-geo';
import type {LocationPointLike} from '@/lib/location-geo';
import {canonicalizeStayGeometry} from '@/lib/stay-geometry';
import type {TripDetectionConfig} from '@/lib/trip-settings';

/** Optional inputs that refine timeline detection without changing trip settings. */
export type TripTimelineOptions = {
  /** Capture times — pauses overlapping these are not split into visits. */
  momentTimestamps?: readonly Date[];
  /** Saved Home / Work / favorites — 150 m + 1 min visit rules from place center. */
  savedPlaces?: readonly SavedPlaceRow[];
};

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
  points: readonly LocationPointRow[];
  startAt: Date;
  endAt: Date;
  durationMs: number;
  distanceKm: number;
};

export type DayTimelineEntry = DetectedTrip | TimelineGap;

/** Long drives need multiple fixes — 2-point straight lines are tracking gaps, not routes. */
const MIN_TRAVEL_POINTS_FOR_LONG_DRIVE = 3;
const LONG_DRIVE_DISTANCE_M = 200;

/** Few collinear fixes on a long chord — do not draw a road-following lie. */
const SPARSE_ROUTE_MAX_POINTS = 6;
const SPARSE_ROUTE_STRAIGHTNESS_RATIO = 0.9;

/** Turn-in faster than this stays on the drive path; slower = parked (visit starts). */
const VISIT_ARRIVAL_SPEED_MS = 2;

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

function pointSpeedMs(point: LocationPointRow): number | null {
  return point.speed;
}

function isStationarySave(point: LocationPointRow): boolean {
  const speed = pointSpeedMs(point);
  return speed == null || speed <= VISIT_ARRIVAL_SPEED_MS;
}

/** Saves after a road pause that still show movement into the lot (turn-in). */
const ROAD_PAUSE_LOOKAHEAD = 4;

function findVisitArrivalIndex(
  points: LocationPointRow[],
  departureIndex: number,
): number {
  for (let index = 0; index <= departureIndex; index += 1) {
    if (!isStationarySave(points[index]!)) {
      continue;
    }
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

function findVisitDepartureEndIndex(points: LocationPointRow[]): number {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (isStationarySave(points[index]!)) {
      return index;
    }
  }
  return points.length - 1;
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

/** Same place within dwell radius (+ GPS drift buffer). */
export function arePointsSamePlace(
  a: LocationPointLike,
  b: LocationPointLike,
  config: TripDetectionConfig,
): boolean {
  return distanceKm(a, b) * 1000 <= config.dwellRadiusMeters + 5;
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

function visitArrivalPointsForInbound(visit: DetectedTrip): LocationPointRow[] {
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

function stayMapDisplayPoints(stay: DetectedTrip): LocationPointRow[] {
  if (stay.kind !== 'stay') {
    return stay.points;
  }
  const centroid = stayTripCentroid(stay);
  return canonicalizeStayGeometry(stay, {
    lat: centroid.latitude,
    lng: centroid.longitude,
  });
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

/** Radius for picking the densest visit cluster (ignores approach/departure along roads). */
const STAY_CENTROID_CLUSTER_M = 80;

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
