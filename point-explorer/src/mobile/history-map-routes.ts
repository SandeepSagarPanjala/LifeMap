import {distanceKm} from '@lifemap/segmentation';

import type {ParsedPoint} from '../types';
import {isPlayableTimelineEntry} from './timeline-nav';
import type {DayTimelineEntry, DetectedTrip} from './types';

type TripDetectionConfig = {
  dwellRadiusMeters: number;
};

const LONG_GAP_BEFORE_TRAVEL_MS = 10 * 60_000;
const DEPARTURE_BRIDGE_M = 80;
const VISIT_ARRIVAL_SPEED_MS = 2;
const ROAD_PAUSE_LOOKAHEAD = 4;

export const MOBILE_MAP_TRIP_CONFIG: TripDetectionConfig = {
  dwellRadiusMeters: 75,
};

function pointSpeedMs(point: ParsedPoint): number | null {
  return point.speed;
}

function isStationarySave(point: ParsedPoint): boolean {
  const speed = pointSpeedMs(point);
  return speed == null || speed <= VISIT_ARRIVAL_SPEED_MS;
}

function findVisitArrivalIndex(
  points: ParsedPoint[],
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

function findVisitDepartureEndIndex(points: ParsedPoint[]): number {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (isStationarySave(points[index]!)) {
      return index;
    }
  }
  return points.length - 1;
}

function stayMapMarkerCoordinate(stay: DetectedTrip): {lat: number; lng: number} {
  if (stay.anchorLat != null && stay.anchorLng != null) {
    return {lat: stay.anchorLat, lng: stay.anchorLng};
  }
  if (stay.points.length === 0) {
    return {lat: 0, lng: 0};
  }
  const last = stay.points[stay.points.length - 1]!;
  return {lat: last.lat, lng: last.lng};
}

function previousStayDepartureAnchor(stay: DetectedTrip): ParsedPoint | null {
  if (stay.points.length === 0) {
    return null;
  }
  const last = stay.points[stay.points.length - 1]!;
  const marker = stayMapMarkerCoordinate(stay);
  const markerDistM =
    distanceKm({lat: last.lat, lng: last.lng}, marker) * 1000;
  if (markerDistM > DEPARTURE_BRIDGE_M) {
    return {...last, lat: marker.lat, lng: marker.lng};
  }
  return last;
}

function shouldBridgeDeparture(
  anchor: ParsedPoint,
  points: ParsedPoint[],
): boolean {
  if (points.length === 0) {
    return false;
  }
  return distanceKm(points[0]!, anchor) * 1000 > DEPARTURE_BRIDGE_M;
}

function minDistanceToStayM(
  point: {lat: number; lng: number},
  stay: DetectedTrip,
): number {
  let minM = Number.POSITIVE_INFINITY;
  for (const save of stay.points) {
    minM = Math.min(minM, distanceKm(point, save) * 1000);
  }
  return minM;
}

function sortedStayPoints(stay: DetectedTrip): ParsedPoint[] {
  return [...stay.points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
}

function visitArrivalPointsForInbound(visit: DetectedTrip): ParsedPoint[] {
  const sorted = sortedStayPoints(visit);
  if (sorted.length === 0) {
    return [];
  }
  const departureIndex = findVisitDepartureEndIndex(sorted);
  const arrivalIndex = findVisitArrivalIndex(sorted, departureIndex);
  return sorted.slice(0, arrivalIndex + 1);
}

function mergeRoutePoints(
  base: ParsedPoint[],
  extra: ParsedPoint[],
): ParsedPoint[] {
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

export function staysBeforeEntryIndex(
  entries: readonly DayTimelineEntry[],
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
  entries: readonly DayTimelineEntry[],
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
): ParsedPoint[] {
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

/** History visit map: inbound drive through turn-in until the visit arrival save. */
export function getVisitInboundTravelPoints(
  inboundTravel: DetectedTrip,
  visit: DetectedTrip,
  previousStay: DetectedTrip | null,
  otherStays: DetectedTrip[],
  config: TripDetectionConfig,
): ParsedPoint[] {
  const base = getTravelDisplayPoints(
    inboundTravel,
    previousStay,
    otherStays,
    config,
  );
  return mergeRoutePoints(base, visitArrivalPointsForInbound(visit));
}

export type MobileHistoryMapPlan = {
  selectedEntry: DetectedTrip | null;
  travelPoints: ParsedPoint[];
  inboundPoints: ParsedPoint[];
  inboundTravel: DetectedTrip | null;
};

export function buildMobileHistoryMapPlan(
  entries: readonly DayTimelineEntry[],
  selectedIndex: number,
  config: TripDetectionConfig = MOBILE_MAP_TRIP_CONFIG,
): MobileHistoryMapPlan {
  const empty: MobileHistoryMapPlan = {
    selectedEntry: null,
    travelPoints: [],
    inboundPoints: [],
    inboundTravel: null,
  };
  if (selectedIndex < 0) {
    return empty;
  }

  const entry = entries[selectedIndex];
  if (entry == null || !isPlayableTimelineEntry(entry)) {
    return empty;
  }

  if (entry.kind === 'travel') {
    return {
      selectedEntry: entry,
      travelPoints: getTravelDisplayPoints(
        entry,
        stayBeforeEntryIndex(entries, selectedIndex),
        staysBeforeEntryIndex(entries, selectedIndex),
        config,
      ),
      inboundPoints: [],
      inboundTravel: null,
    };
  }

  let inboundPoints: ParsedPoint[] = [];
  let inboundTravel: DetectedTrip | null = null;
  if (selectedIndex > 0) {
    const prior = entries[selectedIndex - 1];
    if (prior?.kind === 'travel') {
      inboundTravel = prior;
      inboundPoints = getVisitInboundTravelPoints(
        prior,
        entry,
        stayBeforeEntryIndex(entries, selectedIndex - 1),
        staysBeforeEntryIndex(entries, selectedIndex - 1),
        config,
      );
    }
  }

  return {
    selectedEntry: entry,
    travelPoints: [],
    inboundPoints,
    inboundTravel,
  };
}
