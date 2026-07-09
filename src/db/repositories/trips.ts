import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';

import type { ResolvedPlaceFields } from '@/lib/resolved-place';
import {
  parseMomentRefs,
  serializeMomentRefs,
  type TripMomentRef,
} from '@/lib/moment-refs';

import { getDatabase } from '../client';
import { trips } from '../schema';

import { deleteTripPointsForTripIds } from './trip-points';

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
  placeLabel: string | null;
  placeId: number | null;
  placeKind: 'saved' | 'cache' | null;
  poiId: number | null;
  poiLabel: string | null;
  inferred: boolean;
  /** @deprecated Replaced by poi_id. */
  selectedCandidateIndex: number | null;
  detectionVersion: number;
  closedAt: Date;
  momentRefs: TripMomentRef[];
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
    placeLabel: row.placeLabel,
    placeId: row.placeId,
    placeKind: row.placeKind,
    poiId: row.poiId,
    poiLabel: row.poiLabel,
    inferred: row.inferred === 1,
    selectedCandidateIndex: row.selectedCandidateIndex,
    detectionVersion: row.detectionVersion,
    closedAt: row.closedAt,
    momentRefs: parseMomentRefs(row.momentRefs),
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

export type TripDaySummary = {
  dateKey: string;
  tripCount: number;
  stayCount: number;
  travelCount: number;
  missingCount: number;
};

export async function listTripDaySummaries(): Promise<TripDaySummary[]> {
  const db = await getDatabase();
  const rows = await db
    .select({
      dateKey: trips.dateKey,
      tripCount: sql<number>`cast(count(*) as integer)`,
      stayCount: sql<number>`cast(sum(case when ${trips.kind} = 'stay' then 1 else 0 end) as integer)`,
      travelCount: sql<number>`cast(sum(case when ${trips.kind} = 'travel' then 1 else 0 end) as integer)`,
      missingCount: sql<number>`cast(sum(case when ${trips.kind} = 'missing' then 1 else 0 end) as integer)`,
    })
    .from(trips)
    .groupBy(trips.dateKey)
    .orderBy(desc(trips.dateKey));
  return rows.map(row => ({
    dateKey: row.dateKey,
    tripCount: row.tripCount ?? 0,
    stayCount: row.stayCount ?? 0,
    travelCount: row.travelCount ?? 0,
    missingCount: row.missingCount ?? 0,
  }));
}

export async function listAllTrips(): Promise<TripRow[]> {
  const db = await getDatabase();
  const rows = await db.select().from(trips).orderBy(asc(trips.startAt));
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
  placeLabel?: string | null;
  placeId?: number | null;
  placeKind?: 'saved' | 'cache' | null;
  poiId?: number | null;
  poiLabel?: string | null;
  inferred?: boolean;
  selectedCandidateIndex?: number | null;
  detectionVersion: number;
  closedAt: Date;
  momentRefs?: readonly TripMomentRef[];
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
    placeLabel: input.placeLabel ?? null,
    placeId: input.placeId ?? null,
    placeKind: input.placeKind ?? null,
    poiId: input.poiId ?? null,
    poiLabel: input.poiLabel ?? null,
    inferred: input.inferred ? 1 : 0,
    selectedCandidateIndex: input.selectedCandidateIndex ?? null,
    detectionVersion: input.detectionVersion,
    closedAt: input.closedAt,
    momentRefs: serializeMomentRefs(input.momentRefs ?? []),
  };
}

export async function insertTripIfAbsent(
  input: InsertTripInput,
): Promise<TripRow | null> {
  const db = await getDatabase();
  const inserted = await db
    .insert(trips)
    .values(tripValues(input))
    .onConflictDoNothing({ target: trips.eventKey })
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
        placeLabel: input.placeLabel ?? null,
        placeId: input.placeId ?? null,
        placeKind: input.placeKind ?? null,
        poiId: input.poiId ?? null,
        poiLabel: input.poiLabel ?? null,
        inferred: input.inferred ? 1 : 0,
        selectedCandidateIndex: input.selectedCandidateIndex ?? null,
        detectionVersion: input.detectionVersion,
        closedAt: input.closedAt,
        momentRefs: serializeMomentRefs(input.momentRefs ?? []),
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

export async function updateTripEndTime(
  tripId: number,
  endAt: Date,
  durationMs: number,
): Promise<void> {
  const db = await getDatabase();
  await db.update(trips).set({ endAt, durationMs }).where(eq(trips.id, tripId));
}

export type TripPersistedLabel = ResolvedPlaceFields;

export async function applyTripPersistedLabel(
  tripId: number,
  labels: TripPersistedLabel,
): Promise<void> {
  const db = await getDatabase();
  await db
    .update(trips)
    .set({
      placeLabel: labels.placeLabel,
      placeId: labels.placeId,
      placeKind: labels.placeKind,
      poiId: labels.poiId,
      poiLabel: labels.poiLabel,
      selectedCandidateIndex: null,
    })
    .where(eq(trips.id, tripId));
}

export async function updateTripPoiSelection(
  tripId: number,
  poiId: number,
  poiLabel: string,
  cachePlaceId?: number | null,
): Promise<void> {
  const db = await getDatabase();
  await db
    .update(trips)
    .set({
      poiId,
      poiLabel: poiLabel.trim(),
      selectedCandidateIndex: null,
      ...(cachePlaceId != null
        ? {
            placeId: cachePlaceId,
            placeKind: 'cache' as const,
          }
        : {}),
    })
    .where(eq(trips.id, tripId));
}

/** @deprecated Use updateTripPoiSelection */
export async function updateTripLabelSelection(
  tripId: number,
  selectedCandidateIndex: number,
  cachePlaceId?: number | null,
): Promise<void> {
  const db = await getDatabase();
  await db
    .update(trips)
    .set({
      selectedCandidateIndex,
      poiId: null,
      poiLabel: null,
      ...(cachePlaceId != null
        ? {
            placeId: cachePlaceId,
            placeKind: 'cache' as const,
          }
        : {}),
    })
    .where(eq(trips.id, tripId));
}

/** @deprecated Custom labels are user POI rows — use createUserPlacePoi + updateTripPoiSelection */
export async function updateTripCustomLabel(
  tripId: number,
  label: string,
  cachePlaceId?: number | null,
): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) {
    return;
  }
  const db = await getDatabase();
  await db
    .update(trips)
    .set({
      placeLabel: trimmed,
      poiLabel: cachePlaceId != null ? trimmed : null,
      poiId: null,
      selectedCandidateIndex: null,
      ...(cachePlaceId != null
        ? {
            placeId: cachePlaceId,
            placeKind: 'cache' as const,
          }
        : {}),
    })
    .where(eq(trips.id, tripId));
}

export async function updateTripSavedPlaceAssociation(
  tripId: number,
  savedPlaceId: number | null,
  placeLabel?: string | null,
): Promise<void> {
  const db = await getDatabase();
  const label = placeLabel?.trim() || null;
  await db
    .update(trips)
    .set({
      placeId: savedPlaceId,
      placeKind: savedPlaceId != null ? ('saved' as const) : null,
      poiId: null,
      poiLabel: null,
      ...(label != null ? { placeLabel: label } : {}),
    })
    .where(eq(trips.id, tripId));
}

function unlabeledStayTripConditions() {
  return and(
    eq(trips.kind, 'stay'),
    isNull(trips.placeId),
    isNull(trips.poiId),
    or(isNull(trips.placeLabel), eq(trips.placeLabel, '')),
  );
}

export async function countUnlabeledStayTrips(): Promise<number> {
  const db = await getDatabase();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(trips)
    .where(unlabeledStayTripConditions());
  return Number(rows[0]?.count ?? 0);
}

export async function listUnlabeledStayTrips(
  limit: number,
): Promise<TripRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(trips)
    .where(unlabeledStayTripConditions())
    .orderBy(desc(trips.dateKey), desc(trips.startAt))
    .limit(limit);
  return rows.map(mapRow);
}

export async function countTripsForDay(dateKey: string): Promise<number> {
  const rows = await listTripsForDay(dateKey);
  return rows.length;
}

export async function deleteAllTrips(): Promise<number> {
  const db = await getDatabase();
  const ids = await db.select({ id: trips.id }).from(trips);
  await deleteTripPointsForTripIds(ids.map(row => row.id));
  const deleted = await db.delete(trips).returning({ id: trips.id });
  return deleted.length;
}

export async function deleteTripsForDay(dateKey: string): Promise<number> {
  const db = await getDatabase();
  const ids = await db
    .select({ id: trips.id })
    .from(trips)
    .where(eq(trips.dateKey, dateKey));
  await deleteTripPointsForTripIds(ids.map(row => row.id));
  const deleted = await db
    .delete(trips)
    .where(eq(trips.dateKey, dateKey))
    .returning({ id: trips.id });
  return deleted.length;
}

/** Remove today rows superseded by a new sealable prefix (GPS untouched). */
export async function deleteTripsForDayExceptEventKeys(
  dateKey: string,
  keepEventKeys: ReadonlySet<string>,
): Promise<number> {
  if (keepEventKeys.size === 0) {
    return deleteTripsForDay(dateKey);
  }

  const db = await getDatabase();
  const obsolete = await db
    .select({ id: trips.id })
    .from(trips)
    .where(
      and(
        eq(trips.dateKey, dateKey),
        notInArray(trips.eventKey, [...keepEventKeys]),
      ),
    );
  const obsoleteIds = obsolete.map(row => row.id);
  if (obsoleteIds.length === 0) {
    return 0;
  }

  await deleteTripPointsForTripIds(obsoleteIds);
  const deleted = await db
    .delete(trips)
    .where(inArray(trips.id, obsoleteIds))
    .returning({ id: trips.id });
  return deleted.length;
}
