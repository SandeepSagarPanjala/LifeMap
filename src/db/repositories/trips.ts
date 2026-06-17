import {asc, eq, sql} from 'drizzle-orm';

import {getDatabase} from '../client';
import {trips} from '../schema';

import {deleteTripPointsForTripIds} from './trip-points';

export type TripRow = {
  id: number;
  eventKey: string;
  kind: 'stay' | 'travel' | 'missing';
  dateKey: string;
  startAt: Date;
  endAt: Date;
  durationMs: number;
  distanceKm: number;
  centroidLat: number;
  centroidLng: number;
  segmentOrder: number;
  savedPlaceLabel: string | null;
  savedPlaceId: number | null;
  inferred: boolean;
  placeLookupCacheId: number | null;
  selectedCandidateIndex: number | null;
  detectionVersion: number;
  closedAt: Date;
};

function mapRow(row: typeof trips.$inferSelect): TripRow {
  return {
    id: row.id,
    eventKey: row.eventKey,
    kind: row.kind,
    dateKey: row.dateKey,
    startAt: row.startAt,
    endAt: row.endAt,
    durationMs: row.durationMs,
    distanceKm: row.distanceKm,
    centroidLat: row.centroidLat,
    centroidLng: row.centroidLng,
    segmentOrder: row.segmentOrder,
    savedPlaceLabel: row.savedPlaceLabel,
    savedPlaceId: row.savedPlaceId,
    inferred: row.inferred === 1,
    placeLookupCacheId: row.placeLookupCacheId,
    selectedCandidateIndex: row.selectedCandidateIndex,
    detectionVersion: row.detectionVersion,
    closedAt: row.closedAt,
  };
}

export async function listTripsForDay(dateKey: string): Promise<TripRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(trips)
    .where(eq(trips.dateKey, dateKey))
    .orderBy(asc(trips.segmentOrder), asc(trips.startAt));
  return rows.map(mapRow);
}

export async function getTripById(id: number): Promise<TripRow | null> {
  const db = await getDatabase();
  const rows = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getTripByEventKey(
  eventKey: string,
): Promise<TripRow | null> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(trips)
    .where(eq(trips.eventKey, eventKey))
    .limit(1);
  return rows[0] ? mapRow(rows[0]) : null;
}

export type InsertTripInput = {
  eventKey: string;
  kind: 'stay' | 'travel' | 'missing';
  dateKey: string;
  startAt: Date;
  endAt: Date;
  durationMs: number;
  distanceKm: number;
  centroidLat: number;
  centroidLng: number;
  segmentOrder?: number;
  savedPlaceLabel?: string | null;
  savedPlaceId?: number | null;
  inferred?: boolean;
  placeLookupCacheId?: number | null;
  selectedCandidateIndex?: number | null;
  detectionVersion: number;
  closedAt: Date;
};

function tripValues(input: InsertTripInput) {
  return {
    eventKey: input.eventKey,
    kind: input.kind,
    dateKey: input.dateKey,
    startAt: input.startAt,
    endAt: input.endAt,
    durationMs: input.durationMs,
    distanceKm: input.distanceKm,
    centroidLat: input.centroidLat,
    centroidLng: input.centroidLng,
    segmentOrder: input.segmentOrder ?? 0,
    savedPlaceLabel: input.savedPlaceLabel ?? null,
    savedPlaceId: input.savedPlaceId ?? null,
    inferred: input.inferred ? 1 : 0,
    placeLookupCacheId: input.placeLookupCacheId ?? null,
    selectedCandidateIndex: input.selectedCandidateIndex ?? null,
    detectionVersion: input.detectionVersion,
    closedAt: input.closedAt,
  };
}

export async function insertTripIfAbsent(
  input: InsertTripInput,
): Promise<TripRow | null> {
  const db = await getDatabase();
  const inserted = await db
    .insert(trips)
    .values(tripValues(input))
    .onConflictDoNothing({target: trips.eventKey})
    .returning();

  if (inserted[0]) {
    return mapRow(inserted[0]);
  }

  return getTripByEventKey(input.eventKey);
}

export async function upsertTrip(input: InsertTripInput): Promise<TripRow> {
  const db = await getDatabase();
  const rows = await db
    .insert(trips)
    .values(tripValues(input))
    .onConflictDoUpdate({
      target: trips.eventKey,
      set: {
        kind: input.kind,
        dateKey: input.dateKey,
        startAt: input.startAt,
        endAt: input.endAt,
        durationMs: input.durationMs,
        distanceKm: input.distanceKm,
        centroidLat: input.centroidLat,
        centroidLng: input.centroidLng,
        segmentOrder: input.segmentOrder ?? 0,
        savedPlaceLabel: input.savedPlaceLabel ?? null,
        savedPlaceId: input.savedPlaceId ?? null,
        inferred: input.inferred ? 1 : 0,
        placeLookupCacheId: input.placeLookupCacheId ?? null,
        selectedCandidateIndex: input.selectedCandidateIndex ?? null,
        detectionVersion: input.detectionVersion,
        closedAt: input.closedAt,
      },
    })
    .returning();

  const row = rows[0];
  if (!row) {
    const existing = await getTripByEventKey(input.eventKey);
    if (existing == null) {
      throw new Error(`Failed to upsert trip ${input.eventKey}`);
    }
    return existing;
  }
  return mapRow(row);
}

export async function setTripSelectedCandidateIndex(
  tripId: number,
  selectedCandidateIndex: number,
): Promise<void> {
  const db = await getDatabase();
  await db
    .update(trips)
    .set({selectedCandidateIndex})
    .where(eq(trips.id, tripId));
}

export async function setTripPlaceLookupCacheId(
  tripId: number,
  placeLookupCacheId: number,
): Promise<void> {
  const db = await getDatabase();
  await db
    .update(trips)
    .set({placeLookupCacheId})
    .where(eq(trips.id, tripId));
}

export async function updateTripLabelSelection(
  tripId: number,
  selectedCandidateIndex: number,
  placeLookupCacheId?: number | null,
): Promise<void> {
  const db = await getDatabase();
  await db
    .update(trips)
    .set({
      selectedCandidateIndex,
      ...(placeLookupCacheId != null
        ? {placeLookupCacheId}
        : {}),
    })
    .where(eq(trips.id, tripId));
}

export async function countTripsForDay(dateKey: string): Promise<number> {
  const rows = await listTripsForDay(dateKey);
  return rows.length;
}

export async function countAllTrips(): Promise<number> {
  const db = await getDatabase();
  const [row] = await db
    .select({count: sql<number>`cast(count(*) as integer)`})
    .from(trips);
  return row?.count ?? 0;
}

export async function deleteAllTrips(): Promise<number> {
  const db = await getDatabase();
  const ids = await db.select({id: trips.id}).from(trips);
  await deleteTripPointsForTripIds(ids.map(row => row.id));
  const deleted = await db.delete(trips).returning({id: trips.id});
  return deleted.length;
}

export async function deleteTripsForDay(dateKey: string): Promise<number> {
  const db = await getDatabase();
  const ids = await db
    .select({id: trips.id})
    .from(trips)
    .where(eq(trips.dateKey, dateKey));
  await deleteTripPointsForTripIds(ids.map(row => row.id));
  const deleted = await db
    .delete(trips)
    .where(eq(trips.dateKey, dateKey))
    .returning({id: trips.id});
  return deleted.length;
}
