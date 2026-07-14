import { and, asc, gt, gte, lte, sql } from 'drizzle-orm';

import { getDayRange, getTodayDateKey, shiftDateKey, toDateKey } from '@/lib/day-utils';

import { getDatabase } from '../client';
import { locationPoints } from '../schema';

/** Core GPS row used by trip detection. SDK extras are optional (null on older rows / synthetic points). */
export type LocationPointRow = {
  id: number;
  timestamp: Date;
  lat: number;
  lng: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  source: string;
  heading?: number | null;
  headingAccuracy?: number | null;
  speedAccuracy?: number | null;
  altitudeAccuracy?: number | null;
  activityType?: string | null;
  activityConfidence?: number | null;
  isMoving?: boolean | null;
  isMock?: boolean | null;
  uuid?: string | null;
  batteryLevel?: number | null;
  batteryIsCharging?: boolean | null;
};

export async function getLocationPointsForDay(
  dateKey: string,
): Promise<LocationPointRow[]> {
  const { start, end } = getDayRange(dateKey);
  return getLocationPointsInRange(start, end);
}

export async function getLocationPointsInRange(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<LocationPointRow[]> {
  const db = await getDatabase();

  return db
    .select()
    .from(locationPoints)
    .where(
      and(
        gte(locationPoints.timestamp, rangeStart),
        lte(locationPoints.timestamp, rangeEnd),
      ),
    )
    .orderBy(asc(locationPoints.timestamp));
}

/** GPS rows strictly after `after` within a calendar day. */
export async function getLocationPointsAfterInDay(
  dateKey: string,
  after: Date,
): Promise<LocationPointRow[]> {
  const { start, end } = getDayRange(dateKey);
  const db = await getDatabase();

  return db
    .select()
    .from(locationPoints)
    .where(
      and(
        gte(locationPoints.timestamp, start),
        lte(locationPoints.timestamp, end),
        gt(locationPoints.timestamp, after),
      ),
    )
    .orderBy(asc(locationPoints.timestamp));
}

/** Calendar days strictly before `beforeDateKey` that have at least one GPS row. */
export async function listDateKeysWithLocationDataBefore(
  beforeDateKey: string,
): Promise<string[]> {
  const earliest = await getEarliestLocationDateKey();
  if (earliest == null || earliest >= beforeDateKey) {
    return [];
  }

  const keys: string[] = [];
  let cursor = earliest;
  while (cursor < beforeDateKey) {
    const { start, end } = getDayRange(cursor);
    const fingerprint = await getLocationPointsFingerprintInRange(start, end);
    const pointCount = Number(fingerprint.split(':')[0] ?? 0);
    if (pointCount > 0) {
      keys.push(cursor);
    }
    cursor = shiftDateKey(cursor, 1);
  }
  return keys;
}

/** Every calendar day from earliest GPS through today that has at least one point. */
export async function listAllDateKeysWithLocationData(): Promise<string[]> {
  const earliest = await getEarliestLocationDateKey();
  if (earliest == null) {
    return [];
  }

  const todayKey = getTodayDateKey();
  if (earliest > todayKey) {
    return [];
  }

  const keys: string[] = [];
  let cursor = earliest;
  while (cursor <= todayKey) {
    const { start, end } = getDayRange(cursor);
    const fingerprint = await getLocationPointsFingerprintInRange(start, end);
    const pointCount = Number(fingerprint.split(':')[0] ?? 0);
    if (pointCount > 0) {
      keys.push(cursor);
    }
    cursor = shiftDateKey(cursor, 1);
  }
  return keys;
}

export async function getEarliestLocationDateKey(): Promise<string | null> {
  const db = await getDatabase();
  const [row] = await db
    .select({ timestamp: sql<Date>`min(${locationPoints.timestamp})` })
    .from(locationPoints);
  if (row?.timestamp == null) {
    return null;
  }
  return toDateKey(row.timestamp);
}

export async function getLocationDayFingerprint(
  dateKey: string,
): Promise<string> {
  const { start, end } = getDayRange(dateKey);
  return getLocationPointsFingerprintInRange(start, end);
}

export async function getLocationPointsFingerprintInRange(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<string> {
  const db = await getDatabase();
  const [row] = await db
    .select({
      count: sql<number>`cast(count(*) as integer)`,
      maxId: sql<number>`coalesce(max(${locationPoints.id}), 0)`,
    })
    .from(locationPoints)
    .where(
      and(
        gte(locationPoints.timestamp, rangeStart),
        lte(locationPoints.timestamp, rangeEnd),
      ),
    );
  return `${row?.count ?? 0}:${row?.maxId ?? 0}`;
}
