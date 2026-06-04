import {differenceInMilliseconds} from 'date-fns';

import type {LocationPointRow} from '@/db/repositories/location-days';
import {calculatePathDistanceKm, distanceKm} from '@/lib/location-geo';
import type {TripDetectionConfig} from '@/lib/trip-settings';

export type TripKind = 'travel' | 'stay';

export type DetectedTrip = {
  id: string;
  kind: TripKind;
  points: LocationPointRow[];
  startAt: Date;
  endAt: Date;
  distanceKm: number;
  durationMs: number;
};

function makeTrip(points: LocationPointRow[], kind: TripKind, index: number): DetectedTrip {
  const startAt = points[0]!.timestamp;
  const endAt = points[points.length - 1]!.timestamp;
  const durationMs = Math.max(0, differenceInMilliseconds(endAt, startAt));
  const distanceKm =
    kind === 'stay' ? 0 : calculatePathDistanceKm(points);

  return {
    id: `${kind}-${index}-${startAt.getTime()}`,
    kind,
    points,
    startAt,
    endAt,
    distanceKm,
    durationMs,
  };
}

function splitByTimeGap(
  points: LocationPointRow[],
  gapMinutes: number,
): LocationPointRow[][] {
  if (points.length === 0) {
    return [];
  }

  const gapMs = gapMinutes * 60_000;
  const segments: LocationPointRow[][] = [];
  let current: LocationPointRow[] = [points[0]!];

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    const previous = points[index - 1]!;
    const delta = point.timestamp.getTime() - previous.timestamp.getTime();

    if (delta > gapMs) {
      segments.push(current);
      current = [point];
    } else {
      current.push(point);
    }
  }

  segments.push(current);
  return segments;
}

function findDwellBlock(
  points: LocationPointRow[],
  startIndex: number,
  config: TripDetectionConfig,
): {start: number; end: number} | null {
  const minMs = config.dwellMinutes * 60_000;
  const maxRadiusKm = config.dwellRadiusMeters / 1000;
  const anchor = points[startIndex];
  if (!anchor) {
    return null;
  }

  let endIndex = startIndex;
  for (let index = startIndex + 1; index < points.length; index += 1) {
    const point = points[index]!;
    if (distanceKm(anchor, point) > maxRadiusKm) {
      break;
    }
    endIndex = index;
  }

  const durationMs =
    points[endIndex]!.timestamp.getTime() - anchor.timestamp.getTime();

  if (durationMs >= minMs) {
    return {start: startIndex, end: endIndex};
  }

  return null;
}

function splitSegmentByDwell(
  points: LocationPointRow[],
  config: TripDetectionConfig,
  tripIndexStart: number,
): DetectedTrip[] {
  if (points.length === 0) {
    return [];
  }

  if (points.length === 1) {
    return [makeTrip(points, 'travel', tripIndexStart)];
  }

  const trips: DetectedTrip[] = [];
  let index = 0;
  let tripCounter = tripIndexStart;

  while (index < points.length) {
    const dwell = findDwellBlock(points, index, config);

    if (dwell) {
      if (dwell.start > index) {
        trips.push(
          makeTrip(points.slice(index, dwell.start), 'travel', tripCounter),
        );
        tripCounter += 1;
      }

      trips.push(
        makeTrip(points.slice(dwell.start, dwell.end + 1), 'stay', tripCounter),
      );
      tripCounter += 1;
      index = dwell.end + 1;
      continue;
    }

    let nextDwellStart: number | null = null;
    for (let probe = index + 1; probe < points.length; probe += 1) {
      if (findDwellBlock(points, probe, config)) {
        nextDwellStart = probe;
        break;
      }
    }

    if (nextDwellStart != null) {
      trips.push(
        makeTrip(points.slice(index, nextDwellStart), 'travel', tripCounter),
      );
      tripCounter += 1;
      index = nextDwellStart;
    } else {
      trips.push(makeTrip(points.slice(index), 'travel', tripCounter));
      break;
    }
  }

  return trips;
}

/** Build chronological trips for one day's points (oldest first). */
export function detectTrips(
  points: LocationPointRow[],
  config: TripDetectionConfig,
): DetectedTrip[] {
  if (points.length === 0) {
    return [];
  }

  const sorted = [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  const segments = splitByTimeGap(sorted, config.gapMinutes);
  const trips: DetectedTrip[] = [];
  let tripIndex = 0;

  for (const segment of segments) {
    const segmentTrips = splitSegmentByDwell(segment, config, tripIndex);
    trips.push(...segmentTrips);
    tripIndex += segmentTrips.length;
  }

  return trips;
}

/** Newest trip first (for the bottom strip). */
export function detectTripsNewestFirst(
  points: LocationPointRow[],
  config: TripDetectionConfig,
): DetectedTrip[] {
  return [...detectTrips(points, config)].reverse();
}
