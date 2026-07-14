import { desc, eq, gte, like, or, sql } from 'drizzle-orm';

import { getDatabase, getSqlite } from '../client';
import { locationPoints } from '../schema';
import { locationPointTimestampToStorageValue } from '@/lib/location-point-storage';
import { scheduleTodayRefreshAfterGps } from '@/lib/today-refresh-scheduler';
import { ensureLocationDaySummaryExists } from '@/db/repositories/location-day-summaries';

export type NewLocationPoint = {
  timestamp: Date;
  lat: number;
  lng: number;
  accuracy?: number | null;
  altitude?: number | null;
  speed?: number | null;
  source?: string;
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

function bindOptionalBool(value: boolean | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  return value ? 1 : 0;
}

export async function insertLocationPoint(
  point: NewLocationPoint,
  options?: { dedupe?: boolean },
): Promise<void> {
  const source = point.source ?? 'gps';
  const timestampValue = locationPointTimestampToStorageValue(point.timestamp);
  const sqlite = await getSqlite();
  const insertSql = options?.dedupe
    ? `INSERT OR IGNORE INTO location_points (
        timestamp, lat, lng, accuracy, altitude, speed, source,
        heading, heading_accuracy, speed_accuracy, altitude_accuracy,
        activity_type, activity_confidence, is_moving, is_mock, uuid,
        battery_level, battery_is_charging
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    : `INSERT INTO location_points (
        timestamp, lat, lng, accuracy, altitude, speed, source,
        heading, heading_accuracy, speed_accuracy, altitude_accuracy,
        activity_type, activity_confidence, is_moving, is_mock, uuid,
        battery_level, battery_is_charging
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const result = await sqlite.execute(insertSql, [
    timestampValue,
    point.lat,
    point.lng,
    point.accuracy ?? null,
    point.altitude ?? null,
    point.speed ?? null,
    source,
    point.heading ?? null,
    point.headingAccuracy ?? null,
    point.speedAccuracy ?? null,
    point.altitudeAccuracy ?? null,
    point.activityType ?? null,
    point.activityConfidence ?? null,
    bindOptionalBool(point.isMoving),
    bindOptionalBool(point.isMock),
    point.uuid ?? null,
    point.batteryLevel ?? null,
    bindOptionalBool(point.batteryIsCharging),
  ]);

  const rowsChanged = Number(
    (result as { rowsAffected?: number; changes?: number }).rowsAffected ??
      (result as { changes?: number }).changes ??
      0,
  );
  if (rowsChanged === 0) {
    return;
  }

  notifyInsert({
    timestamp: point.timestamp,
    lat: point.lat,
    lng: point.lng,
    source,
  });
  void ensureLocationDaySummaryExists(point.timestamp).catch(() => undefined);
}

export async function countMotionLocationPoints(): Promise<number> {
  const db = await getDatabase();
  const result = await db
    .select({ count: sql<number>`count(*)` })
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
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(locationPoints);
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
