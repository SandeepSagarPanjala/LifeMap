import {and, asc, gte, lte, sql} from 'drizzle-orm';

import {getDayRange, toDateKey} from '@/lib/day-utils';

import {getDatabase} from '../client';
import {locationPoints} from '../schema';

export type LocationPointRow = typeof locationPoints.$inferSelect;

export async function getLocationPointsForDay(dateKey: string): Promise<LocationPointRow[]> {
  const {start, end} = getDayRange(dateKey);
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

/**
 * @deprecated Prefer getDateKeysWithLocationDataInRange for calendar UI.
 * Scans every row — avoid on large multi-year databases.
 */
export async function getDateKeysWithLocationData(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db
    .select({timestamp: locationPoints.timestamp})
    .from(locationPoints);
  const keys = new Set<string>();
  for (const row of rows) {
    keys.add(toDateKey(row.timestamp));
  }
  return [...keys].sort((a, b) => b.localeCompare(a));
}

export async function getEarliestLocationDateKey(): Promise<string | null> {
  const db = await getDatabase();
  const [row] = await db
    .select({timestamp: sql<Date>`min(${locationPoints.timestamp})`})
    .from(locationPoints);
  if (row?.timestamp == null) {
    return null;
  }
  return toDateKey(row.timestamp);
}

export async function getLocationDayFingerprint(
  dateKey: string,
): Promise<string> {
  const {start, end} = getDayRange(dateKey);
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
