import {desc, gte, sql} from 'drizzle-orm';

import {getDatabase} from '../client';
import {locationPoints} from '../schema';

export type NewLocationPoint = {
  timestamp: Date;
  lat: number;
  lng: number;
  accuracy?: number | null;
  altitude?: number | null;
  speed?: number | null;
  source?: string;
};

export async function insertLocationPoint(point: NewLocationPoint): Promise<void> {
  const db = await getDatabase();

  await db.insert(locationPoints).values({
    timestamp: point.timestamp,
    lat: point.lat,
    lng: point.lng,
    accuracy: point.accuracy ?? null,
    altitude: point.altitude ?? null,
    speed: point.speed ?? null,
    source: point.source ?? 'gps',
  });
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
