import type { LocationPointRow } from '@/db/repositories/location-days';
import type { TripPointRow } from '@/db/repositories/trip-points';
import type { TripRow } from '@/db/repositories/trips';
import {
  routeMomentAnchorsFromTripPoints,
  type TripMomentRef,
} from '@/lib/moment-refs';
import { resolvedPlaceFromTripRow } from '@/lib/resolved-place';
import {
  isPlayableTimelineEntry,
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';

export function syntheticStayPoint(trip: TripRow): LocationPointRow {
  const midpointMs = Math.floor(
    (trip.startAt.getTime() + trip.endAt.getTime()) / 2,
  );
  return {
    id: -trip.id,
    timestamp: new Date(midpointMs),
    lat: trip.centroidLat,
    lng: trip.centroidLng,
    accuracy: null,
    altitude: null,
    speed: null,
    source: 'anchor',
  };
}

export function syntheticRoutePoints(
  trip: TripRow,
  route: readonly TripPointRow[],
): LocationPointRow[] {
  if (route.length === 0) {
    return [];
  }

  return storedTripPointsToLocationRows(trip, route);
}

/** Rehydrate saved trip_points into timeline GPS rows. */
export function storedTripPointsToLocationRows(
  trip: TripRow,
  route: readonly TripPointRow[],
): LocationPointRow[] {
  if (route.length === 0) {
    return [];
  }

  const startMs = trip.startAt.getTime();
  const endMs = trip.endAt.getTime();
  const spanMs = Math.max(1, endMs - startMs);

  return route.map((point, index) => ({
    id: point.locationPointId ?? -(trip.id * 10_000 + point.seq),
    timestamp:
      point.recordedAt ??
      new Date(startMs + (spanMs * index) / Math.max(1, route.length - 1)),
    lat: point.lat,
    lng: point.lng,
    accuracy: null,
    altitude: null,
    speed: null,
    source: point.source ?? 'route',
  }));
}

export function locationPointsForTripRow(
  trip: TripRow,
  route: readonly TripPointRow[],
): LocationPointRow[] {
  if (route.length > 0) {
    return storedTripPointsToLocationRows(trip, route);
  }
  if (trip.kind === 'stay') {
    return [syntheticStayPoint(trip)];
  }
  return [];
}

export function flattenTimelinePoints(
  entries: readonly DayTimelineEntry[],
): LocationPointRow[] {
  const points: LocationPointRow[] = [];
  for (const entry of entries) {
    if (isPlayableTimelineEntry(entry)) {
      points.push(...entry.points);
    }
  }
  return points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function travelCentroidFromRoute(
  route: readonly { lat: number; lng: number }[],
): { lat: number; lng: number } {
  if (route.length === 0) {
    return { lat: 0, lng: 0 };
  }
  const first = route[0]!;
  const last = route[route.length - 1]!;
  return {
    lat: (first.lat + last.lat) / 2,
    lng: (first.lng + last.lng) / 2,
  };
}

export function tripRowToDetectedTripWithGeometry(
  row: TripRow,
  points: LocationPointRow[],
  route: readonly TripPointRow[] = [],
): DetectedTrip {
  const resolved = resolvedPlaceFromTripRow(row);
  const momentRefs: TripMomentRef[] = row.momentRefs;
  return {
    id: `materialized-${row.id}`,
    kind: row.kind === 'travel' ? 'travel' : 'stay',
    points,
    startAt: row.startAt,
    endAt: row.endAt,
    distanceKm: row.distanceKm,
    durationMs: row.durationMs,
    materializedTripId: row.id,
    segmentOrder: row.segmentOrder,
    placeLabel: resolved.placeLabel ?? undefined,
    placeId: resolved.placeId ?? undefined,
    placeKind: resolved.placeKind ?? undefined,
    poiId: resolved.poiId ?? undefined,
    poiLabel: resolved.poiLabel ?? undefined,
    poiCategory: resolved.poiCategory ?? undefined,
    inferred: row.inferred,
    anchorLat: row.kind === 'stay' ? row.centroidLat : undefined,
    anchorLng: row.kind === 'stay' ? row.centroidLng : undefined,
    momentRefs,
    routeMomentAnchors: (() => {
      const anchors = routeMomentAnchorsFromTripPoints(route);
      return anchors.length > 0 ? anchors : undefined;
    })(),
  };
}

/** Saved trip_points rehydrated with synthetic timestamps — not raw GPS. */
export function isStoredRoutePoints(
  points: readonly LocationPointRow[],
): boolean {
  return points.length > 0 && points.every(point => point.source === 'route');
}
