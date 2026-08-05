import {
  getLocationPointsForDay,
  type LocationPointRow,
} from '@/db/repositories/location-days';
import { getMomentsForDay, type MomentRow } from '@/db/repositories/moments';
import { listTripsForDay, type TripRow } from '@/db/repositories/trips';
import { getDayRange, getTodayDateKey } from '@/lib/day-utils';
import type { HistoryData } from '@/lib/history-data-types';
import { getSealableTodayEntries } from '@/lib/today-seal-policy';
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
import { TODAY_LIVE_BUFFER_MAX_SEGMENTS } from '@/lib/app-constants';
import type { TripDetectionConfig } from '@/lib/trip-settings';
import { resetTodayPreloadMountSkip } from '@/lib/today-preload-coordination';
import { runPlaceCacheForDate } from '@/lib/place-cache-backlog';

/** Withholds last 2 live segments — need ≥3 tail segments before seal can persist anything. */
export const TODAY_OPEN_SILENT_SEAL_MIN_TAIL_SEGMENTS =
  TODAY_LIVE_BUFFER_MAX_SEGMENTS + 1;

export type TodayDisplayMeta = {
  storedTripCount: number;
  tailPlayableCount: number;
};

let lastTodayDisplayMeta: TodayDisplayMeta | null = null;
let lastTodayMergedEntries: DayTimelineEntry[] | null = null;

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

/** Skip seal when DB is empty and tail has too few segments to seal (X − 2 ≤ 0). */
export function shouldRunTodayOpenSilentSeal(
  storedTripCount: number,
  tailPlayableCount: number,
): boolean {
  if (storedTripCount > 0) {
    return true;
  }
  return tailPlayableCount >= TODAY_OPEN_SILENT_SEAL_MIN_TAIL_SEGMENTS;
}

function sealedMomentIds(tripRows: readonly TripRow[]): Set<number> {
  const ids = new Set<number>();
  for (const row of tripRows) {
    for (const ref of row.momentRefs ?? []) {
      ids.add(ref.momentId);
    }
  }
  return ids;
}

function unsealedMomentsForLive(
  dayMoments: readonly MomentRow[],
  tripRows: readonly TripRow[],
): MomentRow[] {
  const sealedIds = sealedMomentIds(tripRows);
  if (sealedIds.size === 0) {
    return [...dayMoments];
  }
  return dayMoments.filter(moment => !sealedIds.has(moment.id));
}

async function loadHistoryFromStoredTripsToday(
  dateKey: string,
  tripRows: TripRow[],
  detectionConfig: TripDetectionConfig,
  referenceNow: Date,
): Promise<HistoryData> {
  const { loadHistoryFromStoredTrips } = await import(
    '@/lib/trip-materialization'
  );
  // Sealed DB rows stay closed — open visit / "Still here" comes only from the live tail.
  return loadHistoryFromStoredTrips(
    dateKey,
    tripRows,
    referenceNow,
    detectionConfig,
    { markLastStayOpen: false },
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
  const anchor = { lat: lastStay.centroidLat, lng: lastStay.centroidLng };
  return newPoints.every(point =>
    arePointsSamePlace({ lat: point.lat, lng: point.lng }, anchor, config),
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
  const anchor = { lat: lastStay.centroidLat, lng: lastStay.centroidLng };
  return arePointsSamePlace(
    { lat: lastPoint.lat, lng: lastPoint.lng },
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
  const { start: dayStart, end: dayEnd } = getDayRange(dateKey);
  const dayStartMs = dayStart.getTime();
  const sealedMs = sealedThroughMs(tripRows) ?? dayStartMs;
  const tailStart = new Date(tailGpsStartMs(sealedMs, dayStartMs));

  const dayMoments = await getMomentsForDay(dayStart, dayEnd);
  const liveMoments = unsealedMomentsForLive(dayMoments, tripRows);

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
      tripRows,
      liveMoments,
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
    dayMoments,
  );

  lastTodayDisplayMeta = {
    storedTripCount: tripRows.length,
    tailPlayableCount: countPlayableTimelineSegments(liveHistory.entries),
  };
  lastTodayMergedEntries = mergedEntries;

  onPartial?.(merged);
  return merged;
}

/**
 * Persist sealable prefix from the last today display merge (hard X − 2).
 * No second full-day GPS detect.
 */
export async function sealTodayFromDisplayMerge(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  entries: readonly DayTimelineEntry[] | null = lastTodayMergedEntries,
): Promise<number> {
  if (entries == null || entries.length === 0) {
    return 0;
  }

  const dateKey = getTodayDateKey();
  const sealable = getSealableTodayEntries(
    entries,
    referenceNow,
    detectionConfig,
  );
  if (sealable.length === 0) {
    return 0;
  }

  const { todaySealNeedsPersist, persistClosedTripsIncremental } = await import(
    '@/lib/trip-materialization'
  );
  const existingTrips = await listTripsForDay(dateKey);
  if (!todaySealNeedsPersist(existingTrips, sealable)) {
    return 0;
  }

  return persistClosedTripsIncremental(
    dateKey,
    detectionConfig,
    sealable,
    {},
  );
}

/**
 * Today display: trips from DB + tail detect on GPS since last trip end.
 * After merge, once per open: seal delta from merge + place lookups for unlabeled stays.
 */
export async function syncTodayDisplay(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  options: SyncTodayTripsOptions = {},
): Promise<HistoryData> {
  const dateKey = getTodayDateKey();
  const tripRows = await listTripsForDay(dateKey);

  const merged = await mergeTodayDisplayFromDbAndTail(
    dateKey,
    tripRows,
    detectionConfig,
    referenceNow,
    options.onPartial,
  );

  scheduleTodaySealAndPlacesFromMerge(detectionConfig, referenceNow);
  return merged;
}

let sealPromise: Promise<void> | null = null;
let openCycleSilentSealDone = false;

export function beginTodayOpenCycle(): void {
  openCycleSilentSealDone = false;
  resetTodayPreloadMountSkip();
}

/**
 * One seal + places pass per app open — after display sync, not on every GPS refresh.
 * Seal reuses the display merge; places use sealed trips + open visit from that merge.
 */
export function scheduleTodaySealAndPlacesFromMerge(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  meta: TodayDisplayMeta | null = lastTodayDisplayMeta,
): void {
  if (openCycleSilentSealDone || sealPromise != null) {
    return;
  }

  openCycleSilentSealDone = true;

  sealPromise = (async () => {
    try {
      const shouldSeal =
        meta == null ||
        shouldRunTodayOpenSilentSeal(
          meta.storedTripCount,
          meta.tailPlayableCount,
        );
      if (shouldSeal) {
        await sealTodayFromDisplayMerge(detectionConfig, referenceNow);
      }

      const dateKey = getTodayDateKey();
      await runPlaceCacheForDate(dateKey, {
        openVisitEntries: lastTodayMergedEntries ?? undefined,
        detectionConfig,
      });
    } catch {
      // Best-effort seal / places.
    } finally {
      sealPromise = null;
    }
  })();
}

/** @deprecated Use scheduleTodaySealAndPlacesFromMerge */
export function scheduleTodayOpenSilentSeal(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  meta: TodayDisplayMeta | null = lastTodayDisplayMeta,
): void {
  scheduleTodaySealAndPlacesFromMerge(detectionConfig, referenceNow, meta);
}

/** @internal — legacy alias */
export function scheduleSilentTripSeal(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): void {
  scheduleTodaySealAndPlacesFromMerge(detectionConfig, referenceNow);
}

/** @deprecated Use sealTodayFromDisplayMerge */
export async function silentTripSealToday(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): Promise<number> {
  return sealTodayFromDisplayMerge(detectionConfig, referenceNow);
}

/** @deprecated Use sealTodayFromDisplayMerge */
export async function repairTodayInDb(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): Promise<number> {
  return sealTodayFromDisplayMerge(detectionConfig, referenceNow);
}

/** @deprecated Use scheduleTodaySealAndPlacesFromMerge */
export function scheduleTodayRepair(
  detectionConfig: TripDetectionConfig,
): void {
  scheduleTodaySealAndPlacesFromMerge(detectionConfig);
}

/**
 * Today sync: show trips immediately from DB + live tail; seal + places after merge.
 */
export async function syncTodayTrips(
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
  options: SyncTodayTripsOptions = {},
): Promise<HistoryData> {
  return syncTodayDisplay(detectionConfig, referenceNow, options);
}

/** @deprecated Use scheduleTodaySealAndPlacesFromMerge */
export function scheduleSyncTodayTrips(
  detectionConfig: TripDetectionConfig,
): void {
  scheduleTodaySealAndPlacesFromMerge(detectionConfig);
}

/** @internal */
export function resetTodaySyncStateForTests(): void {
  sealPromise = null;
  openCycleSilentSealDone = false;
  lastTodayDisplayMeta = null;
  lastTodayMergedEntries = null;
}
