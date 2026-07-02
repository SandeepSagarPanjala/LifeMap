import {
  getLocationPointsForDay,
  type LocationPointRow,
} from '@/db/repositories/location-days';
import {listTripsForDay, type TripRow} from '@/db/repositories/trips';
import {getDayRange, getTodayDateKey} from '@/lib/day-utils';
import type {HistoryData} from '@/lib/history-data-types';
import {buildExplorerDayTimelineFromGps} from '@/lib/explorer-day-trips';
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
import {arePointsSamePlace} from '@/lib/trip-detection';
import type {TripDetectionConfig} from '@/lib/trip-settings';

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

export type SyncTodayTripsOptions = {
  force?: boolean;
  /** Skip background today trip seal (tests / preload-only paths). */
  skipSilentSeal?: boolean;
  /** @deprecated Use skipSilentSeal */
  skipRepair?: boolean;
  onPartial?: (data: HistoryData) => void;
};

/** Stable event key for today's in-progress stay row. */
export function openStayEventKey(startAt: Date): string {
  return `stay:${startAt.getTime()}:open`;
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

async function mergeTodayDisplayFromDbAndTail(
  dateKey: string,
  tripRows: TripRow[],
  detectionConfig: TripDetectionConfig,
  referenceNow: Date,
  onPartial?: (data: HistoryData) => void,
): Promise<HistoryData> {
  const sealedMs = sealedThroughMs(tripRows);
  if (sealedMs == null) {
    const history = await buildTodayDisplayHistory(
      dateKey,
      detectionConfig,
      referenceNow,
    );
    onPartial?.(history);
    return history;
  }

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

  onPartial?.(merged);
  return merged;
}

/**
 * Today display sync: read sealed trips from DB, merge live tail in memory only.
 */
export async function syncTodayDisplay(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  options: SyncTodayTripsOptions = {},
): Promise<HistoryData> {
  const dateKey = getTodayDateKey();
  const tripRows = await listTripsForDay(dateKey);

  let result: HistoryData;
  if (tripRows.length > 0) {
    const stored = await loadTodayFromTrips(
      dateKey,
      tripRows,
      detectionConfig,
      referenceNow,
    );
    options.onPartial?.(stored);

    result = await mergeTodayDisplayFromDbAndTail(
      dateKey,
      tripRows,
      detectionConfig,
      referenceNow,
      options.onPartial,
    );
  } else {
    result = await buildTodayDisplayHistory(
      dateKey,
      detectionConfig,
      referenceNow,
    );
    options.onPartial?.(result);
  }

  const skipSilentSeal = options.skipSilentSeal ?? options.skipRepair ?? false;
  if (!skipSilentSeal) {
    scheduleSilentTripSeal(detectionConfig, referenceNow);
  }

  return result;
}

/**
 * Recompute today's sealable prefix from all GPS and persist to trips.
 * Withholds the live buffer (last 2 events). Skips when signatures are unchanged.
 */
export async function silentTripSealToday(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): Promise<number> {
  const dateKey = getTodayDateKey();
  const {entries, dayPointCount} = await buildExplorerDayTimelineFromGps(
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

  const {todaySealNeedsPersist, persistClosedTripsIncremental} = await import(
    '@/lib/trip-materialization'
  );
  const existingTrips = await listTripsForDay(dateKey);
  if (!todaySealNeedsPersist(existingTrips, sealable)) {
    return 0;
  }

  return persistClosedTripsIncremental(dateKey, detectionConfig, sealable, {
    pointCount: dayPointCount,
  });
}

let sealPromise: Promise<void> | null = null;
let sealPending = false;

/** Fire-and-forget background seal after today display sync. */
export function scheduleSilentTripSeal(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): void {
  if (sealPromise != null) {
    sealPending = true;
    return;
  }

  sealPromise = (async () => {
    try {
      do {
        sealPending = false;
        await silentTripSealToday(detectionConfig, referenceNow);
      } while (sealPending);
    } catch {
      // Best-effort seal.
    } finally {
      sealPromise = null;
    }
  })();
}

/** @deprecated Use silentTripSealToday */
export async function repairTodayInDb(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): Promise<number> {
  return silentTripSealToday(detectionConfig, referenceNow);
}

/** @deprecated Use scheduleSilentTripSeal */
export function scheduleTodayRepair(
  detectionConfig: TripDetectionConfig,
): void {
  scheduleSilentTripSeal(detectionConfig);
}

/**
 * Today sync: show trips immediately from DB + live tail; seal in background.
 */
export async function syncTodayTrips(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  options: SyncTodayTripsOptions = {},
): Promise<HistoryData> {
  return syncTodayDisplay(detectionConfig, referenceNow, options);
}

/** @deprecated Use scheduleSilentTripSeal */
export function scheduleSyncTodayTrips(
  detectionConfig: TripDetectionConfig,
): void {
  scheduleSilentTripSeal(detectionConfig);
}

/** @internal */
export function resetTodaySyncStateForTests(): void {
  sealPromise = null;
  sealPending = false;
}
