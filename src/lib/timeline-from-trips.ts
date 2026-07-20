import { differenceInMilliseconds } from 'date-fns';

import type { LocationPointRow } from '@/db/repositories/location-days';
import type { MaterializedDayRow } from '@/db/repositories/materialized-days';
import type { TripPointRow } from '@/db/repositories/trip-points';
import type { TripRow } from '@/db/repositories/trips';
import { tripPlaceFieldsFromDetected } from '@/lib/resolved-place';
import {
  locationPointsForTripRow,
  tripRowToDetectedTripWithGeometry,
} from '@/lib/trip-geometry';
import {
  isPlayableTimelineEntry,
  type DayTimelineEntry,
  type DetectedTrip,
  type TimelineGap,
} from '@/lib/trip-detection';

const MIN_TIMELINE_GAP_MS = 2 * 60_000;
/** Back-to-back stay→drive on the same timestamp should not share GPS rows. */
const CONTIGUOUS_TRIP_MS = 60_000;

type TripPointBounds = {
  startMs: number;
  endMs: number;
  endExclusive: boolean;
};

function tripPointBounds(
  row: TripRow,
  index: number,
  sorted: TripRow[],
): TripPointBounds {
  const previous = index > 0 ? sorted[index - 1]! : null;
  const next = index < sorted.length - 1 ? sorted[index + 1]! : null;
  let startMs = row.startAt.getTime();
  const endMs = row.endAt.getTime();
  let endExclusive = false;

  if (
    row.kind === 'stay' &&
    next?.kind === 'travel' &&
    next.startAt.getTime() - row.endAt.getTime() <= CONTIGUOUS_TRIP_MS
  ) {
    return { startMs, endMs: next.startAt.getTime(), endExclusive: true };
  }

  if (
    row.kind === 'travel' &&
    next?.kind === 'stay' &&
    next.startAt.getTime() - row.endAt.getTime() <= CONTIGUOUS_TRIP_MS
  ) {
    return { startMs, endMs: next.startAt.getTime(), endExclusive: true };
  }

  if (
    row.kind === 'travel' &&
    previous?.kind === 'stay' &&
    row.startAt.getTime() - previous.endAt.getTime() <= CONTIGUOUS_TRIP_MS
  ) {
    startMs = Math.max(startMs, previous.endAt.getTime());
  }

  if (
    row.kind === 'stay' &&
    previous?.kind === 'travel' &&
    row.startAt.getTime() - previous.endAt.getTime() <= CONTIGUOUS_TRIP_MS
  ) {
    startMs = Math.max(startMs, previous.endAt.getTime());
  }

  return { startMs, endMs, endExclusive };
}

function collectPointsForBounds(
  sortedPoints: LocationPointRow[],
  bounds: TripPointBounds,
  startIndex: number,
): { points: LocationPointRow[]; nextIndex: number } {
  const { startMs, endMs, endExclusive } = bounds;
  let index = startIndex;
  while (
    index < sortedPoints.length &&
    sortedPoints[index]!.timestamp.getTime() < startMs
  ) {
    index += 1;
  }

  const points: LocationPointRow[] = [];
  while (index < sortedPoints.length) {
    const timestampMs = sortedPoints[index]!.timestamp.getTime();
    if (endExclusive ? timestampMs >= endMs : timestampMs > endMs) {
      break;
    }
    points.push(sortedPoints[index]!);
    index += 1;
  }

  return { points, nextIndex: index };
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

function tripRowToDetectedTrip(
  row: TripRow,
  points: LocationPointRow[],
  route: readonly TripPointRow[] = [],
): DetectedTrip {
  return tripRowToDetectedTripWithGeometry(row, points, route);
}

export function buildTimelineFromStoredTrips(
  tripRows: TripRow[],
  pointsByTripId: ReadonlyMap<number, TripPointRow[]>,
): DayTimelineEntry[] {
  const sorted = [...tripRows].sort(
    (a, b) =>
      a.segmentOrder - b.segmentOrder ||
      a.startAt.getTime() - b.startAt.getTime(),
  );
  return sorted.map(row => {
    if (row.kind === 'missing') {
      return {
        id: row.eventKey,
        kind: 'gap' as const,
        points: [],
        startAt: row.startAt,
        endAt: row.endAt,
        durationMs: row.durationMs,
        distanceKm: row.distanceKm,
      };
    }
    if (row.kind === 'stay') {
      const route = pointsByTripId.get(row.id) ?? [];
      return {
        ...tripRowToDetectedTrip(
          row,
          locationPointsForTripRow(row, route),
          route,
        ),
        materializedTripId: row.id,
        segmentOrder: row.segmentOrder,
        inferred: row.inferred,
      };
    }
    const route = pointsByTripId.get(row.id) ?? [];
    return {
      ...tripRowToDetectedTrip(
        row,
        locationPointsForTripRow(row, route),
        route,
      ),
      materializedTripId: row.id,
      segmentOrder: row.segmentOrder,
    };
  });
}

function insertGapsBetweenTrips(entries: DetectedTrip[]): DayTimelineEntry[] {
  if (entries.length === 0) {
    return [];
  }

  const timeline: DayTimelineEntry[] = [entries[0]!];
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1]!;
    const current = entries[index]!;
    const gapMs = differenceInMilliseconds(current.startAt, previous.endAt);
    if (gapMs >= MIN_TIMELINE_GAP_MS) {
      timeline.push(makeGap(previous.endAt, current.startAt, index));
    }
    timeline.push(current);
  }
  return timeline;
}

export function canReadDayFromMaterializedTrips(
  materializedDay: MaterializedDayRow | null,
  detectionVersion: number,
): boolean {
  return (
    materializedDay?.status === 'complete' &&
    materializedDay.detectionVersion === detectionVersion
  );
}

export function buildTimelineFromTrips(
  tripRows: TripRow[],
  routePoints: LocationPointRow[],
  options?: { includeRoutePoints?: boolean },
): DayTimelineEntry[] {
  const includeRoutePoints = options?.includeRoutePoints !== false;
  const sorted = [...tripRows].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );
  const sortedPoints = includeRoutePoints
    ? [...routePoints].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      )
    : [];
  let pointCursor = 0;
  const playable = sorted.map((row, index) => {
    if (!includeRoutePoints) {
      return tripRowToDetectedTrip(row, []);
    }
    const bounds = tripPointBounds(row, index, sorted);
    const { points, nextIndex } = collectPointsForBounds(
      sortedPoints,
      bounds,
      pointCursor,
    );
    pointCursor = nextIndex;
    return tripRowToDetectedTrip(row, points);
  });
  return insertGapsBetweenTrips(playable);
}

/** True when `dayPoints` are raw GPS rows (not synthetic trip route / stay anchors). */
export function isRawGpsDayPoints(
  points: readonly LocationPointRow[],
): boolean {
  return points.some(
    point => point.source !== 'route' && point.source !== 'anchor',
  );
}

/**
 * Precomputed, reusable inputs for resolving day-GPS routes across many trips.
 * Sorting the playable trips and the (potentially ~50k) day points once here
 * avoids re-sorting them for every travel entry during route hydration.
 */
type RouteHydrationContext = {
  pseudoRows: TripRow[];
  indexById: Map<string, number>;
  sortedPoints: LocationPointRow[];
};

function buildRouteHydrationContext(
  playableTrips: DetectedTrip[],
  dayPoints: readonly LocationPointRow[],
): RouteHydrationContext {
  const sorted = [...playableTrips].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );
  const pseudoRows = sorted.map(toPseudoTripRow);
  const indexById = new Map<string, number>();
  sorted.forEach((entry, index) => indexById.set(entry.id, index));
  const sortedPoints = [...dayPoints].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  return { pseudoRows, indexById, sortedPoints };
}

function collectRoutePointsWithContext(
  trip: DetectedTrip,
  context: RouteHydrationContext,
): LocationPointRow[] {
  const index = context.indexById.get(trip.id);
  if (index == null) {
    return [];
  }
  const bounds = tripPointBounds(
    context.pseudoRows[index]!,
    index,
    context.pseudoRows,
  );
  return collectPointsForBounds(context.sortedPoints, bounds, 0).points;
}

function collectRoutePointsForTrip(
  trip: DetectedTrip,
  playableTrips: DetectedTrip[],
  dayPoints: readonly LocationPointRow[],
): LocationPointRow[] {
  return collectRoutePointsWithContext(
    trip,
    buildRouteHydrationContext(playableTrips, dayPoints),
  );
}

/** Map routes should follow saved GPS — not the simplified trip_points cache. */
export function resolveRoutePointsForPlayableTrip(
  trip: DetectedTrip,
  playableTrips: DetectedTrip[],
  dayPoints: LocationPointRow[],
): LocationPointRow[] {
  if (dayPoints.length === 0) {
    return trip.points;
  }

  const fromDay = collectRoutePointsForTrip(trip, playableTrips, dayPoints);
  if (isRawGpsDayPoints(dayPoints) && fromDay.length >= 2) {
    return fromDay;
  }

  if (trip.points.length > 0) {
    return trip.points;
  }

  return fromDay;
}

/** Replace sparse stored trip routes with the day's raw GPS for map display. */
export function hydrateTravelRoutesFromDayPoints(
  entries: readonly DayTimelineEntry[],
  dayPoints: readonly LocationPointRow[],
): DayTimelineEntry[] {
  if (dayPoints.length === 0 || !isRawGpsDayPoints(dayPoints)) {
    return [...entries];
  }

  const playable = entries.filter((entry): entry is DetectedTrip =>
    isPlayableTimelineEntry(entry),
  );

  // Build the sorted trip/point context a single time, then reuse it for every
  // travel entry. `dayPoints` is already known to be raw GPS here, mirroring the
  // `resolveRoutePointsForPlayableTrip` decision (day GPS wins when it yields a
  // usable polyline, otherwise fall back to the stored trip points).
  const context = buildRouteHydrationContext(playable, dayPoints);

  return entries.map(entry => {
    if (!isPlayableTimelineEntry(entry) || entry.kind !== 'travel') {
      return entry;
    }
    const fromDay = collectRoutePointsWithContext(entry, context);
    let resolved: LocationPointRow[];
    if (fromDay.length >= 2) {
      resolved = fromDay;
    } else if (entry.points.length > 0) {
      resolved = entry.points;
    } else {
      resolved = fromDay;
    }
    if (resolved.length === 0) {
      return entry;
    }
    return { ...entry, points: resolved };
  });
}

function toPseudoTripRow(trip: DetectedTrip): TripRow {
  const persisted = tripPlaceFieldsFromDetected(trip);
  return {
    id: trip.materializedTripId ?? 0,
    eventKey: trip.id,
    kind: trip.kind,
    dateKey: '',
    startAt: trip.startAt,
    endAt: trip.endAt,
    durationMs: trip.durationMs,
    distanceKm: trip.distanceKm,
    centroidLat: trip.anchorLat ?? 0,
    centroidLng: trip.anchorLng ?? 0,
    segmentOrder: trip.segmentOrder ?? 0,
    placeLabel: persisted.placeLabel,
    placeId: persisted.placeId,
    placeKind: persisted.placeKind,
    poiId: persisted.poiId,
    poiLabel: persisted.poiLabel,
    poiCategory: persisted.poiCategory,
    inferred: trip.inferred ?? false,
    selectedCandidateIndex: null,
    detectionVersion: 0,
    closedAt: trip.endAt,
    momentRefs: trip.momentRefs ?? [],
  };
}
