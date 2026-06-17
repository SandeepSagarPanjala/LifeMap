import {differenceInMilliseconds, endOfDay, subDays} from 'date-fns';

import {
  getDateKeysWithLocationData,
} from '@/db/repositories/location-days';
import {
  deleteMotionLocationPoints,
} from '@/db/repositories/location-points';
import {
  deleteAllMaterializedDays,
  getMaterializedDay,
  upsertMaterializedDay,
} from '@/db/repositories/materialized-days';
import {
  dayHasStoredTripGeometry,
  deleteAllTripPoints,
  listTripPointsForDay,
  replaceTripPointsFromLocations,
} from '@/db/repositories/trip-points';
import {findPlaceLookupNearAnchor} from '@/db/repositories/place-lookup-cache';
import {listSavedPlaces} from '@/db/repositories/saved-places';
import {
  deleteAllTrips,
  deleteTripsForDay,
  getTripByEventKey,
  getTripById,
  insertTripIfAbsent,
  listTripsForDay,
  setTripPlaceLookupCacheId,
  upsertTrip,
  type TripRow,
} from '@/db/repositories/trips';
import {getDayRange, getTodayDateKey, parseDateKey, toDateKey} from '@/lib/day-utils';
import type {HistoryData} from '@/lib/history-data-types';
import {clearHistoryDataCache} from '@/lib/history-data-cache';
import {yieldToEventLoop} from '@/lib/run-when-idle';
import {buildExplorerDayTimelineFromGps} from '@/lib/explorer-day-trips';
import {
  buildTimelineFromStoredTrips,
} from '@/lib/timeline-from-trips';
import {
  flattenTimelinePoints,
  travelCentroidFromRoute,
} from '@/lib/trip-geometry';
import {
  notifyMaterializationUpdated,
} from '@/lib/trip-materialization-events';
import {resolveVisitAnchor} from '@/lib/visit-anchor';
import {
  mergeSealedAndLiveTimeline,
  sealedThroughMs,
} from '@/lib/today-sealed-history';
import {
  type DayTimelineEntry,
  type DetectedTrip,
  isPlayableTimelineEntry,
  stayTripCentroid,
  type TimelineGap,
} from '@/lib/trip-detection';
import {
  buildTripDetectionConfig,
  DEFAULT_TRIP_DWELL_MINUTES,
  DEFAULT_TRIP_GAP_MINUTES,
  HISTORY_SAME_PLACE_RADIUS_METERS,
  TRIP_DETECTION_VERSION,
  type TripDetectionConfig,
} from '@/lib/trip-settings';
const MIN_IMPLAUSIBLE_DRIVE_HOURS = 2;
const MIN_IMPLAUSIBLE_DRIVE_AVG_KMH = 8;

export function isImplausibleMaterializedTravel(row: TripRow): boolean {
  if (row.kind !== 'travel') {
    return false;
  }
  const hours = row.durationMs / 3_600_000;
  if (hours < MIN_IMPLAUSIBLE_DRIVE_HOURS) {
    return false;
  }
  const avgKmh = row.distanceKm / hours;
  return avgKmh < MIN_IMPLAUSIBLE_DRIVE_AVG_KMH;
}

async function purgeMaterializedDayCache(
  dateKey: string,
  pointCount: number,
): Promise<void> {
  await deleteTripsForDay(dateKey);
  await upsertMaterializedDay(dateKey, {
    status: 'open',
    detectionVersion: TRIP_DETECTION_VERSION,
    tripCount: 0,
    pointCount,
    sealedAt: null,
  });
  clearHistoryDataCache();
  notifyMaterializationUpdated();
}

export function tripEventKey(
  trip: Pick<DetectedTrip, 'kind' | 'startAt' | 'endAt'> | TimelineGap,
): string {
  if (trip.kind === 'gap') {
    return `missing:${trip.startAt.getTime()}:${trip.endAt.getTime()}`;
  }
  return `${trip.kind}:${trip.startAt.getTime()}:${trip.endAt.getTime()}`;
}

export function isPersistableTimelineEntry(
  entry: DayTimelineEntry,
): entry is DetectedTrip | TimelineGap {
  if (entry.kind === 'gap') {
    return true;
  }
  return isClosedPlayableEntry(entry);
}

export function isClosedPlayableEntry(
  entry: DayTimelineEntry,
): entry is DetectedTrip {
  if (!isPlayableTimelineEntry(entry)) {
    return false;
  }
  if (entry.kind === 'travel') {
    return true;
  }
  return !entry.openThroughNow;
}

export type PersistedTripLabel = {
  placeLookupCacheId: number | null;
  selectedCandidateIndex: number | null;
};

/** User label choices keyed by stable trip event id — survives day re-materialization. */
export function existingTripLabelsByEventKey(
  rows: readonly TripRow[],
): Map<string, PersistedTripLabel> {
  const map = new Map<string, PersistedTripLabel>();
  for (const row of rows) {
    if (
      row.selectedCandidateIndex != null ||
      row.placeLookupCacheId != null
    ) {
      map.set(row.eventKey, {
        placeLookupCacheId: row.placeLookupCacheId,
        selectedCandidateIndex: row.selectedCandidateIndex,
      });
    }
  }
  return map;
}

export function tripLabelForPersist(
  eventKey: string,
  existingByEventKey: ReadonlyMap<string, PersistedTripLabel>,
  placeLookup: {id: number; selectedCandidateIndex: number | null} | null,
): PersistedTripLabel {
  const existing = existingByEventKey.get(eventKey);
  if (existing?.selectedCandidateIndex != null) {
    return {
      placeLookupCacheId:
        existing.placeLookupCacheId ?? placeLookup?.id ?? null,
      selectedCandidateIndex: existing.selectedCandidateIndex,
    };
  }

  return {
    placeLookupCacheId:
      existing?.placeLookupCacheId ?? placeLookup?.id ?? null,
    selectedCandidateIndex: placeLookup?.selectedCandidateIndex ?? null,
  };
}

export function getDefaultTripDetectionConfig(): TripDetectionConfig {
  return buildTripDetectionConfig(
    DEFAULT_TRIP_GAP_MINUTES,
    DEFAULT_TRIP_DWELL_MINUTES,
    HISTORY_SAME_PLACE_RADIUS_METERS,
  );
}

function travelCentroid(trip: DetectedTrip): {lat: number; lng: number} {
  if (trip.points.length === 0) {
    return {lat: 0, lng: 0};
  }
  const first = trip.points[0]!;
  const last = trip.points[trip.points.length - 1]!;
  return {
    lat: (first.lat + last.lat) / 2,
    lng: (first.lng + last.lng) / 2,
  };
}

function geometryPointsForPersist(
  entry: DetectedTrip,
  centroid: {lat: number; lng: number},
): LocationPointRow[] {
  if (entry.points.length > 0) {
    return entry.points;
  }
  if (entry.kind === 'stay') {
    return [
      {
        id: -1,
        timestamp: entry.startAt,
        lat: centroid.lat,
        lng: centroid.lng,
        accuracy: null,
        altitude: null,
        speed: null,
        source: 'anchor',
      },
    ];
  }
  return [];
}

function tripCentroidForPersist(
  trip: DetectedTrip,
  savedPlaces: Awaited<ReturnType<typeof listSavedPlaces>>,
): {lat: number; lng: number} {
  if (trip.kind === 'stay') {
    return resolveVisitAnchor(trip.points, savedPlaces);
  }
  return travelCentroidFromRoute(trip.points);
}

function tripCentroid(trip: DetectedTrip): {lat: number; lng: number} {
  if (trip.kind === 'stay') {
    const centroid = stayTripCentroid(trip);
    return {lat: centroid.latitude, lng: centroid.longitude};
  }
  return travelCentroid(trip);
}

function dayHasOpenVisit(entries: DayTimelineEntry[]): boolean {
  return entries.some(
    entry => entry.kind === 'stay' && entry.openThroughNow === true,
  );
}

async function buildExplorerHistoryForDay(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): Promise<HistoryData> {
  const {start: dayStart} = getDayRange(dateKey);
  const isToday = dateKey === getTodayDateKey();
  const rangeEnd = isToday ? referenceNow : endOfDay(dayStart);
  const {entries, dayPointCount} = await buildExplorerDayTimelineFromGps(
    dateKey,
    detectionConfig,
  );
  await yieldToEventLoop();
  return {
    dateKey,
    points: flattenTimelinePoints(
      entries.filter((entry): entry is DetectedTrip =>
        isPlayableTimelineEntry(entry),
      ),
    ),
    entries,
    range: {
      startAt: dayStart,
      endAt: rangeEnd,
    },
  };
}

/** @deprecated Use buildExplorerHistoryForDay */
async function loadLiveHistoryForDay(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): Promise<HistoryData> {
  return buildExplorerHistoryForDay(dateKey, detectionConfig, referenceNow);
}

export async function loadHistoryFromStoredTrips(
  dateKey: string,
  tripRows?: TripRow[],
  referenceNow?: Date,
  _detectionConfig: TripDetectionConfig = getDefaultTripDetectionConfig(),
): Promise<HistoryData> {
  const {start: dayStart} = getDayRange(dateKey);
  const isToday = dateKey === getTodayDateKey();
  const rangeEnd =
    referenceNow != null && isToday ? referenceNow : endOfDay(dayStart);
  const rows = tripRows ?? (await listTripsForDay(dateKey));

  if (rows.length === 0) {
    return {
      dateKey,
      points: [],
      entries: [],
      range: {startAt: dayStart, endAt: rangeEnd},
    };
  }

  const pointsByTripId = await listTripPointsForDay(dateKey);

  let entries = buildTimelineFromStoredTrips(rows, pointsByTripId);

  if (isToday && referenceNow != null) {
    let lastStayIdx = -1;
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (entries[index]?.kind === 'stay') {
        lastStayIdx = index;
        break;
      }
    }
    if (lastStayIdx >= 0) {
      const stay = entries[lastStayIdx] as DetectedTrip;
      entries = [
        ...entries.slice(0, lastStayIdx),
        {
          ...stay,
          openThroughNow: true,
          endAt: referenceNow,
          durationMs: differenceInMilliseconds(referenceNow, stay.startAt),
        },
        ...entries.slice(lastStayIdx + 1),
      ];
    }
  }

  return {
    dateKey,
    points: flattenTimelinePoints(
      entries.filter((entry): entry is DetectedTrip =>
        isPlayableTimelineEntry(entry),
      ),
    ),
    entries,
    range: {startAt: dayStart, endAt: rangeEnd},
  };
}

/** @deprecated Use loadHistoryFromStoredTrips */
export async function loadHistoryFromMaterializedTrips(
  dateKey: string,
): Promise<HistoryData> {
  return loadHistoryFromStoredTrips(dateKey);
}

/** Today: sealed closed trips from DB + live tail from recent GPS only. */
export async function loadTodayHistoryMerged(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  onPartial?: (data: HistoryData) => void,
): Promise<HistoryData> {
  const dateKey = getTodayDateKey();
  const {start: dayStart} = getDayRange(dateKey);
  const [tripRows, pointsByTripId] = await Promise.all([
    listTripsForDay(dateKey),
    listTripPointsForDay(dateKey),
  ]);
  const hasSealed =
    tripRows.length > 0 && dayHasStoredTripGeometry(tripRows, pointsByTripId);

  if (!hasSealed) {
    const {entries, dayPointCount} = await buildExplorerDayTimelineFromGps(
      dateKey,
      detectionConfig,
    );
    await persistClosedTripsIncremental(
      dateKey,
      detectionConfig,
      entries.filter(isClosedPlayableEntry),
      {pointCount: dayPointCount},
    );
    return loadHistoryFromStoredTrips(dateKey, undefined, referenceNow);
  }

  const sealedEndMs = sealedThroughMs(tripRows)!;
  const sealedData = await loadHistoryFromStoredTrips(
    dateKey,
    tripRows,
    referenceNow,
  );
  onPartial?.(sealedData);

  const tailLive = await buildExplorerHistoryForDay(
    dateKey,
    detectionConfig,
    referenceNow,
  );

  const mergedEntries = mergeSealedAndLiveTimeline(
    sealedData.entries,
    tailLive.entries,
    sealedEndMs,
  );

  return {
    dateKey,
    points: flattenTimelinePoints(
      mergedEntries.filter((entry): entry is DetectedTrip =>
        isPlayableTimelineEntry(entry),
      ),
    ),
    entries: mergedEntries,
    range: {
      startAt: dayStart,
      endAt: referenceNow,
    },
  };
}

export type LoadHistoryOptions = {
  force?: boolean;
  onPartial?: (data: HistoryData) => void;
};

export async function loadHistoryForSelectedDay(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  options?: LoadHistoryOptions,
): Promise<HistoryData> {
  const isToday = dateKey === getTodayDateKey();

  if (!options?.force && !isToday) {
    let [tripRows, materializedDay] = await Promise.all([
      listTripsForDay(dateKey),
      getMaterializedDay(dateKey),
    ]);

    if (
      materializedDay != null &&
      materializedDay.detectionVersion < TRIP_DETECTION_VERSION &&
      tripRows.length > 0
    ) {
      await purgeMaterializedDayCache(dateKey, materializedDay.pointCount);
      tripRows = [];
      materializedDay = null;
    }

    if (tripRows.length > 0) {
      const pointsByTripId = await listTripPointsForDay(dateKey);
      if (
        materializedDay?.detectionVersion === TRIP_DETECTION_VERSION &&
        dayHasStoredTripGeometry(tripRows, pointsByTripId)
      ) {
        return loadHistoryFromStoredTrips(
          dateKey,
          tripRows,
          undefined,
          detectionConfig,
        );
      }
    }
  }

  if (options?.force) {
    const materializedDay = await getMaterializedDay(dateKey);
    if (
      materializedDay != null &&
      materializedDay.detectionVersion < TRIP_DETECTION_VERSION
    ) {
      await purgeMaterializedDayCache(dateKey, materializedDay.pointCount);
    }
  }

  const referenceNow = new Date();

  if (!isToday) {
    const {entries, dayPointCount} = await buildExplorerDayTimelineFromGps(
      dateKey,
      detectionConfig,
    );
    await persistClosedTripsIncremental(
      dateKey,
      detectionConfig,
      entries.filter(isPersistableTimelineEntry),
      {
        fullReplace: true,
        forceComplete: true,
        pointCount: dayPointCount,
      },
    );
    return loadHistoryFromStoredTrips(
      dateKey,
      undefined,
      undefined,
      detectionConfig,
    );
  }

  const history = await loadTodayHistoryMerged(
    detectionConfig,
    referenceNow,
    options?.onPartial,
  );

  queuePersistClosedTrips(
    dateKey,
    detectionConfig,
    history,
    true,
    options?.force === true,
  );

  return history;
}

function queuePersistClosedTrips(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  history: HistoryData,
  isToday: boolean,
  force: boolean,
): void {
  const closedEntries = history.entries.filter(isPersistableTimelineEntry);
  setTimeout(() => {
    void persistClosedTripsIncremental(
      dateKey,
      detectionConfig,
      closedEntries,
      {
        fullReplace: !isToday || force,
        pointCount: history.points.length,
      },
    ).catch(() => undefined);
  }, 0);
}

/** @deprecated Use loadHistoryForSelectedDay */
export async function loadHistoryWithMaterialization(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
): Promise<HistoryData> {
  return loadHistoryForSelectedDay(dateKey, detectionConfig);
}

export function enqueueTripMaterializationForDay(
  _dateKey: string,
  _entries: DayTimelineEntry[],
): void {
  // Background materialization removed — days compute when the user opens them.
}

export function scheduleTripMaterializationWorker(): void {
  // No-op — background worker removed.
}

export async function enqueueSealForPreviousDayIfNeeded(): Promise<void> {
  await sealYesterdayIfNeeded();
}

export type PersistClosedTripsOptions = {
  fullReplace?: boolean;
  forceComplete?: boolean;
  pointCount?: number;
};

export async function persistClosedTripsIncremental(
  dateKey: string,
  _detectionConfig: TripDetectionConfig,
  closedEntries: Array<DetectedTrip | TimelineGap>,
  options: PersistClosedTripsOptions = {},
): Promise<number> {
  const isToday = dateKey === getTodayDateKey();
  const existingTrips = await listTripsForDay(dateKey);

  if (!options.fullReplace && isToday && closedEntries.length > 0) {
    const existingKeys = new Set(existingTrips.map(row => row.eventKey));
    const hasNewClosed = closedEntries.some(
      entry => !existingKeys.has(tripEventKey(entry)),
    );
    if (!hasNewClosed && existingKeys.size >= closedEntries.length) {
      return 0;
    }
  }

  const closedAt = new Date();
  const existingLabels = existingTripLabelsByEventKey(existingTrips);
  const savedPlaces = await listSavedPlaces();

  if (options.fullReplace) {
    await deleteTripsForDay(dateKey);
  }

  let upserted = 0;
  let segmentOrder = 0;
  for (const entry of closedEntries) {
    segmentOrder += 1;
    if (entry.kind === 'gap') {
      const centroid = {
        lat: (entry as TimelineGap & {fromLat?: number}).fromLat ?? 0,
        lng: (entry as TimelineGap & {fromLng?: number}).fromLng ?? 0,
      };
      await upsertTrip({
        eventKey: tripEventKey(entry),
        kind: 'missing',
        dateKey,
        startAt: entry.startAt,
        endAt: entry.endAt,
        durationMs: entry.durationMs,
        distanceKm: entry.distanceKm,
        centroidLat: centroid.lat,
        centroidLng: centroid.lng,
        segmentOrder,
        detectionVersion: TRIP_DETECTION_VERSION,
        closedAt,
      });
      upserted += 1;
      continue;
    }

    const centroid = tripCentroidForPersist(entry, savedPlaces);
    const placeLookup = await findPlaceLookupNearAnchor(centroid);
    const eventKey = tripEventKey(entry);
    const labels = tripLabelForPersist(eventKey, existingLabels, placeLookup);
    const row = await upsertTrip({
      eventKey,
      kind: entry.kind,
      dateKey,
      startAt: entry.startAt,
      endAt: entry.endAt,
      durationMs: entry.durationMs,
      distanceKm: entry.distanceKm,
      centroidLat: centroid.lat,
      centroidLng: centroid.lng,
      segmentOrder,
      savedPlaceLabel: entry.savedPlaceLabel ?? null,
      savedPlaceId: entry.savedPlaceId ?? null,
      inferred: entry.inferred ?? false,
      placeLookupCacheId: labels.placeLookupCacheId,
      selectedCandidateIndex: labels.selectedCandidateIndex,
      detectionVersion: TRIP_DETECTION_VERSION,
      closedAt,
    });
    upserted += 1;
    const geometry = geometryPointsForPersist(entry, centroid);
    if (geometry.length > 0) {
      await replaceTripPointsFromLocations(row.id, geometry);
    }
  }

  const finalTripRows =
    upserted > 0 || options.fullReplace
      ? await listTripsForDay(dateKey)
      : existingTrips;
  const tripCount = finalTripRows.length;
  const pointCount = options.pointCount ?? 0;
  const materializedDay = await getMaterializedDay(dateKey);
  const sealedMs = sealedThroughMs(finalTripRows);
  const status = options.forceComplete
    ? 'complete'
    : isToday
      ? 'open'
      : closedEntries.length > 0
        ? 'complete'
        : 'open';

  await upsertMaterializedDay(dateKey, {
    status,
    detectionVersion: TRIP_DETECTION_VERSION,
    tripCount,
    pointCount,
    sealedAt:
      status === 'complete'
        ? materializedDay?.sealedAt ?? closedAt
        : sealedMs != null
          ? new Date(sealedMs)
          : materializedDay?.sealedAt ?? null,
  });

  if (options.fullReplace || options.forceComplete || !isToday) {
    clearHistoryDataCache();
  }
  notifyMaterializationUpdated();
  return upserted;
}

/** @deprecated Use persistClosedTripsIncremental */
async function persistClosedTripsForDay(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  preloaded?: HistoryData,
): Promise<number> {
  const {entries, dayPointCount} = await buildExplorerDayTimelineFromGps(
    dateKey,
    detectionConfig,
  );
  return persistClosedTripsIncremental(
    dateKey,
    detectionConfig,
    entries.filter(isPersistableTimelineEntry),
    {fullReplace: true, pointCount: dayPointCount},
  );
}

/** Finalize yesterday once the calendar day has turned. */
export async function sealYesterdayIfNeeded(): Promise<void> {
  const todayKey = getTodayDateKey();
  const yesterdayKey = toDateKey(subDays(parseDateKey(todayKey), 1));
  const materializedDay = await getMaterializedDay(yesterdayKey);
  if (materializedDay?.status === 'complete') {
    return;
  }

  const detectionConfig = getDefaultTripDetectionConfig();
  const {entries, dayPointCount} = await buildExplorerDayTimelineFromGps(
    yesterdayKey,
    detectionConfig,
  );
  await persistClosedTripsIncremental(
    yesterdayKey,
    detectionConfig,
    entries.filter(isPersistableTimelineEntry),
    {
      fullReplace: true,
      forceComplete: true,
      pointCount: dayPointCount,
    },
  );
}

export async function drainMaterializationQueue(
  _detectionConfig: TripDetectionConfig = getDefaultTripDetectionConfig(),
): Promise<void> {
  // No-op — background worker removed.
}

/** Create or refresh a trip row when the user labels an older visit. */
export async function ensureTripForClosedStay(
  stay: DetectedTrip,
  dateKey: string,
): Promise<TripRow | null> {
  if (stay.kind !== 'stay' || stay.openThroughNow) {
    return null;
  }

  const centroid = tripCentroid(stay);
  const placeLookup = await findPlaceLookupNearAnchor(centroid);
  const closedAt = new Date();

  let trip =
    stay.materializedTripId != null
      ? await getTripById(stay.materializedTripId)
      : await getTripByEventKey(tripEventKey(stay));

  if (!trip) {
    trip = await insertTripIfAbsent({
      eventKey: tripEventKey(stay),
      kind: 'stay',
      dateKey,
      startAt: stay.startAt,
      endAt: stay.endAt,
      durationMs: stay.durationMs,
      distanceKm: stay.distanceKm,
      centroidLat: centroid.lat,
      centroidLng: centroid.lng,
      placeLookupCacheId: placeLookup?.id ?? null,
      selectedCandidateIndex: placeLookup?.selectedCandidateIndex ?? null,
      detectionVersion: TRIP_DETECTION_VERSION,
      closedAt,
    });
  }

  if (
    trip != null &&
    trip.placeLookupCacheId == null &&
    placeLookup?.id != null
  ) {
    await setTripPlaceLookupCacheId(trip.id, placeLookup.id);
    trip = {...trip, placeLookupCacheId: placeLookup.id};
  }

  return trip;
}

export type ResetMaterializedTripHistoryResult = {
  tripsDeleted: number;
  materializedDaysDeleted: number;
  queueJobsDeleted: number;
};

/** Drop legacy motion rows and rebuild cached visit/drive summaries from GPS. */
export async function purgeLegacyMotionLocationData(): Promise<
  ResetMaterializedTripHistoryResult & {motionPointsDeleted: number}
> {
  const motionPointsDeleted = await deleteMotionLocationPoints();
  const reset = await resetMaterializedTripHistory();
  return {
    motionPointsDeleted,
    ...reset,
  };
}

/** Drop cached visit/drive rows so history rebuilds from GPS. */
export async function resetMaterializedTripHistory(): Promise<ResetMaterializedTripHistoryResult> {
  const [tripsDeleted, materializedDaysDeleted] = await Promise.all([
    deleteAllTrips(),
    deleteAllMaterializedDays(),
  ]);
  await deleteAllTripPoints();

  clearHistoryDataCache();
  notifyMaterializationUpdated();

  return {
    tripsDeleted,
    materializedDaysDeleted,
    queueJobsDeleted: 0,
  };
}

export type RebuildPastTripsProgress = {
  completed: number;
  total: number;
  dateKey: string;
};

export type RebuildPastTripsResult = {
  daysProcessed: number;
  tripsSaved: number;
};

function listPastDateKeysWithGps(): Promise<string[]> {
  const todayKey = getTodayDateKey();
  return getDateKeysWithLocationData().then(keys =>
    keys.filter(key => key < todayKey).sort(),
  );
}

/** Recompute visits/drives for one past day using the point-explorer algorithm. */
export async function rebuildPastDayTrips(
  dateKey: string,
  detectionConfig: TripDetectionConfig = getDefaultTripDetectionConfig(),
): Promise<number> {
  if (dateKey >= getTodayDateKey()) {
    throw new Error('Trip rebuild is only available for past days.');
  }

  const {entries, dayPointCount} = await buildExplorerDayTimelineFromGps(
    dateKey,
    detectionConfig,
  );
  return persistClosedTripsIncremental(
    dateKey,
    detectionConfig,
    entries.filter(isPersistableTimelineEntry),
    {
      fullReplace: true,
      forceComplete: true,
      pointCount: dayPointCount,
    },
  );
}

/** Foreground rebuild for all past days that have GPS data. */
export async function rebuildAllPastDayTrips(
  detectionConfig: TripDetectionConfig = getDefaultTripDetectionConfig(),
  onProgress?: (progress: RebuildPastTripsProgress) => void,
): Promise<RebuildPastTripsResult> {
  await resetMaterializedTripHistory();
  const dateKeys = await listPastDateKeysWithGps();
  let tripsSaved = 0;

  for (let index = 0; index < dateKeys.length; index += 1) {
    const dateKey = dateKeys[index]!;
    onProgress?.({
      completed: index,
      total: dateKeys.length,
      dateKey,
    });
    tripsSaved += await rebuildPastDayTrips(dateKey, detectionConfig);
    await yieldToEventLoop();
  }

  onProgress?.({
    completed: dateKeys.length,
    total: dateKeys.length,
    dateKey: dateKeys[dateKeys.length - 1] ?? '',
  });

  return {
    daysProcessed: dateKeys.length,
    tripsSaved,
  };
}

export type {TripRow};
export {TRIP_DETECTION_VERSION} from '@/lib/trip-settings';
