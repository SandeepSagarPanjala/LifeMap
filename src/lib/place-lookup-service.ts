import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import {
  completePlaceLookup,
  failPlaceLookup,
  findPlaceLookupNearAnchor,
  getPlaceLookupById,
  insertPendingPlaceLookup,
} from '@/db/repositories/place-lookup-cache';
import {
  listPlacePoisForCache,
  syncMapkitPlacePoisForCache,
} from '@/db/repositories/place-pois';
import { notifyPlaceLookupUpdated } from '@/lib/place-lookup-events';
import {
  fetchNearbyPlaceLookup,
  platformResolvesClosestPoi,
} from '@/lib/place-lookup-native';
import {
  PLACE_LOOKUP_MAX_MAPKIT_POIS,
  PLACE_LOOKUP_SESSION_BUDGET,
  PLACE_LOOKUP_VENUE_RADIUS_M,
} from '@/lib/app-constants';
import { placeLookupAnchorKey } from '@/lib/place-lookup-venue';
import type {
  PlaceLookupCandidate,
  PlaceLookupRow,
} from '@/lib/place-lookup-types';
import type { TripDetectionConfig } from '@/lib/trip-settings';
import { stayMeetsMinimumVisitDwell } from '@/lib/visit-dwell';
import { resolveStayAnchor } from '@/lib/trip-detection';
import type { DetectedTrip } from '@/lib/trip-detection';

function stayLookupAnchor(stay: DetectedTrip): { lat: number; lng: number } {
  return resolveStayAnchor(stay);
}

const inFlightKeys = new Set<string>();
let sessionFetchCount = 0;

export function resetPlaceLookupSessionBudget(): void {
  sessionFetchCount = 0;
}

export function stayQualifiesForPlaceLookup(
  stay: DetectedTrip,
  config: TripDetectionConfig,
  savedPlaces: readonly SavedPlaceRow[] = [],
): boolean {
  return stayMeetsMinimumVisitDwell(stay, config, savedPlaces);
}

export function shouldSkipPlaceLookupForStay(
  stay: DetectedTrip,
  _savedPlaces: readonly SavedPlaceRow[],
): boolean {
  return stay.placeKind === 'saved' && stay.placeId != null;
}

/**
 * Keep existing MapKit names (for coord refresh) plus closest unseen POIs
 * up to the overall max (20 at 100m).
 */
export function selectMapkitPoisForPersist(
  candidates: readonly PlaceLookupCandidate[],
  options: {
    maxNew?: number;
    existingNames?: ReadonlySet<string>;
  } = {},
): Array<{ name: string; lat: number; lng: number }> {
  const maxNew = options.maxNew ?? PLACE_LOOKUP_MAX_MAPKIT_POIS;
  const existingNames = options.existingNames ?? new Set<string>();

  const sorted = candidates
    .filter(candidate => candidate.kind === 'poi')
    .map(candidate => ({
      name: candidate.name.trim(),
      lat: candidate.lat,
      lng: candidate.lng,
      distanceM: candidate.distanceM,
    }))
    .filter(poi => poi.name.length > 0)
    .sort((a, b) => a.distanceM - b.distanceM);

  const seen = new Set<string>();
  const known: Array<{ name: string; lat: number; lng: number }> = [];
  const fresh: Array<{ name: string; lat: number; lng: number }> = [];

  for (const poi of sorted) {
    const key = poi.name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const entry = { name: poi.name, lat: poi.lat, lng: poi.lng };
    if (existingNames.has(key)) {
      known.push(entry);
    } else {
      fresh.push(entry);
    }
  }

  return [...known, ...fresh.slice(0, maxNew)];
}

async function persistLookupPois(
  cacheId: number,
  candidates: readonly PlaceLookupCandidate[],
): Promise<void> {
  const existing = await listPlacePoisForCache(cacheId);
  const existingNames = new Set(
    existing
      .filter(poi => poi.source === 'mapkit')
      .map(poi => poi.name.trim().toLowerCase())
      .filter(Boolean),
  );
  const maxNew = Math.max(0, PLACE_LOOKUP_MAX_MAPKIT_POIS - existingNames.size);
  const pois = selectMapkitPoisForPersist(candidates, {
    maxNew,
    existingNames,
  });
  if (pois.length === 0) {
    return;
  }
  await syncMapkitPlacePoisForCache(cacheId, pois);
}

async function performPlaceLookup(
  anchor: { lat: number; lng: number },
  options?: { bypassSessionBudget?: boolean },
): Promise<PlaceLookupRow | null> {
  const key = placeLookupAnchorKey(anchor.lat, anchor.lng);
  if (inFlightKeys.has(key)) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const row = await findPlaceLookupNearAnchor(anchor);
      if (row?.lookupStatus === 'complete') {
        return row;
      }
      if (!inFlightKeys.has(key)) {
        break;
      }
    }
    return findPlaceLookupNearAnchor(anchor);
  }

  const existing = await findPlaceLookupNearAnchor(anchor);
  if (existing?.lookupStatus === 'complete') {
    return existing;
  }
  if (existing?.lookupStatus === 'failed') {
    return existing;
  }

  if (
    !options?.bypassSessionBudget &&
    sessionFetchCount >= PLACE_LOOKUP_SESSION_BUDGET
  ) {
    return existing;
  }

  inFlightKeys.add(key);
  if (!options?.bypassSessionBudget) {
    sessionFetchCount += 1;
  }

  let rowId = existing?.id;
  try {
    if (!rowId) {
      const inserted = await insertPendingPlaceLookup(anchor);
      rowId = inserted.id;
      notifyPlaceLookupUpdated();
    }

    const venueRadius =
      existing?.venueRadiusMeters ?? PLACE_LOOKUP_VENUE_RADIUS_M;
    const result = await fetchNearbyPlaceLookup(
      anchor.lat,
      anchor.lng,
      venueRadius,
    );
    await completePlaceLookup(rowId, {
      addressLine: result.addressLine,
    });
    if (platformResolvesClosestPoi()) {
      await persistLookupPois(rowId, result.candidates);
    }
    return getPlaceLookupById(rowId);
  } catch {
    if (rowId != null) {
      await failPlaceLookup(rowId);
    }
    return rowId != null ? getPlaceLookupById(rowId) : null;
  } finally {
    inFlightKeys.delete(key);
    notifyPlaceLookupUpdated();
  }
}

/** Fetch or wait for a complete cache row at the stay anchor (catch-up / lazy label). */
export async function ensureCompletePlaceLookupAtAnchor(
  anchor: { lat: number; lng: number },
  options?: { bypassSessionBudget?: boolean },
): Promise<PlaceLookupRow | null> {
  const row = await performPlaceLookup(anchor, options);
  if (row?.lookupStatus === 'complete') {
    return row;
  }
  return null;
}

export async function enqueuePlaceLookupForStay(
  stay: DetectedTrip,
  savedPlaces: SavedPlaceRow[],
  config: TripDetectionConfig,
): Promise<void> {
  if (
    stay.points.length === 0 ||
    !stayQualifiesForPlaceLookup(stay, config, savedPlaces) ||
    shouldSkipPlaceLookupForStay(stay, savedPlaces)
  ) {
    return;
  }

  const anchor = stayLookupAnchor(stay);
  await performPlaceLookup(anchor);
}

export async function enqueuePlaceLookupsForStays(
  stays: DetectedTrip[],
  savedPlaces: SavedPlaceRow[],
  config: TripDetectionConfig,
): Promise<void> {
  for (const stay of stays) {
    if (sessionFetchCount >= PLACE_LOOKUP_SESSION_BUDGET) {
      break;
    }
    await enqueuePlaceLookupForStay(stay, savedPlaces, config);
  }
}

export async function loadPoisForCache(cacheId: number) {
  return listPlacePoisForCache(cacheId);
}

/** @internal Test helper */
export function __resetPlaceLookupServiceForTests(): void {
  inFlightKeys.clear();
  sessionFetchCount = 0;
}

export { platformResolvesClosestPoi };
