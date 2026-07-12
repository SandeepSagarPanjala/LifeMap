import { eq, inArray } from 'drizzle-orm';

import { getDatabase } from '../client';
import { placePois } from '../schema';
import type { PlacePoiRow, PlacePoiSource } from '@/lib/place-lookup-types';
import { distanceMeters } from '@/lib/place-lookup-venue';

export type SyncMapkitPlacePoisResult = {
  updated: number;
  inserted: number;
};

const COORD_EPSILON = 1e-5;

export function poiCoordinatesMatchAnchor(
  poi: { lat: number; lng: number },
  anchor: { lat: number; lng: number },
): boolean {
  return (
    Math.abs(poi.lat - anchor.lat) < COORD_EPSILON &&
    Math.abs(poi.lng - anchor.lng) < COORD_EPSILON
  );
}

export function cacheNeedsPoiCoordinateRefresh(
  anchor: { lat: number; lng: number },
  pois: readonly PlacePoiRow[],
): boolean {
  const mapkitPois = pois.filter(poi => poi.source === 'mapkit');
  if (mapkitPois.length === 0) {
    return true;
  }
  if (mapkitPois.some(poi => poiCoordinatesMatchAnchor(poi, anchor))) {
    return true;
  }
  // One-shot category backfill: only if every MapKit POI still lacks category
  // (pre-category data). MapKit leaves many POIs uncategorized forever, so
  // do not treat partial nulls as needing another refresh.
  return mapkitPois.every(poi => poi.category == null || !poi.category.trim());
}

function mapRow(row: typeof placePois.$inferSelect): PlacePoiRow {
  return {
    id: row.id,
    cacheId: row.cacheId,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    category: row.category?.trim() ? row.category.trim() : null,
    source: row.source as PlacePoiSource,
    createdAt: row.createdAt,
  };
}

export async function listPlacePois(): Promise<PlacePoiRow[]> {
  const db = await getDatabase();
  const rows = await db.select().from(placePois);
  return rows.map(mapRow);
}

export function closestPlacePoiToAnchor(
  anchor: { lat: number; lng: number },
  pois: readonly PlacePoiRow[],
): PlacePoiRow | null {
  let best: PlacePoiRow | null = null;
  let bestDistanceM = Number.POSITIVE_INFINITY;

  for (const poi of pois) {
    if (!Number.isFinite(poi.lat) || !Number.isFinite(poi.lng)) {
      continue;
    }
    const distanceM = distanceMeters(anchor, { lat: poi.lat, lng: poi.lng });
    if (distanceM < bestDistanceM) {
      best = poi;
      bestDistanceM = distanceM;
    }
  }

  return best;
}

export async function listPlacePoisForCache(
  cacheId: number,
): Promise<PlacePoiRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(placePois)
    .where(eq(placePois.cacheId, cacheId));
  return rows.map(mapRow);
}

export async function listPlacePoisForCaches(
  cacheIds: readonly number[],
): Promise<PlacePoiRow[]> {
  if (cacheIds.length === 0) {
    return [];
  }
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(placePois)
    .where(inArray(placePois.cacheId, [...cacheIds]));
  return rows.map(mapRow);
}

export async function getPlacePoiById(id: number): Promise<PlacePoiRow | null> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(placePois)
    .where(eq(placePois.id, id))
    .limit(1);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function insertPlacePoi(input: {
  cacheId: number;
  name: string;
  lat: number;
  lng: number;
  category?: string | null;
  source: PlacePoiSource;
}): Promise<PlacePoiRow> {
  const db = await getDatabase();
  const category = input.category?.trim() ? input.category.trim() : null;
  const inserted = await db
    .insert(placePois)
    .values({
      cacheId: input.cacheId,
      name: input.name.trim(),
      lat: input.lat,
      lng: input.lng,
      category,
      source: input.source,
      createdAt: new Date(),
    })
    .returning();
  return mapRow(inserted[0]!);
}

/** Upsert MapKit POIs by name — update lat/lng/category, insert new names, never delete. */
export async function syncMapkitPlacePoisForCache(
  cacheId: number,
  incoming: ReadonlyArray<{
    name: string;
    lat: number;
    lng: number;
    category?: string | null;
  }>,
): Promise<SyncMapkitPlacePoisResult> {
  const existing = await listPlacePoisForCache(cacheId);
  const mapkitByName = new Map<string, PlacePoiRow>();
  for (const poi of existing) {
    if (poi.source !== 'mapkit') {
      continue;
    }
    const key = poi.name.trim().toLowerCase();
    if (key && !mapkitByName.has(key)) {
      mapkitByName.set(key, poi);
    }
  }

  let updated = 0;
  let inserted = 0;
  const seenIncoming = new Set<string>();
  const db = await getDatabase();

  for (const candidate of incoming) {
    const name = candidate.name.trim();
    const key = name.toLowerCase();
    if (!key || seenIncoming.has(key)) {
      continue;
    }
    seenIncoming.add(key);

    const category = candidate.category?.trim()
      ? candidate.category.trim()
      : null;
    const match = mapkitByName.get(key);
    if (match != null) {
      const latChanged = Math.abs(match.lat - candidate.lat) >= COORD_EPSILON;
      const lngChanged = Math.abs(match.lng - candidate.lng) >= COORD_EPSILON;
      const categoryChanged = category != null && category !== match.category;
      if (latChanged || lngChanged || categoryChanged) {
        await db
          .update(placePois)
          .set({
            lat: candidate.lat,
            lng: candidate.lng,
            ...(categoryChanged ? { category } : {}),
          })
          .where(eq(placePois.id, match.id));
        updated += 1;
      }
      continue;
    }

    const row = await insertPlacePoi({
      cacheId,
      name,
      lat: candidate.lat,
      lng: candidate.lng,
      category,
      source: 'mapkit',
    });
    mapkitByName.set(key, row);
    inserted += 1;
  }

  return { updated, inserted };
}

export async function replacePlacePoisForCache(
  cacheId: number,
  pois: ReadonlyArray<{
    name: string;
    lat: number;
    lng: number;
    category?: string | null;
    source: PlacePoiSource;
  }>,
): Promise<PlacePoiRow[]> {
  const db = await getDatabase();
  await db.delete(placePois).where(eq(placePois.cacheId, cacheId));
  if (pois.length === 0) {
    return [];
  }
  const now = new Date();
  const inserted = await db
    .insert(placePois)
    .values(
      pois.map(poi => ({
        cacheId,
        name: poi.name.trim(),
        lat: poi.lat,
        lng: poi.lng,
        category: poi.category?.trim() ? poi.category.trim() : null,
        source: poi.source,
        createdAt: now,
      })),
    )
    .returning();
  return inserted.map(mapRow);
}

export async function mergePlacePoisForCache(
  cacheId: number,
  incoming: ReadonlyArray<{
    name: string;
    lat: number;
    lng: number;
    category?: string | null;
    source: PlacePoiSource;
  }>,
): Promise<PlacePoiRow[]> {
  const existing = await listPlacePoisForCache(cacheId);
  const seen = new Set(existing.map(poi => poi.name.trim().toLowerCase()));
  const toInsert = incoming.filter(poi => {
    const key = poi.name.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  if (toInsert.length === 0) {
    return existing;
  }
  const db = await getDatabase();
  const now = new Date();
  const inserted = await db
    .insert(placePois)
    .values(
      toInsert.map(poi => ({
        cacheId,
        name: poi.name.trim(),
        lat: poi.lat,
        lng: poi.lng,
        category: poi.category?.trim() ? poi.category.trim() : null,
        source: poi.source,
        createdAt: now,
      })),
    )
    .returning();
  return [...existing, ...inserted.map(mapRow)];
}

export async function deleteMapkitPlacePoisForCache(
  cacheId: number,
): Promise<void> {
  const db = await getDatabase();
  await db.delete(placePois).where(eq(placePois.cacheId, cacheId));
}
