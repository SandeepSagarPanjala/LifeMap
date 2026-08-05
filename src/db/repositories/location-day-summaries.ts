import { and, asc, eq, gte, isNull, lt, ne, or } from 'drizzle-orm';

import { getTodayDateKey, shiftDateKey, toDateKey } from '@/lib/day-utils';
import {
  MIN_VALID_LOCATION_DATE_KEY,
  TRIP_DETECTION_VERSION,
} from '@/lib/app-constants';
import { getGeometryPersistFingerprint } from '@/lib/trip-geometry-settings';

import { getDatabase } from '../client';
import { locationDaySummaries, materializedDays } from '../schema';

export type LocationDaySummaryRow = {
  dateKey: string;
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
    gte(locationDaySummaries.dateKey, MIN_VALID_LOCATION_DATE_KEY),
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

/** @internal — tests */
export function __resetEnsuredLocationDaySummariesForTests(): void {
  ensuredDateKeys.clear();
}
