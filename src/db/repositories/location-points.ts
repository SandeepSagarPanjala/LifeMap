import {and, desc, eq, gte, like, or, sql} from 'drizzle-orm';

import {getDatabase, getSqlite} from '../client';
import {locationPoints} from '../schema';
import {locationPointTimestampToStorageValue} from '@/lib/location-point-storage';
import {scheduleTodayRefreshAfterGps} from '@/lib/today-refresh-scheduler';

export type NewLocationPoint = {
  timestamp: Date;
  lat: number;
  lng: number;
  accuracy?: number | null;
  altitude?: number | null;
  speed?: number | null;
  source?: string;
};

/** Legacy rows from motion callbacks — GPS rows are kept. */
export function isMotionLocationPointSource(source: string): boolean {
  return (
    source === 'motion' ||
    source === 'headless:motion' ||
    source.endsWith(':motion')
  );
}

function motionLocationSourceFilter() {
  return or(
    eq(locationPoints.source, 'motion'),
    eq(locationPoints.source, 'headless:motion'),
    like(locationPoints.source, '%:motion'),
  );
}

type LocationPointInsertListener = (point: {
  timestamp: Date;
  lat: number;
  lng: number;
  source: string;
}) => void;

const insertListeners = new Set<LocationPointInsertListener>();

function notifyInsert(point: {
  timestamp: Date;
  lat: number;
  lng: number;
  source: string;
}): void {
  scheduleTodayRefreshAfterGps();
  for (const listener of insertListeners) {
    listener(point);
  }
}

export function subscribeLocationPointInserts(
  listener: LocationPointInsertListener,
): () => void {
  insertListeners.add(listener);
  return () => {
    insertListeners.delete(listener);
  };
}

export async function insertLocationPoint(
  point: NewLocationPoint,
  options?: {dedupe?: boolean},
): Promise<void> {
  const db = await getDatabase();
  const source = point.source ?? 'gps';

  if (options?.dedupe) {
    const existing = await db
      .select({id: locationPoints.id})
      .from(locationPoints)
      .where(
        and(
          eq(locationPoints.timestamp, point.timestamp),
          eq(locationPoints.lat, point.lat),
          eq(locationPoints.lng, point.lng),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return;
    }
  }

  const sqlite = await getSqlite();
  await sqlite.execute(
    `INSERT INTO location_points (timestamp, lat, lng, accuracy, altitude, speed, source) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      locationPointTimestampToStorageValue(point.timestamp),
      point.lat,
      point.lng,
      point.accuracy ?? null,
      point.altitude ?? null,
      point.speed ?? null,
      source,
    ],
  );
  notifyInsert({timestamp: point.timestamp, lat: point.lat, lng: point.lng, source});
}

export async function countMotionLocationPoints(): Promise<number> {
  const db = await getDatabase();
  const result = await db
    .select({count: sql<number>`count(*)`})
    .from(locationPoints)
    .where(motionLocationSourceFilter());
  return Number(result[0]?.count ?? 0);
}

export async function deleteMotionLocationPoints(): Promise<number> {
  const deleted = await countMotionLocationPoints();
  if (deleted === 0) {
    return 0;
  }
  const db = await getDatabase();
  await db.delete(locationPoints).where(motionLocationSourceFilter());
  return deleted;
}

export async function countLocationPoints(): Promise<number> {
  const db = await getDatabase();
  const result = await db.select({count: sql<number>`count(*)`}).from(locationPoints);
  return Number(result[0]?.count ?? 0);
}

export async function getLatestLocationPoint() {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(locationPoints)
    .orderBy(desc(locationPoints.timestamp))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRecentLocationPoints(limit = 20) {
  const db = await getDatabase();
  return db
    .select()
    .from(locationPoints)
    .orderBy(desc(locationPoints.timestamp))
    .limit(limit);
}

export async function getLocationPointsSince(since: Date) {
  const db = await getDatabase();
  return db
    .select()
    .from(locationPoints)
    .where(gte(locationPoints.timestamp, since))
    .orderBy(desc(locationPoints.timestamp));
}
