import { asc, eq, inArray, sql } from 'drizzle-orm';

import type { LocationPointRow } from '@/db/repositories/location-days';
import { getDatabase, getSqlite } from '../client';
import { ensureTripPointMetadataColumns } from '../migrate';
import { tripPoints, trips } from '../schema';

import type { TripRow } from './trips';

export type TripPointRow = {
  id: number;
  tripId: number;
  seq: number;
  lat: number;
  lng: number;
  recordedAt: Date | null;
  locationPointId: number | null;
  source: string | null;
  momentId: number | null;
};

export type PersistTripPointInput = {
  lat: number;
  lng: number;
  recordedAt: Date;
  locationPointId: number | null;
  source: string;
  momentId: number | null;
};

let tripPointSchemaEnsured = false;

async function ensureTripPointSchema(): Promise<void> {
  if (tripPointSchemaEnsured) {
    return;
  }
  const sqlite = await getSqlite();
  await ensureTripPointMetadataColumns(sqlite);
  tripPointSchemaEnsured = true;
}

function mapRow(row: typeof tripPoints.$inferSelect): TripPointRow {
  return {
    id: row.id,
    tripId: row.tripId,
    seq: row.seq,
    lat: row.lat,
    lng: row.lng,
    recordedAt: row.recordedAt ?? null,
    locationPointId: row.locationPointId ?? null,
    source: row.source ?? null,
    momentId: row.momentId ?? null,
  };
}

export async function listTripPointsForTrip(
  tripId: number,
): Promise<TripPointRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(tripPoints)
    .where(eq(tripPoints.tripId, tripId))
    .orderBy(asc(tripPoints.seq));
  return rows.map(mapRow);
}

export async function listTripPointsByTripIds(
  tripIds: readonly number[],
): Promise<Map<number, TripPointRow[]>> {
  const map = new Map<number, TripPointRow[]>();
  if (tripIds.length === 0) {
    return map;
  }

  const db = await getDatabase();
  const rows = await db
    .select()
    .from(tripPoints)
    .where(inArray(tripPoints.tripId, [...tripIds]))
    .orderBy(asc(tripPoints.tripId), asc(tripPoints.seq));

  for (const row of rows) {
    const mapped = mapRow(row);
    const bucket = map.get(mapped.tripId);
    if (bucket) {
      bucket.push(mapped);
    } else {
      map.set(mapped.tripId, [mapped]);
    }
  }
  return map;
}

export async function listTripPointsForDay(
  dateKey: string,
): Promise<Map<number, TripPointRow[]>> {
  const db = await getDatabase();
  const rows = await db
    .select({
      id: tripPoints.id,
      tripId: tripPoints.tripId,
      seq: tripPoints.seq,
      lat: tripPoints.lat,
      lng: tripPoints.lng,
      recordedAt: tripPoints.recordedAt,
      locationPointId: tripPoints.locationPointId,
      source: tripPoints.source,
      momentId: tripPoints.momentId,
    })
    .from(tripPoints)
    .innerJoin(trips, eq(tripPoints.tripId, trips.id))
    .where(eq(trips.dateKey, dateKey))
    .orderBy(asc(tripPoints.tripId), asc(tripPoints.seq));

  const map = new Map<number, TripPointRow[]>();
  for (const row of rows) {
    const mapped = mapRow(row);
    const bucket = map.get(mapped.tripId);
    if (bucket) {
      bucket.push(mapped);
    } else {
      map.set(mapped.tripId, [mapped]);
    }
  }
  return map;
}

export async function replaceTripPoints(
  tripId: number,
  coordinates: readonly { lat: number; lng: number }[],
): Promise<void> {
  await replaceTripPointsFromLocations(
    tripId,
    coordinates.map((coordinate, seq) => ({
      id: -(tripId * 10_000 + seq),
      timestamp: new Date(),
      lat: coordinate.lat,
      lng: coordinate.lng,
      accuracy: null,
      altitude: null,
      speed: null,
      source: 'route',
    })),
  );
}

/** Persist full segment GPS — stays and drives — for history replay without location_points. */
export async function replaceTripPersistPoints(
  tripId: number,
  points: readonly PersistTripPointInput[],
): Promise<void> {
  await ensureTripPointSchema();
  const db = await getDatabase();
  await db.delete(tripPoints).where(eq(tripPoints.tripId, tripId));
  if (points.length === 0) {
    return;
  }

  await db.insert(tripPoints).values(
    points.map((point, seq) => ({
      tripId,
      seq,
      lat: point.lat,
      lng: point.lng,
      recordedAt: point.recordedAt,
      locationPointId: point.locationPointId,
      source: point.source,
      momentId: point.momentId,
    })),
  );
}

/** @deprecated Use replaceTripPersistPoints */
export async function replaceTripPointsFromLocations(
  tripId: number,
  points: readonly LocationPointRow[],
): Promise<void> {
  await replaceTripPersistPoints(
    tripId,
    points.map(point => ({
      lat: point.lat,
      lng: point.lng,
      recordedAt: point.timestamp,
      locationPointId: point.id > 0 ? point.id : null,
      source: point.source ?? 'gps',
      momentId: null,
    })),
  );
}

export async function deleteTripPointsForTripIds(
  tripIds: readonly number[],
): Promise<number> {
  if (tripIds.length === 0) {
    return 0;
  }
  const db = await getDatabase();
  const deleted = await db
    .delete(tripPoints)
    .where(inArray(tripPoints.tripId, [...tripIds]))
    .returning({ id: tripPoints.id });
  return deleted.length;
}

export async function deleteAllTripPoints(): Promise<number> {
  const db = await getDatabase();
  const deleted = await db.delete(tripPoints).returning({ id: tripPoints.id });
  return deleted.length;
}

export async function countTripPointsForDay(dateKey: string): Promise<number> {
  const db = await getDatabase();
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(tripPoints)
    .innerJoin(trips, eq(tripPoints.tripId, trips.id))
    .where(eq(trips.dateKey, dateKey));
  return row?.count ?? 0;
}

export function dayHasStoredTripGeometry(
  tripRows: readonly TripRow[],
  pointsByTripId: ReadonlyMap<number, TripPointRow[]>,
): boolean {
  if (tripRows.length === 0) {
    return false;
  }

  for (const row of tripRows) {
    if (row.kind === 'missing') {
      continue;
    }
    const route = pointsByTripId.get(row.id);
    if (route == null || route.length === 0) {
      return false;
    }
  }
  return true;
}
