import {eq} from 'drizzle-orm';

import {getDatabase} from '../client';
import {placeLookupCache} from '../schema';
import type {PlaceLookupRow, PlaceLookupStatus} from '@/lib/place-lookup-types';
import {PLACE_LOOKUP_VENUE_RADIUS_M} from '@/lib/app-constants';
import {findNearestPlaceLookupMatch} from '@/lib/place-lookup-venue';

function mapRow(row: typeof placeLookupCache.$inferSelect): PlaceLookupRow {
  return {
    id: row.id,
    anchorLat: row.anchorLat,
    anchorLng: row.anchorLng,
    venueRadiusMeters: row.venueRadiusMeters,
    addressLine: row.addressLine,
    lookupStatus: row.lookupStatus as PlaceLookupStatus,
    fetchedAt: row.fetchedAt,
  };
}

export async function listPlaceLookupCacheRows(): Promise<PlaceLookupRow[]> {
  const db = await getDatabase();
  const rows = await db.select().from(placeLookupCache);
  return rows.map(mapRow);
}

export async function findPlaceLookupNearAnchor(
  anchor: {lat: number; lng: number},
): Promise<PlaceLookupRow | null> {
  const rows = await listPlaceLookupCacheRows();
  return findNearestPlaceLookupMatch(anchor, rows);
}

export async function insertPendingPlaceLookup(
  anchor: {lat: number; lng: number},
): Promise<PlaceLookupRow> {
  const db = await getDatabase();
  const inserted = await db
    .insert(placeLookupCache)
    .values({
      anchorLat: anchor.lat,
      anchorLng: anchor.lng,
      venueRadiusMeters: PLACE_LOOKUP_VENUE_RADIUS_M,
      lookupStatus: 'pending',
    })
    .returning();
  return mapRow(inserted[0]!);
}

export async function completePlaceLookup(
  id: number,
  payload: {
    addressLine: string | null;
  },
): Promise<void> {
  const db = await getDatabase();
  await db
    .update(placeLookupCache)
    .set({
      addressLine: payload.addressLine,
      lookupStatus: 'complete',
      fetchedAt: new Date(),
    })
    .where(eq(placeLookupCache.id, id));
}

export async function failPlaceLookup(id: number): Promise<void> {
  const db = await getDatabase();
  await db
    .update(placeLookupCache)
    .set({
      lookupStatus: 'failed',
      fetchedAt: new Date(),
    })
    .where(eq(placeLookupCache.id, id));
}

export async function updatePlaceLookupVenueRadius(
  id: number,
  venueRadiusMeters: number,
): Promise<void> {
  const db = await getDatabase();
  await db
    .update(placeLookupCache)
    .set({
      venueRadiusMeters,
      lookupStatus: 'pending',
      fetchedAt: null,
    })
    .where(eq(placeLookupCache.id, id));
}

export async function getPlaceLookupById(
  id: number,
): Promise<PlaceLookupRow | null> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(placeLookupCache)
    .where(eq(placeLookupCache.id, id))
    .limit(1);
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Raw cache rows still carrying legacy candidates_json — migration only. */
export async function listLegacyPlaceLookupCacheRows(): Promise<
  Array<{
    id: number;
    anchorLat: number;
    anchorLng: number;
    candidatesJson: string | null;
  }>
> {
  const db = await getDatabase();
  const rows = await db.select().from(placeLookupCache);
  return rows.map(row => ({
    id: row.id,
    anchorLat: row.anchorLat,
    anchorLng: row.anchorLng,
    candidatesJson: row.candidatesJson,
  }));
}

export async function clearLegacyCandidatesJson(cacheId: number): Promise<void> {
  const db = await getDatabase();
  await db
    .update(placeLookupCache)
    .set({candidatesJson: null, selectedCandidateIndex: null})
    .where(eq(placeLookupCache.id, cacheId));
}
