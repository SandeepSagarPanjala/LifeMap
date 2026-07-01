import {differenceInMilliseconds} from 'date-fns';

import {
  getLocationPointsAfterInDay,
  getLocationPointsForDay,
  type LocationPointRow,
} from '@/db/repositories/location-days';
import {getMaterializedDay, upsertMaterializedDay} from '@/db/repositories/materialized-days';
import {
  listTripsForDay,
  updateTripEndTime,
  upsertTrip,
  type TripRow,
} from '@/db/repositories/trips';
import {getDayRange, getTodayDateKey} from '@/lib/day-utils';
import type {HistoryData} from '@/lib/history-data-types';
import {getSealableTodayEntries} from '@/lib/today-seal-policy';
import {
  buildTodayDisplayHistory,
  buildTodayTailDisplayHistory,
  historyDataFromEntries,
} from '@/lib/today-live-history';
import {
  mergeSealedAndLiveTimeline,
  sealedThroughMs,
  tailGpsStartMs,
} from '@/lib/today-sealed-history';
import {
  arePointsSamePlace,
  isPlayableTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';
import {notifyMaterializationUpdated} from '@/lib/trip-materialization-events';
import {
  getGeometryPersistFingerprint,
} from '@/lib/trip-geometry-settings';
import {TRIP_DETECTION_VERSION, type TripDetectionConfig} from '@/lib/trip-settings';

async function loadHistoryFromStoredTripsToday(
  dateKey: string,
  tripRows: TripRow[],
  detectionConfig: TripDetectionConfig,
  referenceNow: Date,
): Promise<HistoryData> {
  const {loadHistoryFromStoredTrips} = await import('@/lib/trip-materialization');
  return loadHistoryFromStoredTrips(
    dateKey,
    tripRows,
    referenceNow,
    detectionConfig,
    {markLastStayOpen: true},
  );
}

async function persistSealableToday(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  sealable: DetectedTrip[],
  pointCount: number,
): Promise<void> {
  const {persistClosedTripsIncremental} = await import(
    '@/lib/trip-materialization'
  );
  await persistClosedTripsIncremental(dateKey, detectionConfig, sealable, {
    pointCount,
  });
}

async function sealNeedsPersist(
  tripRows: TripRow[],
  sealable: DetectedTrip[],
): Promise<boolean> {
  const {todaySealNeedsPersist} = await import('@/lib/trip-materialization');
  return todaySealNeedsPersist(tripRows, sealable);
}

export type SyncTodayTripsOptions = {
  force?: boolean;
  /** Skip silent full-day DB repair (e.g. foreground tail refresh). */
  skipRepair?: boolean;
  onPartial?: (data: HistoryData) => void;
};

/** Stable event key for today's in-progress stay row. */
export function openStayEventKey(startAt: Date): string {
  return `stay:${startAt.getTime()}:open`;
}

function lastPlayableStay(tripRows: readonly TripRow[]): TripRow | null {
  for (let index = tripRows.length - 1; index >= 0; index -= 1) {
    const row = tripRows[index]!;
    if (row.kind === 'stay') {
      return row;
    }
    if (row.kind === 'travel') {
      return null;
    }
  }
  return null;
}

/** True when new GPS since seal still looks like the same open visit. */
export function canExtendOpenStayWithNewPoints(
  lastStay: TripRow,
  newPoints: readonly LocationPointRow[],
  config: TripDetectionConfig,
): boolean {
  if (lastStay.kind !== 'stay') {
    return false;
  }
  if (newPoints.length === 0) {
    return true;
  }
  const anchor = {lat: lastStay.centroidLat, lng: lastStay.centroidLng};
  return newPoints.every(point =>
    arePointsSamePlace({lat: point.lat, lng: point.lng}, anchor, config),
  );
}

/** Clock-only stay extend — only when the latest GPS still matches the open visit. */
export async function canClockExtendOpenStayAtLastGps(
  dateKey: string,
  lastStay: TripRow,
  config: TripDetectionConfig,
): Promise<boolean> {
  if (lastStay.kind !== 'stay') {
    return false;
  }
  const dayPoints = await getLocationPointsForDay(dateKey);
  const lastPoint = dayPoints.at(-1);
  if (lastPoint == null) {
    return true;
  }
  const anchor = {lat: lastStay.centroidLat, lng: lastStay.centroidLng};
  return arePointsSamePlace(
    {lat: lastPoint.lat, lng: lastPoint.lng},
    anchor,
    config,
  );
}

async function loadTodayFromTrips(
  dateKey: string,
  tripRows: TripRow[],
  detectionConfig: TripDetectionConfig,
  referenceNow: Date,
): Promise<HistoryData> {
  return loadHistoryFromStoredTripsToday(
    dateKey,
    tripRows,
    detectionConfig,
    referenceNow,
  );
}

async function persistOpenStayTrip(
  stay: DetectedTrip,
  dateKey: string,
  referenceNow: Date,
): Promise<void> {
  const centroid =
    stay.points.length > 0
      ? {
          lat: stay.points[stay.points.length - 1]!.lat,
          lng: stay.points[stay.points.length - 1]!.lng,
        }
      : {lat: 0, lng: 0};

  await upsertTrip({
    eventKey: openStayEventKey(stay.startAt),
    kind: 'stay',
    dateKey,
    startAt: stay.startAt,
    endAt: referenceNow,
    durationMs: differenceInMilliseconds(referenceNow, stay.startAt),
    distanceKm: stay.distanceKm,
    centroidLat: centroid.lat,
    centroidLng: centroid.lng,
    segmentOrder: 9999,
    detectionVersion: TRIP_DETECTION_VERSION,
    closedAt: referenceNow,
  });
}

async function tryExtendOpenStay(
  dateKey: string,
  tripRows: TripRow[],
  newPoints: LocationPointRow[],
  detectionConfig: TripDetectionConfig,
  referenceNow: Date,
): Promise<boolean> {
  const lastStay = lastPlayableStay(tripRows);
  if (lastStay == null) {
    return false;
  }
  if (!canExtendOpenStayWithNewPoints(lastStay, newPoints, detectionConfig)) {
    return false;
  }

  const endAt = referenceNow;
  const durationMs = differenceInMilliseconds(endAt, lastStay.startAt);
  await updateTripEndTime(lastStay.id, endAt, durationMs);

  const [materializedDay, geometryFingerprint, dayPoints] = await Promise.all([
    getMaterializedDay(dateKey),
    getGeometryPersistFingerprint(),
    getLocationPointsForDay(dateKey),
  ]);

  await upsertMaterializedDay(dateKey, {
    status: 'open',
    detectionVersion: TRIP_DETECTION_VERSION,
    tripCount: tripRows.length,
    pointCount: materializedDay?.pointCount ?? dayPoints.length,
    geometryFingerprint,
    sealedAt: endAt,
  });

  notifyMaterializationUpdated();
  return true;
}

async function tryTailMergeToday(
  dateKey: string,
  tripRows: TripRow[],
  sealedMs: number,
  detectionConfig: TripDetectionConfig,
  referenceNow: Date,
  onPartial?: (data: HistoryData) => void,
): Promise<HistoryData | null> {
  const {start: dayStart} = getDayRange(dateKey);
  const tailStart = new Date(tailGpsStartMs(sealedMs, dayStart.getTime()));

  const [sealedData, liveHistory] = await Promise.all([
    loadTodayFromTrips(dateKey, tripRows, detectionConfig, referenceNow),
    buildTodayTailDisplayHistory(
      dateKey,
      tailStart,
      detectionConfig,
      referenceNow,
    ),
  ]);

  const mergedEntries = mergeSealedAndLiveTimeline(
    sealedData.entries,
    liveHistory.entries,
    sealedMs,
  );

  const merged = historyDataFromEntries(
    dateKey,
    dayStart,
    referenceNow,
    mergedEntries,
    liveHistory.dayPointCount,
  );

  const sealable = getSealableTodayEntries(
    mergedEntries,
    referenceNow,
    detectionConfig,
  );
  if (
    sealable.length > 0 &&
    (await sealNeedsPersist(tripRows, sealable))
  ) {
    await persistSealableToday(
      dateKey,
      detectionConfig,
      sealable,
      liveHistory.dayPointCount,
    );
  }

  const last = mergedEntries
    .filter((entry): entry is DetectedTrip => isPlayableTimelineEntry(entry))
    .at(-1);
  if (last?.kind === 'stay' && last.openThroughNow) {
    await persistOpenStayTrip(last, dateKey, referenceNow);
  }

  onPartial?.(merged);
  notifyMaterializationUpdated();
  return merged;
}

async function materializeTodayFull(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  referenceNow: Date,
  onPartial?: (data: HistoryData) => void,
): Promise<HistoryData> {
  const history = await buildTodayDisplayHistory(
    dateKey,
    detectionConfig,
    referenceNow,
  );
  onPartial?.(history);

  const sealable = getSealableTodayEntries(
    history.entries,
    referenceNow,
    detectionConfig,
  );
  if (sealable.length > 0) {
    await persistSealableToday(
      dateKey,
      detectionConfig,
      sealable,
      history.dayPointCount,
    );
  }

  const last = history.entries
    .filter((entry): entry is DetectedTrip => isPlayableTimelineEntry(entry))
    .at(-1);
  if (last?.kind === 'stay' && last.openThroughNow) {
    await persistOpenStayTrip(last, dateKey, referenceNow);
  }

  const geometryFingerprint = await getGeometryPersistFingerprint();
  const finalRows = await listTripsForDay(dateKey);
  const sealedMs = sealedThroughMs(finalRows);
  await upsertMaterializedDay(dateKey, {
    status: 'open',
    detectionVersion: TRIP_DETECTION_VERSION,
    tripCount: finalRows.length,
    pointCount: history.dayPointCount,
    geometryFingerprint,
    sealedAt: sealedMs != null ? new Date(sealedMs) : null,
  });

  notifyMaterializationUpdated();
  return history;
}

async function refreshTodayTripsIncremental(
  dateKey: string,
  tripRows: TripRow[],
  detectionConfig: TripDetectionConfig,
  referenceNow: Date,
  onPartial?: (data: HistoryData) => void,
): Promise<HistoryData> {
  const sealedMs = sealedThroughMs(tripRows);
  if (sealedMs == null) {
    return loadTodayFromTrips(
      dateKey,
      tripRows,
      detectionConfig,
      referenceNow,
    );
  }

  const newPoints = await getLocationPointsAfterInDay(
    dateKey,
    new Date(sealedMs),
  );

  if (newPoints.length > 0) {
    const extended = await tryExtendOpenStay(
      dateKey,
      tripRows,
      newPoints,
      detectionConfig,
      referenceNow,
    );
    if (extended) {
      const refreshed = await loadTodayFromTrips(
        dateKey,
        await listTripsForDay(dateKey),
        detectionConfig,
        referenceNow,
      );
      onPartial?.(refreshed);
      return refreshed;
    }
  } else {
    const lastStay = lastPlayableStay(tripRows);
    if (
      lastStay != null &&
      (await canClockExtendOpenStayAtLastGps(
        dateKey,
        lastStay,
        detectionConfig,
      ))
    ) {
      const extended = await tryExtendOpenStay(
        dateKey,
        tripRows,
        [],
        detectionConfig,
        referenceNow,
      );
      if (extended) {
        const refreshed = await loadTodayFromTrips(
          dateKey,
          await listTripsForDay(dateKey),
          detectionConfig,
          referenceNow,
        );
        onPartial?.(refreshed);
        return refreshed;
      }
    }
  }

  const tailMerged = await tryTailMergeToday(
    dateKey,
    tripRows,
    sealedMs,
    detectionConfig,
    referenceNow,
    onPartial,
  );
  if (tailMerged != null) {
    return tailMerged;
  }

  return loadTodayFromTrips(
    dateKey,
    tripRows,
    detectionConfig,
    referenceNow,
  );
}

/**
 * Today display sync: DB map instantly, tail merge for live card/map, optional repair.
 */
export async function syncTodayDisplay(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  options: SyncTodayTripsOptions = {},
): Promise<HistoryData> {
  const dateKey = getTodayDateKey();
  const tripRows = await listTripsForDay(dateKey);
  const hasStoredTrips = tripRows.length > 0;

  let result: HistoryData;
  if (hasStoredTrips) {
    const stored = await loadTodayFromTrips(
      dateKey,
      tripRows,
      detectionConfig,
      referenceNow,
    );
    options.onPartial?.(stored);

    result = await refreshTodayTripsIncremental(
      dateKey,
      tripRows,
      detectionConfig,
      referenceNow,
      options.onPartial,
    );
  } else {
    result = await materializeTodayFull(
      dateKey,
      detectionConfig,
      referenceNow,
      options.onPartial,
    );
  }

  if (!options.skipRepair && hasStoredTrips) {
    scheduleTodayRepair(detectionConfig);
  }

  return result;
}

/** Full-day detect → replace today's trips in DB without refreshing the map. */
export async function repairTodayInDb(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): Promise<number> {
  const {rebuildTodayTrips} = await import('@/lib/trip-materialization');
  return rebuildTodayTrips(detectionConfig, referenceNow);
}

let repairPromise: Promise<void> | null = null;
let lastRepairScheduledMs = 0;
const REPAIR_DEBOUNCE_MS = 30 * 60 * 1000;

/** Schedule silent full-day repair for the next app open. */
export function scheduleTodayRepair(
  detectionConfig: TripDetectionConfig,
): void {
  const nowMs = Date.now();
  if (nowMs - lastRepairScheduledMs < REPAIR_DEBOUNCE_MS) {
    return;
  }
  lastRepairScheduledMs = nowMs;

  if (repairPromise != null) {
    return;
  }

  repairPromise = (async () => {
    try {
      await repairTodayInDb(detectionConfig);
      const {refreshTodayOnForeground} = await import(
        '@/lib/today-refresh-scheduler'
      );
      refreshTodayOnForeground();
    } catch {
      // Best-effort repair.
    } finally {
      repairPromise = null;
    }
  })();
}

/**
 * Today sync: show trips immediately, then incrementally extend or tail-merge.
 * Tier 0 — read trips. Tier 1 — extend open stay. Tier 1.5 — tail detect. Tier 2 — full day.
 */
export async function syncTodayTrips(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  options: SyncTodayTripsOptions = {},
): Promise<HistoryData> {
  return syncTodayDisplay(detectionConfig, referenceNow, options);
}

/** @deprecated Use scheduleTodayRepair — kept for cache warm paths. */
export function scheduleSyncTodayTrips(
  detectionConfig: TripDetectionConfig,
): void {
  scheduleTodayRepair(detectionConfig);
}

/** @internal */
export function resetTodaySyncStateForTests(): void {
  repairPromise = null;
  lastRepairScheduledMs = 0;
}
