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
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';
import {TODAY_LIVE_BUFFER_MAX_SEGMENTS} from '@/lib/today-seal-policy';
import type {TripDetectionConfig} from '@/lib/trip-settings';

/** Withholds last 2 live segments — need ≥3 tail segments before seal can persist anything. */
export const TODAY_OPEN_SILENT_SEAL_MIN_TAIL_SEGMENTS =
  TODAY_LIVE_BUFFER_MAX_SEGMENTS + 1;

export type TodayDisplayMeta = {
  storedTripCount: number;
  tailPlayableCount: number;
};

let lastTodayDisplayMeta: TodayDisplayMeta | null = null;

export function getLastTodayDisplayMeta(): TodayDisplayMeta | null {
  return lastTodayDisplayMeta;
}

export function countPlayableTimelineSegments(
  entries: readonly DayTimelineEntry[],
): number {
  return entries.filter((entry): entry is DetectedTrip =>
    isPlayableTimelineEntry(entry),
  ).length;
}

/** Skip silent seal when DB is empty and tail has too few segments to seal (X − 2 ≤ 0). */
export function shouldRunTodayOpenSilentSeal(
  storedTripCount: number,
  tailPlayableCount: number,
): boolean {
  if (storedTripCount > 0) {
    return true;
  }
  return tailPlayableCount >= TODAY_OPEN_SILENT_SEAL_MIN_TAIL_SEGMENTS;
}

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

/** Sealed trips from DB + GPS tail since the last trip end (or day start when none). */
async function mergeTodayDisplayFromDbAndTail(
  dateKey: string,
  tripRows: TripRow[],
  detectionConfig: TripDetectionConfig,
  referenceNow: Date,
  onPartial?: (data: HistoryData) => void,
): Promise<HistoryData> {
  const {start: dayStart} = getDayRange(dateKey);
  const dayStartMs = dayStart.getTime();
  const sealedMs = sealedThroughMs(tripRows) ?? dayStartMs;
  const tailStart = new Date(tailGpsStartMs(sealedMs, dayStartMs));

  const [sealedData, liveHistory] = await Promise.all([
    tripRows.length > 0
      ? loadTodayFromTrips(dateKey, tripRows, detectionConfig, referenceNow)
      : Promise.resolve(
          historyDataFromEntries(dateKey, dayStart, referenceNow, [], 0),
        ),
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

  lastTodayDisplayMeta = {
    storedTripCount: tripRows.length,
    tailPlayableCount: countPlayableTimelineSegments(liveHistory.entries),
  };

  onPartial?.(merged);
  return merged;
}

/**
 * Today display: trips from DB + tail detect on GPS since last trip end.
 * Read-only — no DB writes. Does not run silent seal (see scheduleTodayOpenSilentSeal).
 */
export async function syncTodayDisplay(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  options: SyncTodayTripsOptions = {},
): Promise<HistoryData> {
  const dateKey = getTodayDateKey();
  const tripRows = await listTripsForDay(dateKey);

  if (tripRows.length > 0) {
    const stored = await loadTodayFromTrips(
      dateKey,
      tripRows,
      detectionConfig,
      referenceNow,
    );
    options.onPartial?.(stored);
  }

  return mergeTodayDisplayFromDbAndTail(
    dateKey,
    tripRows,
    detectionConfig,
    referenceNow,
    options.onPartial,
  );
}

/**
 * Full-day silent detect; persist sealable prefix (withholds last 2 live segments).
 * Skips when nothing is sealable or signatures are unchanged.
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
let openCycleSilentSealDone = false;

export function beginTodayOpenCycle(): void {
  openCycleSilentSealDone = false;
}

/** One silent seal per app open — after display sync, not on GPS refresh. */
export function scheduleTodayOpenSilentSeal(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  meta: TodayDisplayMeta | null = lastTodayDisplayMeta,
): void {
  if (openCycleSilentSealDone || sealPromise != null) {
    return;
  }

  if (
    meta != null &&
    !shouldRunTodayOpenSilentSeal(meta.storedTripCount, meta.tailPlayableCount)
  ) {
    openCycleSilentSealDone = true;
    return;
  }

  openCycleSilentSealDone = true;

  sealPromise = (async () => {
    try {
      await silentTripSealToday(detectionConfig, referenceNow);
    } catch {
      // Best-effort seal.
    } finally {
      sealPromise = null;
    }
  })();
}

/** @internal — legacy alias; prefer scheduleTodayOpenSilentSeal on app open only. */
export function scheduleSilentTripSeal(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): void {
  scheduleTodayOpenSilentSeal(detectionConfig, referenceNow);
}

/** @deprecated Use silentTripSealToday */
export async function repairTodayInDb(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): Promise<number> {
  return silentTripSealToday(detectionConfig, referenceNow);
}

/** @deprecated Use scheduleTodayOpenSilentSeal */
export function scheduleTodayRepair(
  detectionConfig: TripDetectionConfig,
): void {
  scheduleTodayOpenSilentSeal(detectionConfig);
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

/** @deprecated Use scheduleTodayOpenSilentSeal */
export function scheduleSyncTodayTrips(
  detectionConfig: TripDetectionConfig,
): void {
  scheduleTodayOpenSilentSeal(detectionConfig);
}

/** @internal */
export function resetTodaySyncStateForTests(): void {
  sealPromise = null;
  openCycleSilentSealDone = false;
  lastTodayDisplayMeta = null;
}
