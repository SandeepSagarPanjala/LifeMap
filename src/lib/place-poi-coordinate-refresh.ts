import {listPlaceLookupCacheRows} from '@/db/repositories/place-lookup-cache';
import {
  cacheNeedsPoiCoordinateRefresh,
  listPlacePoisForCaches,
  syncMapkitPlacePoisForCache,
} from '@/db/repositories/place-pois';
import {notifyPlaceLookupUpdated} from '@/lib/place-lookup-events';
import {
  fetchNearbyPlaceLookup,
  platformResolvesClosestPoi,
} from '@/lib/place-lookup-native';
import type {PlaceLookupCandidate, PlaceLookupRow} from '@/lib/place-lookup-types';

const REFRESH_DELAY_MS = 250;

export type PlacePoiCoordinateRefreshProgress = {
  completed: number;
  total: number;
  cacheId: number;
  addressLine: string | null;
};

export type PlacePoiCoordinateRefreshCacheResult = {
  cacheId: number;
  status: 'refreshed' | 'skipped' | 'failed';
  updated: number;
  inserted: number;
  error?: string;
};

export type PlacePoiCoordinateRefreshBatchResult = {
  processed: number;
  refreshed: number;
  skipped: number;
  failed: number;
  updatedPois: number;
  insertedPois: number;
  results: PlacePoiCoordinateRefreshCacheResult[];
};

function mapkitCandidatesFromLookup(
  candidates: readonly PlaceLookupCandidate[],
): Array<{name: string; lat: number; lng: number}> {
  return candidates
    .filter(candidate => candidate.kind === 'poi')
    .map(candidate => ({
      name: candidate.name,
      lat: candidate.lat,
      lng: candidate.lng,
    }));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function listCompleteCachesNeedingPoiCoordinateRefresh(
  cacheRows: readonly PlaceLookupRow[],
  poisByCacheId: ReadonlyMap<number, readonly import('@/lib/place-lookup-types').PlacePoiRow[]>,
): PlaceLookupRow[] {
  return cacheRows.filter(row => {
    if (row.lookupStatus !== 'complete') {
      return false;
    }
    const anchor = {lat: row.anchorLat, lng: row.anchorLng};
    const pois = poisByCacheId.get(row.id) ?? [];
    return cacheNeedsPoiCoordinateRefresh(anchor, pois);
  });
}

export async function countCachesNeedingPoiCoordinateRefresh(): Promise<number> {
  if (!platformResolvesClosestPoi()) {
    return 0;
  }
  const cacheRows = await listPlaceLookupCacheRows();
  const completeIds = cacheRows
    .filter(row => row.lookupStatus === 'complete')
    .map(row => row.id);
  const allPois = await listPlacePoisForCaches(completeIds);
  const poisByCacheId = new Map<number, typeof allPois>();
  for (const poi of allPois) {
    const list = poisByCacheId.get(poi.cacheId) ?? [];
    list.push(poi);
    poisByCacheId.set(poi.cacheId, list);
  }
  return listCompleteCachesNeedingPoiCoordinateRefresh(cacheRows, poisByCacheId)
    .length;
}

export async function refreshPlacePoiCoordinatesForCache(
  cacheId: number,
): Promise<PlacePoiCoordinateRefreshCacheResult> {
  const rows = await listPlaceLookupCacheRows();
  const row = rows.find(entry => entry.id === cacheId);
  if (row == null || row.lookupStatus !== 'complete') {
    return {cacheId, status: 'skipped', updated: 0, inserted: 0};
  }

  try {
    const result = await fetchNearbyPlaceLookup(
      row.anchorLat,
      row.anchorLng,
      row.venueRadiusMeters,
    );
    const incoming = mapkitCandidatesFromLookup(result.candidates);
    if (incoming.length === 0) {
      return {cacheId, status: 'skipped', updated: 0, inserted: 0};
    }
    const sync = await syncMapkitPlacePoisForCache(cacheId, incoming);
    return {
      cacheId,
      status: 'refreshed',
      updated: sync.updated,
      inserted: sync.inserted,
    };
  } catch (error) {
    return {
      cacheId,
      status: 'failed',
      updated: 0,
      inserted: 0,
      error: error instanceof Error ? error.message : 'Refresh failed',
    };
  }
}

export async function refreshAllPlacePoiCoordinates(options?: {
  onProgress?: (progress: PlacePoiCoordinateRefreshProgress) => void;
  delayMs?: number;
}): Promise<PlacePoiCoordinateRefreshBatchResult> {
  if (!platformResolvesClosestPoi()) {
    return {
      processed: 0,
      refreshed: 0,
      skipped: 0,
      failed: 0,
      updatedPois: 0,
      insertedPois: 0,
      results: [],
    };
  }

  const cacheRows = await listPlaceLookupCacheRows();
  const completeIds = cacheRows
    .filter(row => row.lookupStatus === 'complete')
    .map(row => row.id);
  const allPois = await listPlacePoisForCaches(completeIds);
  const poisByCacheId = new Map<number, typeof allPois>();
  for (const poi of allPois) {
    const list = poisByCacheId.get(poi.cacheId) ?? [];
    list.push(poi);
    poisByCacheId.set(poi.cacheId, list);
  }

  const targets = listCompleteCachesNeedingPoiCoordinateRefresh(
    cacheRows,
    poisByCacheId,
  );
  const delayMs = options?.delayMs ?? REFRESH_DELAY_MS;
  const results: PlacePoiCoordinateRefreshCacheResult[] = [];
  let refreshed = 0;
  let skipped = 0;
  let failed = 0;
  let updatedPois = 0;
  let insertedPois = 0;

  for (let index = 0; index < targets.length; index += 1) {
    const row = targets[index]!;
    options?.onProgress?.({
      completed: index,
      total: targets.length,
      cacheId: row.id,
      addressLine: row.addressLine,
    });

    const result = await refreshPlacePoiCoordinatesForCache(row.id);
    results.push(result);

    if (result.status === 'refreshed') {
      refreshed += 1;
      updatedPois += result.updated;
      insertedPois += result.inserted;
    } else if (result.status === 'failed') {
      failed += 1;
    } else {
      skipped += 1;
    }

    if (index < targets.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  options?.onProgress?.({
    completed: targets.length,
    total: targets.length,
    cacheId: targets[targets.length - 1]?.id ?? 0,
    addressLine: targets[targets.length - 1]?.addressLine ?? null,
  });

  if (refreshed > 0 || updatedPois > 0 || insertedPois > 0) {
    notifyPlaceLookupUpdated();
  }

  return {
    processed: results.length,
    refreshed,
    skipped,
    failed,
    updatedPois,
    insertedPois,
    results,
  };
}
