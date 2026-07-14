import { differenceInMilliseconds, endOfDay, subDays } from 'date-fns';

import { extractTripLabelOverrides } from '@/lib/backup/backup-export';
import { applyTripLabelOverrides } from '@/lib/backup/backup-import';
import {
  listDateKeysWithLocationDataBefore,
  type LocationPointRow,
} from '@/db/repositories/location-days';
import { deleteMotionLocationPoints } from '@/db/repositories/location-points';
import {
  deleteAllMaterializedDays,
  getMaterializedDay,
  upsertMaterializedDay,
} from '@/db/repositories/materialized-days';
import {
  dayHasStoredTripGeometry,
  deleteAllTripPoints,
  listTripPointsForDay,
  replaceTripPersistPoints,
} from '@/db/repositories/trip-points';
import { listSavedPlaces } from '@/db/repositories/saved-places';
import {
  resolvedPlaceFromTripRow,
  tripPlaceFieldsFromResolved,
  type ResolvedPlaceFields,
} from '@/lib/resolved-place';
import { matchSavedPlaceForPoint } from '@/lib/saved-places';
import { getMomentsForDay, type MomentRow } from '@/db/repositories/moments';
import {
  deleteAllTrips,
  deleteTripsForDay,
  deleteTripsForDayExceptEventKeys,
  getTripByEventKey,
  getTripById,
  insertTripIfAbsent,
  listAllTrips,
  listTripsForDay,
  applyTripPersistedLabel,
  upsertTrip,
  type TripRow,
} from '@/db/repositories/trips';
import {
  deleteVisitLabelOverrideById,
  listVisitLabelOverridesForDay,
} from '@/db/repositories/visit-label-overrides';
import {
  getDayRange,
  getTodayDateKey,
  parseDateKey,
  toDateKey,
} from '@/lib/day-utils';
import type { HistoryData } from '@/lib/history-data-types';
import {
  mergeOverrideIntoPersistLabel,
  takeVisitLabelOverrideForStart,
} from '@/lib/visit-label-override';
import { clearHistoryDataCache } from '@/lib/history-data-cache';
import { isCurrentHistoryDayLoad } from '@/lib/history-load-generation';
import { yieldToEventLoop } from '@/lib/run-when-idle';
import { buildExplorerDayTimelineFromGps } from '@/lib/explorer-day-trips';
import { splitEntriesForPastDaySeal } from '@/lib/past-day-seal-policy';
import { buildTimelineFromStoredTrips } from '@/lib/timeline-from-trips';
import {
  flattenTimelinePoints,
  travelCentroidFromRoute,
} from '@/lib/trip-geometry';
import { notifyMaterializationUpdated } from '@/lib/trip-materialization-events';
import { resolveVisitAnchor } from '@/lib/visit-anchor';
import { canonicalizeStayGeometryForPersist } from '@/lib/stay-geometry';
import {
  getGeometryPersistFingerprint,
  isCanonicalTravelGeometryEnabled,
} from '@/lib/trip-geometry-settings';
import { canonicalizeTravelGeometryForPersist } from '@/lib/travel-geometry';
import type { PersistTripPointInput } from '@/db/repositories/trip-points';
import { buildMomentRefsForSegment } from '@/lib/moment-refs';
import { sealedThroughMs } from '@/lib/today-sealed-history';
import { getSealableTodayEntries } from '@/lib/today-seal-policy';
import { syncTodayDisplay, syncTodayTrips } from '@/lib/today-sync';
import {
  isPlayableTimelineEntry,
  type DayTimelineEntry,
  type DetectedTrip,
  type TimelineGap,
} from '@/lib/trip-detection';
import {
  DEFAULT_TRIP_DWELL_MINUTES,
  DEFAULT_TRIP_GAP_MINUTES,
  HISTORY_SAME_PLACE_RADIUS_METERS,
  TRIP_DETECTION_VERSION,
} from '@/lib/app-constants';
import {
  buildTripDetectionConfig,
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
    excludedCrossMidnightFromMs: null,
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

/** Whether today's incremental seal should upsert or prune stale rows. */
export function todaySealNeedsPersist(
  existingTrips: readonly { eventKey: string }[],
  closedEntries: ReadonlyArray<
    Pick<DetectedTrip, 'kind' | 'startAt' | 'endAt'> | TimelineGap
  >,
): boolean {
  const existingKeys = new Set(existingTrips.map(row => row.eventKey));
  const sealableKeys = new Set(closedEntries.map(tripEventKey));
  const hasObsolete = existingTrips.some(
    row => !sealableKeys.has(row.eventKey),
  );
  const hasNewClosed = closedEntries.some(
    entry => !existingKeys.has(tripEventKey(entry)),
  );
  return hasNewClosed || hasObsolete;
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

export type PersistedTripLabel = ResolvedPlaceFields;

function persistedLabelFromTripRow(row: TripRow): PersistedTripLabel {
  return resolvedPlaceFromTripRow(row);
}

/** User label choices keyed by stable trip event id — survives day re-materialization. */
export function existingTripLabelsByEventKey(
  rows: readonly TripRow[],
): Map<string, PersistedTripLabel> {
  const map = new Map<string, PersistedTripLabel>();
  for (const row of rows) {
    const label = persistedLabelFromTripRow(row);
    const hasLabel =
      label.poiId != null || label.placeLabel != null || label.placeId != null;
    if (!hasLabel) {
      continue;
    }
    map.set(row.eventKey, label);
  }
  return map;
}

export type DetectedTripLabels = ResolvedPlaceFields;

export function tripLabelForPersist(
  eventKey: string,
  existingByEventKey: ReadonlyMap<string, PersistedTripLabel>,
  detected?: DetectedTripLabels,
): PersistedTripLabel {
  const existing = existingByEventKey.get(eventKey);
  const detectedPlace = tripPlaceFieldsFromResolved({
    placeLabel: detected?.placeLabel ?? null,
    placeId: detected?.placeId ?? null,
    placeKind: detected?.placeKind ?? null,
    poiId: detected?.poiId ?? null,
    poiLabel: detected?.poiLabel ?? null,
    poiCategory: detected?.poiCategory ?? null,
  });

  if (existing?.poiId != null) {
    return {
      placeLabel: existing.placeLabel ?? detectedPlace.placeLabel,
      placeId: existing.placeId ?? detectedPlace.placeId,
      placeKind: existing.placeKind ?? detectedPlace.placeKind,
      poiId: existing.poiId,
      poiLabel: existing.poiLabel,
      poiCategory: existing.poiCategory ?? detectedPlace.poiCategory,
    };
  }

  if (existing?.placeKind === 'saved' && existing.placeId != null) {
    return existing;
  }

  if (detectedPlace.placeKind != null && detectedPlace.placeId != null) {
    return detectedPlace;
  }

  return (
    existing ?? {
      placeLabel: null,
      placeId: null,
      placeKind: null,
      poiId: null,
      poiLabel: null,
      poiCategory: null,
    }
  );
}

export function getDefaultTripDetectionConfig(): TripDetectionConfig {
  return buildTripDetectionConfig(
    DEFAULT_TRIP_GAP_MINUTES,
    DEFAULT_TRIP_DWELL_MINUTES,
    HISTORY_SAME_PLACE_RADIUS_METERS,
  );
}

function locationPointsToPersistPoints(
  points: readonly LocationPointRow[],
): PersistTripPointInput[] {
  return points.map(point => ({
    lat: point.lat,
    lng: point.lng,
    recordedAt: point.timestamp,
    locationPointId: point.id > 0 ? point.id : null,
    source: point.source ?? 'gps',
    momentId: null,
  }));
}

function geometryPointsForPersist(
  entry: DetectedTrip,
  centroid: { lat: number; lng: number },
  moments: readonly MomentRow[],
  canonicalizeTravel: boolean,
): PersistTripPointInput[] {
  /** Persist pipeline: detection segments → stay canonical geometry → travel (if enabled). */
  if (entry.kind === 'travel') {
    if (entry.points.length === 0) {
      return [];
    }
    if (!canonicalizeTravel) {
      return locationPointsToPersistPoints(entry.points);
    }
    return canonicalizeTravelGeometryForPersist(
      entry.points,
      moments,
      entry.startAt,
      entry.endAt,
    );
  }
  if (entry.kind === 'stay') {
    return canonicalizeStayGeometryForPersist(entry, centroid, moments);
  }
  return [];
}

function tripCentroidForPersist(
  trip: DetectedTrip,
  savedPlaces: Awaited<ReturnType<typeof listSavedPlaces>>,
): { lat: number; lng: number } {
  if (trip.kind === 'stay') {
    if (trip.anchorLat != null && trip.anchorLng != null) {
      if (savedPlaces.length > 0) {
        const anchorMatch = matchSavedPlaceForPoint(
          { lat: trip.anchorLat, lng: trip.anchorLng },
          savedPlaces,
        );
        if (anchorMatch != null) {
          return { lat: anchorMatch.lat, lng: anchorMatch.lng };
        }
      }
      return { lat: trip.anchorLat, lng: trip.anchorLng };
    }
    return resolveVisitAnchor(trip.points, savedPlaces);
  }
  return travelCentroidFromRoute(trip.points);
}

async function pastDayCanLoadFromStore(
  dateKey: string,
  tripRows: readonly TripRow[],
): Promise<boolean> {
  if (tripRows.length === 0) {
    return false;
  }
  const [pointsByTripId, materializedDay, geometryFingerprint] =
    await Promise.all([
      listTripPointsForDay(dateKey),
      getMaterializedDay(dateKey),
      getGeometryPersistFingerprint(),
    ]);
  return (
    materializedDay?.detectionVersion === TRIP_DETECTION_VERSION &&
    materializedDay.geometryFingerprint === geometryFingerprint &&
    dayHasStoredTripGeometry(tripRows, pointsByTripId)
  );
}

/**
 * Past day materialization: 1st-algorithm detection on GPS, then persist
 * trip_points with canonical stay geometry and travel geometry when enabled
 * in Settings.
 */
async function materializePastDayFromGps(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
): Promise<number> {
  const { entries, dayPointCount } = await buildExplorerDayTimelineFromGps(
    dateKey,
    detectionConfig,
  );
  const { sealable, excludedCrossMidnightFromMs } = splitEntriesForPastDaySeal(
    entries,
    dateKey,
  );
  const upserted = await persistClosedTripsIncremental(
    dateKey,
    detectionConfig,
    sealable,
    {
      fullReplace: true,
      forceComplete: true,
      pointCount: dayPointCount,
      excludedCrossMidnightFromMs,
    },
  );
  return upserted;
}

export type LoadHistoryFromStoredTripsOptions = {
  /**
   * Today only. Default false: sealed DB rows stay closed; the live tail owns
   * openThroughNow / "Still here". Set true only for legacy callers that load
   * sealed rows without a tail merge.
   */
  markLastStayOpen?: boolean;
};

function lastPlayableTimelineEntry(
  entries: readonly DayTimelineEntry[],
): DetectedTrip | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (isPlayableTimelineEntry(entry)) {
      return entry;
    }
  }
  return null;
}

/** Sealed rows alone cannot represent today when a drive or open visit is still in progress. */
export function todayStoredHistoryNeedsLiveTail(
  entries: readonly DayTimelineEntry[],
): boolean {
  const last = lastPlayableTimelineEntry(entries);
  if (last == null) {
    return true;
  }
  if (last.kind === 'travel') {
    return true;
  }
  return !last.openThroughNow;
}

export async function loadHistoryFromStoredTrips(
  dateKey: string,
  tripRows?: TripRow[],
  referenceNow?: Date,
  _detectionConfig: TripDetectionConfig = getDefaultTripDetectionConfig(),
  options: LoadHistoryFromStoredTripsOptions = {},
): Promise<HistoryData> {
  const { start: dayStart } = getDayRange(dateKey);
  const isToday = dateKey === getTodayDateKey();
  const rangeEnd =
    referenceNow != null && isToday ? referenceNow : endOfDay(dayStart);
  const rows = tripRows ?? (await listTripsForDay(dateKey));
  const markLastStayOpen = options.markLastStayOpen === true;

  if (rows.length === 0) {
    return {
      dateKey,
      points: [],
      entries: [],
      range: { startAt: dayStart, endAt: rangeEnd },
    };
  }

  const pointsByTripId = await listTripPointsForDay(dateKey);

  let entries = buildTimelineFromStoredTrips(rows, pointsByTripId);

  if (isToday && referenceNow != null && markLastStayOpen) {
    let lastStayIdx = -1;
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (entries[index]?.kind === 'stay') {
        lastStayIdx = index;
        break;
      }
    }
    const hasTravelAfterLastStay =
      lastStayIdx >= 0 &&
      entries.slice(lastStayIdx + 1).some(entry => entry.kind === 'travel');
    if (lastStayIdx >= 0 && !hasTravelAfterLastStay) {
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
    range: { startAt: dayStart, endAt: rangeEnd },
  };
}

/** @deprecated Use loadHistoryFromStoredTrips */
export async function loadHistoryFromMaterializedTrips(
  dateKey: string,
): Promise<HistoryData> {
  return loadHistoryFromStoredTrips(dateKey);
}

/** Persist settled today segments — skips the live tail buffer. */
export async function persistTodaySealableSegments(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): Promise<number> {
  const { entries, dayPointCount } = await buildExplorerDayTimelineFromGps(
    dateKey,
    detectionConfig,
  );
  const sealable = getSealableTodayEntries(
    entries,
    referenceNow,
    detectionConfig,
  );
  if (sealable.length === 0) {
    return 0;
  }
  return persistClosedTripsIncremental(dateKey, detectionConfig, sealable, {
    pointCount: dayPointCount,
  });
}

/** Today: trips-first sync with incremental extend / tail merge. */
export async function loadTodayHistoryMerged(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  onPartial?: (data: HistoryData) => void,
): Promise<HistoryData> {
  return syncTodayTrips(detectionConfig, referenceNow, { onPartial });
}

export type LoadHistoryOptions = {
  force?: boolean;
  /** Read sealed trips from DB without running live GPS detection. */
  preferStored?: boolean;
  onPartial?: (data: HistoryData) => void;
  loadGeneration?: number;
};

function isStaleHistoryLoad(loadGeneration?: number): boolean {
  return loadGeneration != null && !isCurrentHistoryDayLoad(loadGeneration);
}

function emptyHistoryForDateKey(dateKey: string): HistoryData {
  const { start: dayStart } = getDayRange(dateKey);
  return {
    dateKey,
    points: [],
    entries: [],
    range: { startAt: dayStart, endAt: endOfDay(dayStart) },
  };
}

export async function loadHistoryForSelectedDay(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  options?: LoadHistoryOptions,
): Promise<HistoryData> {
  const isToday = dateKey === getTodayDateKey();
  const referenceNow = new Date();

  if (isToday) {
    return syncTodayDisplay(detectionConfig, referenceNow, {
      onPartial: options?.onPartial,
    });
  }

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
      const canLoadFromStore = await pastDayCanLoadFromStore(dateKey, tripRows);
      if (canLoadFromStore) {
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

  if (isStaleHistoryLoad(options?.loadGeneration)) {
    return emptyHistoryForDateKey(dateKey);
  }

  await materializePastDayFromGps(dateKey, detectionConfig);

  if (isStaleHistoryLoad(options?.loadGeneration)) {
    return emptyHistoryForDateKey(dateKey);
  }

  return loadHistoryFromStoredTrips(
    dateKey,
    undefined,
    undefined,
    detectionConfig,
  );
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
  excludedCrossMidnightFromMs?: number | null;
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
    if (!todaySealNeedsPersist(existingTrips, closedEntries)) {
      return 0;
    }
  }

  const closedAt = new Date();
  const existingLabels = existingTripLabelsByEventKey(existingTrips);
  const savedPlaces = await listSavedPlaces();
  const { start: dayStart, end: dayEnd } = getDayRange(dateKey);
  const [dayMoments, canonicalizeTravel, geometryFingerprint, listedOverrides] =
    await Promise.all([
      getMomentsForDay(dayStart, dayEnd),
      isCanonicalTravelGeometryEnabled(),
      getGeometryPersistFingerprint(),
      listVisitLabelOverridesForDay(dateKey),
    ]);
  // Mutable: each consumed override is removed so fuzzy matching cannot reuse it.
  const dayOverrides = [...listedOverrides];

  if (options.fullReplace) {
    await deleteTripsForDay(dateKey);
  } else if (isToday && closedEntries.length > 0) {
    const keepEventKeys = new Set(closedEntries.map(tripEventKey));
    await deleteTripsForDayExceptEventKeys(dateKey, keepEventKeys);
  }

  let upserted = 0;
  let segmentOrder = 0;
  for (const entry of closedEntries) {
    segmentOrder += 1;
    if (entry.kind === 'gap') {
      const centroid = {
        lat: (entry as TimelineGap & { fromLat?: number }).fromLat ?? 0,
        lng: (entry as TimelineGap & { fromLng?: number }).fromLng ?? 0,
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
    const eventKey = tripEventKey(entry);
    const override =
      entry.kind === 'stay'
        ? takeVisitLabelOverrideForStart(dayOverrides, entry.startAt.getTime())
        : null;
    const labels = mergeOverrideIntoPersistLabel(
      tripLabelForPersist(eventKey, existingLabels, {
        placeLabel: entry.placeLabel ?? null,
        placeId: entry.placeId ?? null,
        placeKind: entry.placeKind ?? null,
        poiId: entry.poiId ?? null,
        poiLabel: entry.poiLabel ?? null,
        poiCategory: entry.poiCategory ?? null,
      }),
      override,
    );
    const momentRefs = buildMomentRefsForSegment(
      dayMoments,
      entry.startAt,
      entry.endAt,
    );
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
      placeLabel: labels.placeLabel,
      placeId: labels.placeId,
      placeKind: labels.placeKind,
      poiId: labels.poiId,
      inferred: entry.inferred ?? false,
      detectionVersion: TRIP_DETECTION_VERSION,
      closedAt,
      momentRefs,
    });
    upserted += 1;
    if (override != null) {
      await deleteVisitLabelOverrideById(override.id);
    }
    const geometry = geometryPointsForPersist(
      entry,
      centroid,
      dayMoments,
      canonicalizeTravel,
    );
    if (geometry.length > 0) {
      await replaceTripPersistPoints(row.id, geometry);
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
    geometryFingerprint,
    excludedCrossMidnightFromMs:
      options.forceComplete && !isToday
        ? (options.excludedCrossMidnightFromMs ?? null)
        : (materializedDay?.excludedCrossMidnightFromMs ?? null),
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

/** Finalize yesterday once the calendar day has turned. */
export async function sealYesterdayIfNeeded(): Promise<void> {
  const todayKey = getTodayDateKey();
  const yesterdayKey = toDateKey(subDays(parseDateKey(todayKey), 1));
  const materializedDay = await getMaterializedDay(yesterdayKey);
  if (materializedDay?.status === 'complete') {
    return;
  }

  const detectionConfig = getDefaultTripDetectionConfig();
  await materializePastDayFromGps(yesterdayKey, detectionConfig);
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

  const savedPlaces = await listSavedPlaces();
  const centroid = tripCentroidForPersist(stay, savedPlaces);
  const closedAt = new Date();
  const eventKey = tripEventKey(stay);

  let trip =
    stay.materializedTripId != null
      ? await getTripById(stay.materializedTripId)
      : await getTripByEventKey(eventKey);

  const labels = tripLabelForPersist(eventKey, new Map(), {
    placeLabel: stay.placeLabel ?? null,
    placeId: stay.placeId ?? null,
    placeKind: stay.placeKind ?? null,
    poiId: stay.poiId ?? null,
    poiLabel: stay.poiLabel ?? null,
    poiCategory: stay.poiCategory ?? null,
  });

  if (!trip) {
    trip = await insertTripIfAbsent({
      eventKey,
      kind: 'stay',
      dateKey,
      startAt: stay.startAt,
      endAt: stay.endAt,
      durationMs: stay.durationMs,
      distanceKm: stay.distanceKm,
      centroidLat: centroid.lat,
      centroidLng: centroid.lng,
      placeLabel: labels.placeLabel,
      placeId: labels.placeId,
      placeKind: labels.placeKind,
      poiId: labels.poiId,
      detectionVersion: TRIP_DETECTION_VERSION,
      closedAt,
    });
    if (trip != null) {
      trip = { ...trip, ...labels };
    }
  } else if (
    trip.placeId == null &&
    labels.placeId != null &&
    labels.placeKind != null
  ) {
    await applyTripPersistedLabel(trip.id, labels);
    trip = { ...trip, ...labels };
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
  ResetMaterializedTripHistoryResult & { motionPointsDeleted: number }
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
  phase: 'past' | 'today';
  completed: number;
  total: number;
  dateKey: string;
};

export type RebuildPastTripsResult = {
  daysProcessed: number;
  tripsSaved: number;
  todayTripsSaved: number;
};

function listPastDateKeysWithGps(): Promise<string[]> {
  return listDateKeysWithLocationDataBefore(getTodayDateKey());
}

/** Recompute visits/drives for one past day using the point-explorer algorithm. */
export async function rebuildPastDayTrips(
  dateKey: string,
  detectionConfig: TripDetectionConfig = getDefaultTripDetectionConfig(),
): Promise<number> {
  if (dateKey >= getTodayDateKey()) {
    throw new Error('Trip rebuild is only available for past days.');
  }

  const tripsSaved = await materializePastDayFromGps(dateKey, detectionConfig);
  return tripsSaved;
}

/** Wipe today's cached trips and re-seal the current prefix from GPS. */
export async function rebuildTodayTrips(
  detectionConfig: TripDetectionConfig = getDefaultTripDetectionConfig(),
  referenceNow: Date = new Date(),
): Promise<number> {
  const dateKey = getTodayDateKey();
  const { entries, dayPointCount } = await buildExplorerDayTimelineFromGps(
    dateKey,
    detectionConfig,
  );
  const sealable = getSealableTodayEntries(
    entries,
    referenceNow,
    detectionConfig,
  );

  if (sealable.length === 0) {
    const existing = await listTripsForDay(dateKey);
    if (existing.length === 0) {
      return 0;
    }
    // Open-home stays are not sealable — keep existing rows until departure.
    return 0;
  }

  const tripsSaved = await persistClosedTripsIncremental(
    dateKey,
    detectionConfig,
    sealable,
    {
      fullReplace: true,
      pointCount: dayPointCount,
    },
  );
  return tripsSaved;
}

/** Foreground rebuild for all past days that have GPS data. */
export async function rebuildAllPastDayTrips(
  detectionConfig: TripDetectionConfig = getDefaultTripDetectionConfig(),
  onProgress?: (progress: RebuildPastTripsProgress) => void,
): Promise<RebuildPastTripsResult> {
  return rebuildAllTrips(detectionConfig, onProgress, new Date(), {
    includeToday: false,
  });
}

/** Rebuild past days (complete) + today's sealable prefix from GPS. */
export async function rebuildAllTrips(
  detectionConfig: TripDetectionConfig = getDefaultTripDetectionConfig(),
  onProgress?: (progress: RebuildPastTripsProgress) => void,
  referenceNow: Date = new Date(),
  options: { includeToday?: boolean } = {},
): Promise<RebuildPastTripsResult> {
  const includeToday = options.includeToday ?? true;
  const existingTrips = await listAllTrips();
  const labelOverrides = extractTripLabelOverrides(
    existingTrips.map(row => ({
      eventKey: row.eventKey,
      placeLabel: row.placeLabel,
      placeId: row.placeId,
      placeKind: row.placeKind,
      poiId: row.poiId,
      poiLabel: row.poiLabel,
      poiCategory: row.poiCategory,
    })),
  );

  await resetMaterializedTripHistory();
  const dateKeys = await listPastDateKeysWithGps();
  const totalSteps = dateKeys.length + (includeToday ? 1 : 0);
  let tripsSaved = 0;

  for (let index = 0; index < dateKeys.length; index += 1) {
    const dateKey = dateKeys[index]!;
    onProgress?.({
      phase: 'past',
      completed: index,
      total: totalSteps,
      dateKey,
    });
    tripsSaved += await rebuildPastDayTrips(dateKey, detectionConfig);
    await yieldToEventLoop();
  }

  let todayTripsSaved = 0;
  if (includeToday) {
    onProgress?.({
      phase: 'today',
      completed: dateKeys.length,
      total: totalSteps,
      dateKey: getTodayDateKey(),
    });
    todayTripsSaved = await rebuildTodayTrips(detectionConfig, referenceNow);
    tripsSaved += todayTripsSaved;
  }

  if (labelOverrides.length > 0) {
    await applyTripLabelOverrides(labelOverrides);
  }

  clearHistoryDataCache();
  notifyMaterializationUpdated();

  onProgress?.({
    phase: includeToday ? 'today' : 'past',
    completed: totalSteps,
    total: totalSteps,
    dateKey: includeToday
      ? getTodayDateKey()
      : dateKeys[dateKeys.length - 1] ?? '',
  });

  return {
    daysProcessed: dateKeys.length,
    tripsSaved,
    todayTripsSaved,
  };
}

export type { TripRow };
