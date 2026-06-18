import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {
  completePlaceLookup,
  failPlaceLookup,
  findPlaceLookupNearAnchor,
  getPlaceLookupById,
  insertPendingPlaceLookup,
  mergePlaceLookupCandidates,
  updatePlaceLookupVenueRadius,
} from '@/db/repositories/place-lookup-cache';
import {notifyPlaceLookupUpdated} from '@/lib/place-lookup-events';
import {fetchNearbyPlaceLookup} from '@/lib/place-lookup-native';
import {
  nextPlaceLookupRadiusM,
  placeLookupAnchorKey,
  PLACE_LOOKUP_SESSION_BUDGET,
  PLACE_LOOKUP_VENUE_RADIUS_M,
} from '@/lib/place-lookup-venue';
import type {TripDetectionConfig} from '@/lib/trip-settings';
import {matchSavedPlaceForStay} from '@/lib/saved-places';
import type {DetectedTrip} from '@/lib/trip-detection';
import {stayTripCentroid} from '@/lib/trip-detection';
import {stayMeetsMinimumVisitDwell} from '@/lib/visit-dwell';

function stayLookupAnchor(stay: DetectedTrip): {lat: number; lng: number} {
  const centroid = stayTripCentroid(stay);
  return {lat: centroid.latitude, lng: centroid.longitude};
}

const inFlightKeys = new Set<string>();
let sessionFetchCount = 0;

export function resetPlaceLookupSessionBudget(): void {
  sessionFetchCount = 0;
}

export function stayQualifiesForPlaceLookup(
  stay: DetectedTrip,
  config: TripDetectionConfig,
  savedPlaces: SavedPlaceRow[] = [],
): boolean {
  return stayMeetsMinimumVisitDwell(stay, config, savedPlaces);
}

export function shouldSkipPlaceLookupForStay(
  stay: DetectedTrip,
  savedPlaces: SavedPlaceRow[],
): boolean {
  return matchSavedPlaceForStay(stay, savedPlaces) != null;
}

export async function resolveVisitPlaceLookupRow(
  stay: DetectedTrip,
): Promise<Awaited<ReturnType<typeof findPlaceLookupNearAnchor>>> {
  return findPlaceLookupNearAnchor(stayLookupAnchor(stay));
}

async function performPlaceLookup(anchor: {lat: number; lng: number}): Promise<void> {
  const key = placeLookupAnchorKey(anchor.lat, anchor.lng);
  if (inFlightKeys.has(key)) {
    return;
  }

  const existing = await findPlaceLookupNearAnchor(anchor);
  if (existing?.lookupStatus === 'complete' || existing?.lookupStatus === 'failed') {
    return;
  }

  if (sessionFetchCount >= PLACE_LOOKUP_SESSION_BUDGET) {
    return;
  }

  inFlightKeys.add(key);
  sessionFetchCount += 1;

  let rowId = existing?.id;
  try {
    if (!rowId) {
      const inserted = await insertPendingPlaceLookup(anchor);
      rowId = inserted.id;
      notifyPlaceLookupUpdated();
    }

    const result = await fetchNearbyPlaceLookup(
      anchor.lat,
      anchor.lng,
      existing?.venueRadiusMeters ?? PLACE_LOOKUP_VENUE_RADIUS_M,
    );
    await completePlaceLookup(rowId, {
      addressLine: result.addressLine,
      candidates: result.candidates,
    });
  } catch {
    if (rowId != null) {
      await failPlaceLookup(rowId);
    }
  } finally {
    inFlightKeys.delete(key);
    notifyPlaceLookupUpdated();
  }
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

export async function expandPlaceLookupArea(cacheId: number): Promise<boolean> {
  const row = await getPlaceLookupById(cacheId);
  if (!row) {
    return false;
  }

  const nextRadius = nextPlaceLookupRadiusM(row.venueRadiusMeters);
  if (nextRadius == null) {
    return false;
  }

  const key = placeLookupAnchorKey(row.anchorLat, row.anchorLng);
  if (inFlightKeys.has(key)) {
    return false;
  }

  inFlightKeys.add(key);
  try {
    await updatePlaceLookupVenueRadius(cacheId, nextRadius);
    notifyPlaceLookupUpdated();

    const result = await fetchNearbyPlaceLookup(
      row.anchorLat,
      row.anchorLng,
      nextRadius,
    );
    await mergePlaceLookupCandidates(cacheId, {
      addressLine: result.addressLine,
      candidates: result.candidates,
      venueRadiusMeters: nextRadius,
    });
    return true;
  } catch {
    await failPlaceLookup(cacheId);
    return false;
  } finally {
    inFlightKeys.delete(key);
    notifyPlaceLookupUpdated();
  }
}

/** @internal Test helper */
export function __resetPlaceLookupServiceForTests(): void {
  inFlightKeys.clear();
  sessionFetchCount = 0;
}
