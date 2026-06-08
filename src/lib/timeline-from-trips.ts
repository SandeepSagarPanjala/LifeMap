import {differenceInMilliseconds} from 'date-fns';

import type {LocationPointRow} from '@/db/repositories/location-days';
import type {MaterializedDayRow} from '@/db/repositories/materialized-days';
import type {TripRow} from '@/db/repositories/trips';
import {
  type DayTimelineEntry,
  type DetectedTrip,
  type TimelineGap,
} from '@/lib/trip-detection';

const MIN_TIMELINE_GAP_MS = 2 * 60_000;
/** Back-to-back stay→drive on the same timestamp should not share GPS rows. */
const CONTIGUOUS_TRIP_MS = 60_000;

function assignPointsForMaterializedTrip(
  row: TripRow,
  index: number,
  sorted: TripRow[],
  allPoints: LocationPointRow[],
): LocationPointRow[] {
  const previous = index > 0 ? sorted[index - 1]! : null;
  const next = index < sorted.length - 1 ? sorted[index + 1]! : null;
  let startMs = row.startAt.getTime();
  let endMs = row.endAt.getTime();

  if (
    row.kind === 'stay' &&
    next?.kind === 'travel' &&
    next.startAt.getTime() - row.endAt.getTime() <= CONTIGUOUS_TRIP_MS
  ) {
    const travelStart = next.startAt.getTime();
    return allPoints.filter(point => {
      const timestampMs = point.timestamp.getTime();
      return timestampMs >= startMs && timestampMs < travelStart;
    });
  }

  if (
    row.kind === 'travel' &&
    next?.kind === 'stay' &&
    next.startAt.getTime() - row.endAt.getTime() <= CONTIGUOUS_TRIP_MS
  ) {
    const stayStart = next.startAt.getTime();
    return allPoints.filter(point => {
      const timestampMs = point.timestamp.getTime();
      return timestampMs >= startMs && timestampMs < stayStart;
    });
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

  return allPoints.filter(point => {
    const timestampMs = point.timestamp.getTime();
    return timestampMs >= startMs && timestampMs <= endMs;
  });
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
): DetectedTrip {
  return {
    id: `materialized-${row.id}`,
    kind: row.kind,
    points,
    startAt: row.startAt,
    endAt: row.endAt,
    distanceKm: row.distanceKm,
    durationMs: row.durationMs,
    materializedTripId: row.id,
  };
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
): DayTimelineEntry[] {
  const sorted = [...tripRows].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );
  const playable = sorted.map((row, index) =>
    tripRowToDetectedTrip(
      row,
      assignPointsForMaterializedTrip(row, index, sorted, routePoints),
    ),
  );
  return insertGapsBetweenTrips(playable);
}
