import type { LocationPointRow } from '@/db/repositories/location-days';
import type { MomentRow } from '@/db/repositories/moments';
import { locationPointRow } from '@/lib/location-point-row';
import { locationRowsToParsedPoints } from '@/lib/segmentation/parse-points';
import {
  canonicalizeStaySegmentPoints,
  displayPointsForSegment,
  plotPointsFromSegments,
} from '@/lib/segmentation/stay-geometry';
import type { ParsedPoint } from '@/lib/segmentation/types';
import type { Stop } from '@/lib/segmentation/stops';
import type { StaySegment, TripSegment } from '@/lib/segmentation/trips';

export function parsedPointsToLocationRows(
  points: readonly ParsedPoint[],
): LocationPointRow[] {
  return points.map(point =>
    locationPointRow({
      id: point.id,
      timestamp: point.at,
      lat: point.lat,
      lng: point.lng,
      accuracy: point.accuracy,
      altitude: point.altitude,
      speed: point.speed,
      source: point.source,
    }),
  );
}

export function segmentToLocationRows(
  segment: TripSegment,
  options: {
    canonicalizeStays?: boolean;
    canonicalizeDrives?: boolean;
    moments?: readonly MomentRow[];
  } = {},
): LocationPointRow[] {
  if (segment.kind === 'missing') {
    return [];
  }
  const canonicalizeStays = options.canonicalizeStays ?? false;
  const canonicalizeDrives = options.canonicalizeDrives ?? false;
  if (canonicalizeStays || canonicalizeDrives) {
    return parsedPointsToLocationRows(
      displayPointsForSegment(
        segment,
        canonicalizeStays,
        options.moments ?? [],
        canonicalizeDrives,
      ),
    );
  }
  return parsedPointsToLocationRows(segment.points);
}

export function segmentsToLocationRows(
  segments: readonly TripSegment[],
  options: {
    canonicalizeStays?: boolean;
    canonicalizeDrives?: boolean;
    moments?: readonly MomentRow[];
  } = {},
): LocationPointRow[] {
  const canonicalizeStays = options.canonicalizeStays ?? false;
  const canonicalizeDrives = options.canonicalizeDrives ?? false;
  if (canonicalizeStays || canonicalizeDrives) {
    return parsedPointsToLocationRows(
      plotPointsFromSegments(
        segments,
        canonicalizeStays,
        options.moments ?? [],
        canonicalizeDrives,
      ),
    );
  }
  return sortLocationPointsByTime(
    parsedPointsToLocationRows(segments.flatMap(segment => segment.points)),
  );
}

function stopToStaySegment(
  stop: Stop,
  points: readonly ParsedPoint[],
): StaySegment {
  return {
    kind: 'stay',
    id: stop.id,
    order: 0,
    stop,
    startAt: stop.arrivedAt,
    endAt: stop.leftAt,
    durationMs: stop.durationMs,
    points: [...points],
  };
}

/** Plot points for a detected stop — optional canonical stay geometry. */
export function stopToLocationRows(
  stop: Stop,
  allPoints: readonly LocationPointRow[],
  options: {
    canonicalizeStays?: boolean;
    moments?: readonly MomentRow[];
  } = {},
): LocationPointRow[] {
  const idSet = new Set(stop.pointIds);
  const parsed = locationRowsToParsedPoints(
    allPoints.filter(point => idSet.has(point.id)),
  );
  if (!options.canonicalizeStays) {
    return parsedPointsToLocationRows(parsed);
  }
  return parsedPointsToLocationRows(
    canonicalizeStaySegmentPoints(
      stopToStaySegment(stop, parsed),
      options.moments ?? [],
    ),
  );
}

export function sortLocationPointsByTime(
  points: readonly LocationPointRow[],
): LocationPointRow[] {
  return [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.id - b.id,
  );
}
