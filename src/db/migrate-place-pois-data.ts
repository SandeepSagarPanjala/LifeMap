import { parsePlaceLookupCandidates } from '@/lib/db/json-blobs';
import {
  clearLegacyCandidatesJson,
  listLegacyPlaceLookupCacheRows,
} from '@/db/repositories/place-lookup-cache';
import {
  listPlacePoisForCache,
  syncMapkitPlacePoisForCache,
} from '@/db/repositories/place-pois';
import { notifyPlaceLookupUpdated } from '@/lib/place-lookup-events';

export type LegacyPlacePoiMigrationResult = {
  migratedCaches: number;
  insertedPois: number;
};

/** Cache rows still carrying legacy candidates_json (not yet migrated to place_pois). */
export async function countLegacyPlaceLookupCandidatesPending(): Promise<number> {
  const legacyRows = await listLegacyPlaceLookupCacheRows();
  return legacyRows.filter(row => row.candidatesJson?.trim()).length;
}

/** One-time migration: candidates_json → place_pois rows (lat/lng from anchor when missing). */
export async function migrateLegacyPlaceLookupCandidatesToPois(): Promise<LegacyPlacePoiMigrationResult> {
  const legacyRows = await listLegacyPlaceLookupCacheRows();
  let migratedCaches = 0;
  let insertedPois = 0;
  let changed = false;

  for (const row of legacyRows) {
    if (!row.candidatesJson?.trim()) {
      continue;
    }
    changed = true;
    const existing = await listPlacePoisForCache(row.id);
    if (existing.length > 0) {
      await clearLegacyCandidatesJson(row.id);
      continue;
    }

    const candidates = parsePlaceLookupCandidates(row.candidatesJson).filter(
      candidate => candidate.kind === 'poi',
    );
    if (candidates.length === 0) {
      await clearLegacyCandidatesJson(row.id);
      continue;
    }

    const inserted = await syncMapkitPlacePoisForCache(
      row.id,
      candidates.map(candidate => ({
        name: candidate.name,
        lat:
          Number.isFinite(candidate.lat) && candidate.lat !== 0
            ? candidate.lat
            : row.anchorLat,
        lng:
          Number.isFinite(candidate.lng) && candidate.lng !== 0
            ? candidate.lng
            : row.anchorLng,
        category: candidate.category,
      })),
    );
    insertedPois += inserted.inserted + inserted.updated;
    migratedCaches += 1;
    await clearLegacyCandidatesJson(row.id);
  }

  if (changed) {
    notifyPlaceLookupUpdated();
  }

  return { migratedCaches, insertedPois };
}
