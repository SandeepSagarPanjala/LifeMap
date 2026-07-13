import { and, asc, eq, gte, isNull, lte, lt, ne, or, sql } from 'drizzle-orm';

import {
  getDayRange,
  getTodayDateKey,
  shiftDateKey,
  toDateKey,
} from '@/lib/day-utils';
import { TRIP_DETECTION_VERSION } from '@/lib/app-constants';
import { getGeometryPersistFingerprint } from '@/lib/trip-geometry-settings';
import { listAllDateKeysWithLocationData } from '@/db/repositories/location-days';
import { yieldToEventLoop } from '@/lib/run-when-idle';

import { getDatabase } from '../client';
import { locationDaySummaries, locationPoints, materializedDays } from '../schema';

export type LocationDaySummaryRow = {
  dateKey: string;
  pointCount: number;
  minTimestamp: Date | null;
  maxTimestamp: Date | null;
  updatedAt: Date;
};

/** Process-local: after first ensure for a date_key, later GPS skips DB entirely. */
const ensuredDateKeys = new Set<string>();

/**
 * Ensure a summary row exists for the GPS point's calendar day.
 * Existence-only — no per-point updates. ~1 DB write per date_key per process.
 */
export async function ensureLocationDaySummaryExists(
  timestamp: Date,
): Promise<void> {
  const dateKey = toDateKey(timestamp);
  if (ensuredDateKeys.has(dateKey)) {
    return;
  }

  const db = await getDatabase();
  await db
    .insert(locationDaySummaries)
    .values({
      dateKey,
      pointCount: 1,
      minTimestamp: timestamp,
      maxTimestamp: timestamp,
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  ensuredDateKeys.add(dateKey);
}

export type PastDaySealBacklog = {
  hasWork: boolean;
  dateKeys: string[];
};

function pastDayNeedsSealConditions(
  yesterdayKey: string,
  geometryFingerprint: string,
) {
  return and(
    lt(locationDaySummaries.dateKey, yesterdayKey),
    or(
      isNull(materializedDays.dateKey),
      ne(materializedDays.status, 'complete'),
      ne(materializedDays.detectionVersion, TRIP_DETECTION_VERSION),
      ne(materializedDays.geometryFingerprint, geometryFingerprint),
    ),
  );
}

export async function findPastDaysNeedingSeal(
  limit: number,
): Promise<PastDaySealBacklog> {
  const yesterdayKey = shiftDateKey(getTodayDateKey(), -1);
  const geometryFingerprint = await getGeometryPersistFingerprint();
  const db = await getDatabase();

  const rows = await db
    .select({
      dateKey: locationDaySummaries.dateKey,
    })
    .from(locationDaySummaries)
    .leftJoin(
      materializedDays,
      eq(locationDaySummaries.dateKey, materializedDays.dateKey),
    )
    .where(pastDayNeedsSealConditions(yesterdayKey, geometryFingerprint))
    .orderBy(asc(locationDaySummaries.dateKey))
    .limit(limit);

  const dateKeys = rows.map(row => row.dateKey);
  return {
    hasWork: dateKeys.length > 0,
    dateKeys,
  };
}

export async function listPastDaysNeedingSeal(): Promise<string[]> {
  const yesterdayKey = shiftDateKey(getTodayDateKey(), -1);
  const geometryFingerprint = await getGeometryPersistFingerprint();
  const db = await getDatabase();

  const rows = await db
    .select({
      dateKey: locationDaySummaries.dateKey,
    })
    .from(locationDaySummaries)
    .leftJoin(
      materializedDays,
      eq(locationDaySummaries.dateKey, materializedDays.dateKey),
    )
    .where(pastDayNeedsSealConditions(yesterdayKey, geometryFingerprint))
    .orderBy(asc(locationDaySummaries.dateKey));

  return rows.map(row => row.dateKey);
}

/** Ensure summary rows exist for a calendar day that has GPS points. */
export async function refreshLocationDaySummary(dateKey: string): Promise<void> {
  const { start, end } = getDayRange(dateKey);
  const db = await getDatabase();
  const [row] = await db
    .select({
      count: sql<number>`cast(count(*) as integer)`,
      minTs: sql<Date | null>`min(${locationPoints.timestamp})`,
      maxTs: sql<Date | null>`max(${locationPoints.timestamp})`,
    })
    .from(locationPoints)
    .where(
      and(
        gte(locationPoints.timestamp, start),
        lte(locationPoints.timestamp, end),
      ),
    );

  const pointCount = Number(row?.count ?? 0);
  if (pointCount === 0) {
    await db
      .delete(locationDaySummaries)
      .where(eq(locationDaySummaries.dateKey, dateKey));
    ensuredDateKeys.delete(dateKey);
    return;
  }

  const now = new Date();
  await db
    .insert(locationDaySummaries)
    .values({
      dateKey,
      pointCount: 1,
      minTimestamp: row?.minTs ?? null,
      maxTimestamp: row?.maxTs ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: locationDaySummaries.dateKey,
      set: {
        pointCount: 1,
        minTimestamp: row?.minTs ?? null,
        maxTimestamp: row?.maxTs ?? null,
        updatedAt: now,
      },
    });
  ensuredDateKeys.add(dateKey);
}

export async function refreshLocationDaySummaryAfterSeal(
  dateKey: string,
  _pointCount: number,
): Promise<void> {
  const db = await getDatabase();
  const now = new Date();
  await db
    .insert(locationDaySummaries)
    .values({
      dateKey,
      pointCount: 1,
      minTimestamp: null,
      maxTimestamp: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: locationDaySummaries.dateKey,
      set: {
        pointCount: 1,
        updatedAt: now,
      },
    });
  ensuredDateKeys.add(dateKey);
}

export type DaySummaryBackfillProgress = {
  completed: number;
  total: number;
  dateKey: string;
};

export type DaySummaryBackfillResult = {
  daysWithGps: number;
  daysFilled: number;
  daysAlreadyIndexed: number;
};

/**
 * One-time migration for existing users: index calendar days that have GPS but
 * no row in location_day_summaries yet (pre–v0027 installs).
 */
export async function backfillMissingLocationDaySummaries(
  onProgress?: (progress: DaySummaryBackfillProgress) => void,
): Promise<DaySummaryBackfillResult> {
  const daysWithGps = await listAllDateKeysWithLocationData();
  if (daysWithGps.length === 0) {
    return { daysWithGps: 0, daysFilled: 0, daysAlreadyIndexed: 0 };
  }

  const db = await getDatabase();
  const existingRows = await db
    .select({ dateKey: locationDaySummaries.dateKey })
    .from(locationDaySummaries);
  const existing = new Set(existingRows.map(row => row.dateKey));
  const missing = daysWithGps.filter(dateKey => !existing.has(dateKey));

  for (let index = 0; index < missing.length; index += 1) {
    const dateKey = missing[index]!;
    await refreshLocationDaySummary(dateKey);
    onProgress?.({
      completed: index + 1,
      total: missing.length,
      dateKey,
    });
    await yieldToEventLoop();
  }

  return {
    daysWithGps: daysWithGps.length,
    daysFilled: missing.length,
    daysAlreadyIndexed: daysWithGps.length - missing.length,
  };
}

/** @internal — tests */
export function __resetEnsuredLocationDaySummariesForTests(): void {
  ensuredDateKeys.clear();
}
