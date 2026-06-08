import {differenceInMilliseconds, endOfDay} from 'date-fns';

import {
  getLocationPointsForDay,
  getLocationPointsInRange,
} from '@/db/repositories/location-days';
import {
  enqueueMaterializationJob,
  type MaterializationJob,
} from '@/db/repositories/materialization-queue';
import {
  getMaterializedDay,
  markMaterializedDayFailed,
  upsertMaterializedDay,
} from '@/db/repositories/materialized-days';
import {findPlaceLookupNearAnchor} from '@/db/repositories/place-lookup-cache';
import {
  getTripByEventKey,
  getTripById,
  insertTripIfAbsent,
  listTripsForDay,
  setTripPlaceLookupCacheId,
  type TripRow,
} from '@/db/repositories/trips';
import {getDayRange, getTodayDateKey} from '@/lib/day-utils';
import type {HistoryData} from '@/lib/history-data-types';
import {runWhenIdle} from '@/lib/run-when-idle';
import {
  getHistoryLookaheadEnd,
  getHistoryLookbackStart,
  prepareDayHistoryTimeline,
} from '@/lib/today-history';
import {
  notifyMaterializationUpdated,
  setMaterializationBusy,
} from '@/lib/trip-materialization-events';
import {
  buildTimelineFromTrips,
  canReadDayFromMaterializedTrips,
} from '@/lib/timeline-from-trips';
import {
  type DayTimelineEntry,
  type DetectedTrip,
  isPlayableTimelineEntry,
  stayTripCentroid,
} from '@/lib/trip-detection';
import {
  buildTripDetectionConfig,
  DEFAULT_TRIP_DWELL_MINUTES,
  DEFAULT_TRIP_GAP_MINUTES,
  HISTORY_SAME_PLACE_RADIUS_METERS,
  type TripDetectionConfig,
} from '@/lib/trip-settings';

export const TRIP_DETECTION_VERSION = 1;

const WORKER_TIME_BUDGET_MS = 5_000;
const WORKER_BATCH_SIZE = 3;

let workerScheduled = false;
let workerRunning = false;

export function tripEventKey(
  trip: Pick<DetectedTrip, 'kind' | 'startAt' | 'endAt'>,
): string {
  return `${trip.kind}:${trip.startAt.getTime()}:${trip.endAt.getTime()}`;
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

async function loadLiveHistoryForDay(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  referenceNow: Date = new Date(),
): Promise<HistoryData> {
  const {start: dayStart} = getDayRange(dateKey);
  const isToday = dateKey === getTodayDateKey();
  const rangeEnd = isToday ? referenceNow : endOfDay(dayStart);
  const lookbackStart = getHistoryLookbackStart(dayStart);
  const dayEnd = endOfDay(dayStart);
  const lookaheadEnd = getHistoryLookaheadEnd(dayEnd);
  const [dayPoints, lookbackPoints, lookaheadPoints] = await Promise.all([
    getLocationPointsForDay(dateKey),
    getLocationPointsInRange(
      lookbackStart,
      new Date(dayStart.getTime() - 1),
    ),
    getLocationPointsInRange(
      new Date(dayEnd.getTime() + 1),
      lookaheadEnd,
    ),
  ]);
  const entries = prepareDayHistoryTimeline(
    dateKey,
    dayPoints,
    lookbackPoints,
    detectionConfig,
    referenceNow,
    lookaheadPoints,
  );

  return {
    dateKey,
    points: dayPoints,
    entries,
    range: {
      startAt: dayStart,
      endAt: rangeEnd,
    },
  };
}

export async function loadHistoryFromMaterializedTrips(
  dateKey: string,
): Promise<HistoryData> {
  const {start: dayStart} = getDayRange(dateKey);
  const rangeEnd = endOfDay(dayStart);
  const [tripRows, dayPoints] = await Promise.all([
    listTripsForDay(dateKey),
    getLocationPointsForDay(dateKey),
  ]);

  if (tripRows.length === 0) {
    return {
      dateKey,
      points: dayPoints,
      entries: [],
      range: {startAt: dayStart, endAt: rangeEnd},
    };
  }

  const entries = buildTimelineFromTrips(tripRows, dayPoints);

  return {
    dateKey,
    points: dayPoints,
    entries,
    range: {startAt: dayStart, endAt: rangeEnd},
  };
}

export async function loadHistoryWithMaterialization(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
): Promise<HistoryData> {
  const isToday = dateKey === getTodayDateKey();
  const materializedDay = await getMaterializedDay(dateKey);

  if (
    !isToday &&
    canReadDayFromMaterializedTrips(materializedDay, TRIP_DETECTION_VERSION)
  ) {
    return loadHistoryFromMaterializedTrips(dateKey);
  }

  const live = await loadLiveHistoryForDay(dateKey, detectionConfig);
  void enqueueTripMaterializationForDay(dateKey, live.entries);
  return live;
}

export function enqueueTripMaterializationForDay(
  dateKey: string,
  entries: DayTimelineEntry[],
): void {
  const closedEntries = entries.filter(isClosedPlayableEntry);
  if (closedEntries.length === 0) {
    return;
  }

  void enqueueMaterializationJob('persist_day', dateKey);

  const isToday = dateKey === getTodayDateKey();
  if (!isToday && !dayHasOpenVisit(entries)) {
    void enqueueMaterializationJob('seal_day', dateKey);
  }

  scheduleTripMaterializationWorker();
}

export function scheduleTripMaterializationWorker(): void {
  if (workerScheduled) {
    return;
  }
  workerScheduled = true;
  runWhenIdle(() => {
    workerScheduled = false;
    void drainMaterializationQueue();
  });
}

async function persistClosedTripsForDay(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
): Promise<number> {
  const live = await loadLiveHistoryForDay(dateKey, detectionConfig);
  const closedEntries = live.entries.filter(isClosedPlayableEntry);
  const closedAt = new Date();
  let inserted = 0;

  for (const entry of closedEntries) {
    const centroid = tripCentroid(entry);
    const placeLookup = await findPlaceLookupNearAnchor(centroid);
    const row = await insertTripIfAbsent({
      eventKey: tripEventKey(entry),
      kind: entry.kind,
      dateKey,
      startAt: entry.startAt,
      endAt: entry.endAt,
      durationMs: entry.durationMs,
      distanceKm: entry.distanceKm,
      centroidLat: centroid.lat,
      centroidLng: centroid.lng,
      placeLookupCacheId: placeLookup?.id ?? null,
      selectedCandidateIndex: placeLookup?.selectedCandidateIndex ?? null,
      detectionVersion: TRIP_DETECTION_VERSION,
      closedAt,
    });
    if (row != null) {
      inserted += 1;
    }
  }

  const tripCount = await listTripsForDay(dateKey).then(rows => rows.length);
  const pointCount = live.points.length;
  const materializedDay = await getMaterializedDay(dateKey);
  const isToday = dateKey === getTodayDateKey();
  const status =
    materializedDay?.status === 'complete'
      ? 'complete'
      : isToday
        ? 'open'
        : dayHasOpenVisit(live.entries)
          ? 'partial'
          : closedEntries.length > 0
            ? 'partial'
            : 'open';

  await upsertMaterializedDay(dateKey, {
    status,
    detectionVersion: TRIP_DETECTION_VERSION,
    tripCount,
    pointCount,
    sealedAt: materializedDay?.sealedAt ?? null,
  });

  notifyMaterializationUpdated();
  return inserted;
}

async function sealDay(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
): Promise<void> {
  if (dateKey === getTodayDateKey()) {
    return;
  }

  const live = await loadLiveHistoryForDay(dateKey, detectionConfig);
  if (dayHasOpenVisit(live.entries)) {
    return;
  }

  await persistClosedTripsForDay(dateKey, detectionConfig);
  const tripCount = (await listTripsForDay(dateKey)).length;
  const pointCount = (await getLocationPointsForDay(dateKey)).length;

  await upsertMaterializedDay(dateKey, {
    status: 'complete',
    detectionVersion: TRIP_DETECTION_VERSION,
    tripCount,
    pointCount,
    sealedAt: new Date(),
  });
  notifyMaterializationUpdated();
}

async function processMaterializationJob(
  job: MaterializationJob,
  detectionConfig: TripDetectionConfig,
): Promise<void> {
  try {
    if (job.jobType === 'persist_day') {
      await persistClosedTripsForDay(job.dateKey, detectionConfig);
    } else {
      await sealDay(job.dateKey, detectionConfig);
    }
  } catch {
    await markMaterializedDayFailed(job.dateKey, TRIP_DETECTION_VERSION);
    throw new Error(`materialization failed for ${job.dateKey}`);
  }
}

export async function drainMaterializationQueue(
  detectionConfig: TripDetectionConfig = getDefaultTripDetectionConfig(),
): Promise<void> {
  if (workerRunning) {
    return;
  }

  workerRunning = true;
  setMaterializationBusy(true);
  const deadline = Date.now() + WORKER_TIME_BUDGET_MS;

  try {
    while (Date.now() < deadline) {
      const {claimPendingJobs, markJobDone, markJobFailed, countPendingJobs} =
        await import('@/db/repositories/materialization-queue');
      const jobs = await claimPendingJobs(WORKER_BATCH_SIZE);
      if (jobs.length === 0) {
        break;
      }

      for (const job of jobs) {
        try {
          await processMaterializationJob(job, detectionConfig);
          await markJobDone(job.id);
        } catch {
          await markJobFailed(job.id);
        }
      }

      if ((await countPendingJobs()) === 0) {
        break;
      }
    }
  } finally {
    workerRunning = false;
    setMaterializationBusy(false);

    const {countPendingJobs} = await import(
      '@/db/repositories/materialization-queue'
    );
    if ((await countPendingJobs()) > 0) {
      scheduleTripMaterializationWorker();
    }
  }
}

export async function enqueueSealForPreviousDayIfNeeded(
  previousDateKey: string,
): Promise<void> {
  if (previousDateKey === getTodayDateKey()) {
    return;
  }

  const materializedDay = await getMaterializedDay(previousDateKey);
  if (materializedDay?.status === 'complete') {
    return;
  }

  await enqueueMaterializationJob('seal_day', previousDateKey);
  scheduleTripMaterializationWorker();
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

export type {TripRow};
