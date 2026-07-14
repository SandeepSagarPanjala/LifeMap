import type { LocationPointRow } from '@/db/repositories/location-days';
import {
  getLocationPointsForDay,
  getLocationPointsInRange,
} from '@/db/repositories/location-days';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import { listSavedPlaces } from '@/db/repositories/saved-places';
import { getDayRange, shiftDateKey } from '@/lib/day-utils';
import { loadExplorerGpsWindow } from '@/lib/explorer-day-trips';
import { locationPointRow } from '@/lib/location-point-row';
import { locationRowsToParsedPoints } from '@/lib/segmentation/parse-points';
import {
  filterPointsBySources,
  TRIP_PLOT_SOURCES,
} from '@/lib/segmentation/sources';
import {
  DEFAULT_STOP_CONFIG,
  detectStops,
  type Stop,
  type StopDetectionConfig,
} from '@/lib/segmentation/stops';
import {
  detectTripsForDay,
  type TripResult,
  type TripSegment,
} from '@/lib/segmentation/trips';
import { getCurrentTripDetectionConfig } from '@/lib/trip-detection-config';
import type { TripDetectionConfig } from '@/lib/trip-settings';

export type BenchmarkMode = 'stops' | 'trips' | 'power';

export type PowerDayFetchResult = {
  dateKey: string;
  prevDateKey: string;
  nextDateKey: string;
  /** Trip-track rows from yesterday's SQLite read. */
  prevTripTrackCount: number;
  /** Trip-track rows from the selected calendar day. */
  dayTripTrackCount: number;
  /** Trip-track rows from tomorrow's SQLite read. */
  nextTripTrackCount: number;
  /** Trip-track rows in deduped prev + day + next window. */
  windowPointCount: number;
  fetchElapsedMs: number;
  algorithmElapsedMs: number;
  segmentCount: number;
};

export type PowerBenchmarkResult = {
  startedAt: Date;
  finishedAt: Date;
  /** Per selected day: prev + day + next GPS load, then detectTripsForDay. */
  dayFetches: PowerDayFetchResult[];
  /** Sum of dayFetches[].fetchElapsedMs */
  gpsFetchElapsedMs: number;
  savedPlacesCount: number;
  savedPlacesFetchElapsedMs: number;
  /** gpsFetchElapsedMs + savedPlacesFetchElapsedMs */
  fetchElapsedMs: number;
  /** Sum of dayFetches[].algorithmElapsedMs */
  algorithmElapsedMs: number;
  elapsedMs: number;
  pointCount: number;
  segmentCount: number;
  inputStartAt: Date | null;
  inputEndAt: Date | null;
  usesDayWindow: boolean;
};

export type StopsBenchmarkResult = {
  points: LocationPointRow[];
  stops: Stop[];
};

export type DayTripsBenchmarkResult = {
  dateKey: string;
  /** GPS rows on the calendar day itself. */
  dayPointCount: number;
  /** GPS rows in prev + day + next window used for detection. */
  windowPointCount: number;
  result: TripResult;
};

export type TripsBenchmarkResult = {
  days: DayTripsBenchmarkResult[];
  segments: TripSegment[];
};

const TRIP_SOURCES = new Set<string>(TRIP_PLOT_SOURCES);

function stopConfigFromTripConfig(
  config: TripDetectionConfig,
): StopDetectionConfig {
  return {
    ...DEFAULT_STOP_CONFIG,
    radiusM: config.dwellRadiusMeters,
    minDwellMs: config.dwellMinutes * 60_000,
  };
}

function rowsToTripTrackPoints(
  rows: readonly LocationPointRow[],
): LocationPointRow[] {
  const parsed = locationRowsToParsedPoints(rows);
  return filterPointsBySources(parsed, TRIP_SOURCES).map(point =>
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

export async function loadParsedTripTrackForDateKey(
  dateKey: string,
): Promise<LocationPointRow[]> {
  const rows = await getLocationPointsForDay(dateKey);
  return rowsToTripTrackPoints(rows);
}

export async function loadParsedTripTrackForDateKeys(
  dateKeys: readonly string[],
): Promise<LocationPointRow[]> {
  if (dateKeys.length === 0) {
    return [];
  }
  const sorted = [...dateKeys].sort();
  const { start } = getDayRange(sorted[0]!);
  const { end } = getDayRange(sorted[sorted.length - 1]!);
  const rows = await getLocationPointsInRange(start, end);
  const keySet = new Set(dateKeys);
  const parsed = locationRowsToParsedPoints(rows);
  return filterPointsBySources(
    parsed.filter(point => keySet.has(point.dateKey)),
    TRIP_SOURCES,
  ).map(point =>
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

async function resolveSavedPlaces(
  savedPlaces?: readonly SavedPlaceRow[],
): Promise<SavedPlaceRow[]> {
  return savedPlaces ? [...savedPlaces] : listSavedPlaces();
}

export async function runStopsBenchmark(
  dateKeys: readonly string[],
  options: {
    detectionConfig?: TripDetectionConfig;
    savedPlaces?: readonly SavedPlaceRow[];
  } = {},
): Promise<StopsBenchmarkResult> {
  const detectionConfig =
    options.detectionConfig ?? getCurrentTripDetectionConfig();
  const stopConfig = stopConfigFromTripConfig(detectionConfig);
  const points = await loadParsedTripTrackForDateKeys(dateKeys);
  const parsed = locationRowsToParsedPoints(points);
  const stops = detectStops(parsed, stopConfig);
  return { points, stops };
}

export async function runTripsBenchmark(
  dateKeys: readonly string[],
  options: {
    detectionConfig?: TripDetectionConfig;
    savedPlaces?: readonly SavedPlaceRow[];
  } = {},
): Promise<TripsBenchmarkResult> {
  const detectionConfig =
    options.detectionConfig ?? getCurrentTripDetectionConfig();
  const stopConfig = stopConfigFromTripConfig(detectionConfig);
  const savedPlaces = await resolveSavedPlaces(options.savedPlaces);
  const days: DayTripsBenchmarkResult[] = [];

  for (const dateKey of [...dateKeys].sort()) {
    const { windowPoints, dayPointCount } = await loadExplorerGpsWindow(
      dateKey,
    );
    const parsed = locationRowsToParsedPoints(windowPoints);
    const tripTrack = filterPointsBySources(parsed, TRIP_SOURCES);
    const result = detectTripsForDay(
      dateKey,
      tripTrack,
      stopConfig,
      savedPlaces,
    );
    days.push({
      dateKey,
      dayPointCount,
      windowPointCount: tripTrack.length,
      result,
    });
  }

  return {
    days,
    segments: days.flatMap(day => day.result.segments),
  };
}

export async function runPowerBenchmark(
  dateKeys: readonly string[],
  options: {
    detectionConfig?: TripDetectionConfig;
    savedPlaces?: readonly SavedPlaceRow[];
  } = {},
): Promise<PowerBenchmarkResult> {
  const detectionConfig =
    options.detectionConfig ?? getCurrentTripDetectionConfig();
  const stopConfig = stopConfigFromTripConfig(detectionConfig);

  const startedAt = new Date();
  const savedPlacesFetchStartedPerf = performance.now();
  const savedPlaces = await resolveSavedPlaces(options.savedPlaces);
  const savedPlacesFetchElapsedMs =
    performance.now() - savedPlacesFetchStartedPerf;

  const dayFetches: PowerDayFetchResult[] = [];
  const windowTripTrackPoints: ReturnType<typeof locationRowsToParsedPoints> =
    [];
  let segmentCount = 0;
  let algorithmElapsedMs = 0;

  for (const dateKey of [...dateKeys].sort()) {
    const fetchStartedPerf = performance.now();
    const { windowPoints, prevPoints, dayPoints, nextPoints } =
      await loadExplorerGpsWindow(dateKey);
    const fetchElapsedMs = performance.now() - fetchStartedPerf;

    const prevTripTrackCount = rowsToTripTrackPoints(prevPoints).length;
    const dayTripTrackCount = rowsToTripTrackPoints(dayPoints).length;
    const nextTripTrackCount = rowsToTripTrackPoints(nextPoints).length;

    const parsed = locationRowsToParsedPoints(windowPoints);
    const tripTrack = filterPointsBySources(parsed, TRIP_SOURCES);
    windowTripTrackPoints.push(...tripTrack);

    const algorithmStartedPerf = performance.now();
    const result = detectTripsForDay(
      dateKey,
      tripTrack,
      stopConfig,
      savedPlaces,
    );
    const dayAlgorithmElapsedMs = performance.now() - algorithmStartedPerf;

    algorithmElapsedMs += dayAlgorithmElapsedMs;
    segmentCount += result.segments.length;
    dayFetches.push({
      dateKey,
      prevDateKey: shiftDateKey(dateKey, -1),
      nextDateKey: shiftDateKey(dateKey, 1),
      prevTripTrackCount,
      dayTripTrackCount,
      nextTripTrackCount,
      windowPointCount: tripTrack.length,
      fetchElapsedMs,
      algorithmElapsedMs: dayAlgorithmElapsedMs,
      segmentCount: result.segments.length,
    });
  }

  const gpsFetchElapsedMs = dayFetches.reduce(
    (sum, day) => sum + day.fetchElapsedMs,
    0,
  );
  const fetchElapsedMs = gpsFetchElapsedMs + savedPlacesFetchElapsedMs;

  const inputStartAt =
    windowTripTrackPoints.length > 0 ? windowTripTrackPoints[0]!.at : null;
  const inputEndAt =
    windowTripTrackPoints.length > 0
      ? windowTripTrackPoints[windowTripTrackPoints.length - 1]!.at
      : null;

  const finishedAt = new Date();
  const elapsedMs = fetchElapsedMs + algorithmElapsedMs;

  return {
    startedAt,
    finishedAt,
    dayFetches,
    gpsFetchElapsedMs,
    savedPlacesCount: savedPlaces.length,
    savedPlacesFetchElapsedMs,
    fetchElapsedMs,
    algorithmElapsedMs,
    elapsedMs,
    pointCount: windowTripTrackPoints.length,
    segmentCount,
    inputStartAt,
    inputEndAt,
    usesDayWindow: true,
  };
}
