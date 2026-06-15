import {asc, eq, inArray, sql} from 'drizzle-orm';

import {getDatabase} from '../client';
import {tripPoints, trips} from '../schema';

import type {TripRow} from './trips';

export type TripPointRow = {
  id: number;
  tripId: number;
  seq: number;
  lat: number;
  lng: number;
};

function mapRow(row: typeof tripPoints.$inferSelect): TripPointRow {
  return {
    id: row.id,
    tripId: row.tripId,
    seq: row.seq,
    lat: row.lat,
    lng: row.lng,
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
  coordinates: readonly {lat: number; lng: number}[],
): Promise<void> {
  const db = await getDatabase();
  await db.delete(tripPoints).where(eq(tripPoints.tripId, tripId));
  if (coordinates.length === 0) {
    return;
  }

  await db.insert(tripPoints).values(
    coordinates.map((coordinate, seq) => ({
      tripId,
      seq,
      lat: coordinate.lat,
      lng: coordinate.lng,
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
    .returning({id: tripPoints.id});
  return deleted.length;
}

export async function deleteAllTripPoints(): Promise<number> {
  const db = await getDatabase();
  const deleted = await db
    .delete(tripPoints)
    .returning({id: tripPoints.id});
  return deleted.length;
}

export async function countTripPointsForDay(dateKey: string): Promise<number> {
  const db = await getDatabase();
  const [row] = await db
    .select({count: sql<number>`cast(count(*) as integer)`})
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
    if (row.kind !== 'travel') {
      continue;
    }
    const route = pointsByTripId.get(row.id);
    if (route == null || route.length === 0) {
      return false;
    }
  }
  return true;
}
