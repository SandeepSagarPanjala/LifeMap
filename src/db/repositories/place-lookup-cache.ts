import {eq} from 'drizzle-orm';

import {getDatabase} from '../client';
import {placeLookupCache} from '../schema';
import type {
  PlaceLookupCandidate,
  PlaceLookupRow,
  PlaceLookupStatus,
} from '@/lib/place-lookup-types';
import {
  findNearestPlaceLookupMatch,
  PLACE_LOOKUP_VENUE_RADIUS_M,
} from '@/lib/place-lookup-venue';

function parseCandidates(raw: string | null): PlaceLookupCandidate[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as PlaceLookupCandidate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapRow(row: typeof placeLookupCache.$inferSelect): PlaceLookupRow {
  return {
    id: row.id,
    anchorLat: row.anchorLat,
    anchorLng: row.anchorLng,
    venueRadiusMeters: row.venueRadiusMeters,
    addressLine: row.addressLine,
    candidates: parseCandidates(row.candidatesJson),
    selectedCandidateIndex: row.selectedCandidateIndex,
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
    candidates: PlaceLookupCandidate[];
  },
): Promise<void> {
  const db = await getDatabase();
  await db
    .update(placeLookupCache)
    .set({
      addressLine: payload.addressLine,
      candidatesJson: JSON.stringify(payload.candidates),
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

export async function setPlaceLookupSelectedIndex(
  id: number,
  selectedCandidateIndex: number,
): Promise<void> {
  const db = await getDatabase();
  await db
    .update(placeLookupCache)
    .set({selectedCandidateIndex})
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

export async function mergePlaceLookupCandidates(
  id: number,
  payload: {
    addressLine: string | null;
    candidates: PlaceLookupCandidate[];
    venueRadiusMeters: number;
  },
): Promise<void> {
  const existing = await getPlaceLookupById(id);
  const mergedCandidates = [...(existing?.candidates ?? [])];
  const seen = new Set(
    mergedCandidates.map(candidate => candidate.name.trim().toLowerCase()),
  );
  for (const candidate of payload.candidates) {
    const key = candidate.name.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    mergedCandidates.push(candidate);
  }

  const db = await getDatabase();
  await db
    .update(placeLookupCache)
    .set({
      addressLine: payload.addressLine ?? existing?.addressLine ?? null,
      candidatesJson: JSON.stringify(mergedCandidates),
      venueRadiusMeters: payload.venueRadiusMeters,
      lookupStatus: 'complete',
      fetchedAt: new Date(),
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
