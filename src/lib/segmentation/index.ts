import type {LocationPointRow} from '@/db/repositories/location-days';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {toDateKey} from '@/lib/day-utils';
import {
  type DayTimelineEntry,
  type DetectedTrip,
  type TimelineGap,
  type TripTimelineOptions,
} from '@/lib/trip-detection';
import type {TripDetectionConfig} from '@/lib/trip-settings';
import {HISTORY_SAME_PLACE_RADIUS_METERS} from '@/lib/trip-settings';

import {locationRowsToParsedPoints} from './parse-points';
import {
  DEFAULT_STOP_CONFIG,
  type StopDetectionConfig,
} from './stops';
import {
  detectTripsForDay,
  detectTrips as detectSegmentTrips,
  type DriveSegment,
  type MissingSegment,
  type StaySegment,
  type TripSegment,
} from './trips';

export {
  detectTripsForDay,
  detectTrips as detectSegmentTrips,
} from './trips';
export {DEFAULT_STOP_CONFIG} from './stops';
export {TRIP_PLOT_SOURCES} from './sources';

function stopConfigFromTripConfig(
  config: TripDetectionConfig,
): StopDetectionConfig {
  return {
    ...DEFAULT_STOP_CONFIG,
    radiusM: config.dwellRadiusMeters,
    minDwellMs: config.dwellMinutes * 60_000,
  };
}

function parsedToLocationRow(point: {
  id: number;
  timestamp?: Date;
  at?: Date;
  lat: number;
  lng: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  source: string;
}): LocationPointRow | null {
  const timestamp = point.timestamp ?? point.at;
  if (timestamp == null) {
    return null;
  }
  return {
    id: point.id,
    timestamp,
    lat: point.lat,
    lng: point.lng,
    accuracy: point.accuracy,
    altitude: point.altitude,
    speed: point.speed,
    source: point.source,
  };
}

function staySegmentToTrip(segment: StaySegment): DetectedTrip {
  const points = segment.points
    .map(parsedToLocationRow)
    .filter((point): point is LocationPointRow => point != null);
  return {
    id: segment.id,
    kind: 'stay',
    points,
    startAt: segment.startAt,
    endAt: segment.endAt,
    durationMs: segment.durationMs,
    distanceKm: 0,
    segmentOrder: segment.order,
    savedPlaceLabel: segment.savedPlaceLabel,
    savedPlaceId: segment.savedPlaceId,
    inferred: segment.stop.inferred,
  };
}

function driveSegmentToTrip(segment: DriveSegment): DetectedTrip {
  const points = segment.points
    .map(parsedToLocationRow)
    .filter((point): point is LocationPointRow => point != null);
  return {
    id: segment.id,
    kind: 'travel',
    points,
    startAt: segment.startAt,
    endAt: segment.endAt,
    durationMs: segment.durationMs,
    distanceKm: segment.distanceM / 1000,
    segmentOrder: segment.order,
    savedPlaceLabel: segment.toSavedPlaceLabel ?? segment.fromSavedPlaceLabel,
    savedPlaceId: segment.toSavedPlaceId ?? segment.fromSavedPlaceId,
  };
}

function missingSegmentToGap(segment: MissingSegment): TimelineGap {
  return {
    id: segment.id,
    kind: 'gap',
    points: [],
    startAt: segment.startAt,
    endAt: segment.endAt,
    durationMs: segment.durationMs,
    distanceKm: segment.distanceM / 1000,
  };
}

export function segmentToTimelineEntry(segment: TripSegment): DayTimelineEntry {
  if (segment.kind === 'stay') {
    return staySegmentToTrip(segment);
  }
  if (segment.kind === 'drive') {
    return driveSegmentToTrip(segment);
  }
  return missingSegmentToGap(segment);
}

/** Detect stay/drive/gap segments for one calendar day. */
export function detectSegmentsForDay(
  dateKey: string,
  allPoints: readonly LocationPointRow[],
  config: TripDetectionConfig = {
    gapMinutes: 10,
    dwellMinutes: 5,
    dwellRadiusMeters: HISTORY_SAME_PLACE_RADIUS_METERS,
  },
  savedPlaces: readonly SavedPlaceRow[] = [],
): TripSegment[] {
  const parsed = locationRowsToParsedPoints(allPoints);
  const stopConfig = stopConfigFromTripConfig(config);
  return detectTripsForDay(
    dateKey,
    parsed,
    stopConfig,
    [...savedPlaces],
  ).segments;
}

/**
 * LifeMap timeline for a day using the segmentation algorithm.
 * Requires enough GPS context (lookback/lookahead) in `allPoints`.
 */
export function buildSegmentationTimeline(
  dateKey: string,
  allPoints: readonly LocationPointRow[],
  config: TripDetectionConfig,
  options: TripTimelineOptions = {},
): DayTimelineEntry[] {
  const savedPlaces = options.savedPlaces ?? [];
  const segments = detectSegmentsForDay(
    dateKey,
    allPoints,
    config,
    savedPlaces,
  );
  return segments.map(segment => segmentToTimelineEntry(segment));
}

/** Full-window detection (no day projection) — used by rebuild/benchmark. */
export function detectTripsFromPoints(
  points: readonly LocationPointRow[],
  config: TripDetectionConfig,
  options: TripTimelineOptions = {},
): DetectedTrip[] {
  const parsed = locationRowsToParsedPoints(points);
  const stopConfig = stopConfigFromTripConfig(config);
  const result = detectSegmentTrips(parsed, stopConfig, [...(options.savedPlaces ?? [])]);
  return result.segments
    .filter(
      (segment): segment is StaySegment | DriveSegment =>
        segment.kind === 'stay' || segment.kind === 'drive',
    )
    .map(segment => segmentToTimelineEntry(segment) as DetectedTrip);
}

function inferPrimaryDateKey(points: readonly LocationPointRow[]): string {
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

/** Convenience for scripts/tests — app uses `buildSegmentationTimeline` with an explicit date key. */
export function buildDayTimeline(
  points: readonly LocationPointRow[],
  config: TripDetectionConfig,
  options: TripTimelineOptions = {},
): DayTimelineEntry[] {
  return buildSegmentationTimeline(
    inferPrimaryDateKey(points),
    points,
    config,
    options,
  );
}

/** Convenience alias for scripts/tests. */
export function detectTrips(
  points: readonly LocationPointRow[],
  config: TripDetectionConfig,
  options: TripTimelineOptions = {},
): DetectedTrip[] {
  return detectTripsFromPoints(points, config, options);
}

export function tripEventKeyFromSegment(segment: TripSegment): string {
  if (segment.kind === 'missing') {
    return `missing:${segment.startAt.getTime()}:${segment.endAt.getTime()}`;
  }
  const kind = segment.kind === 'drive' ? 'travel' : 'stay';
  return `${kind}:${segment.startAt.getTime()}:${segment.endAt.getTime()}`;
}

export function segmentCentroid(segment: TripSegment): {lat: number; lng: number} {
  if (segment.kind === 'missing') {
    return {
      lat: (segment.fromLat + segment.toLat) / 2,
      lng: (segment.fromLng + segment.toLng) / 2,
    };
  }
  if (segment.kind === 'stay') {
    return {lat: segment.stop.lat, lng: segment.stop.lng};
  }
  if (segment.points.length === 0) {
    return {lat: 0, lng: 0};
  }
  const first = segment.points[0]!;
  const last = segment.points[segment.points.length - 1]!;
  return {lat: (first.lat + last.lat) / 2, lng: (first.lng + last.lng) / 2};
}

export function segmentDistanceKm(segment: TripSegment): number {
  if (segment.kind === 'drive') {
    return segment.distanceM / 1000;
  }
  if (segment.kind === 'missing') {
    return segment.distanceM / 1000;
  }
  return 0;
}
