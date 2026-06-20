import {
  listSavedPlaces,
  updateSavedPlaceAddressLine,
} from '@/db/repositories/saved-places';
import {listPlaceLookupCacheRows} from '@/db/repositories/place-lookup-cache';
import {fetchNearbyPlaceLookup} from '@/lib/place-lookup-native';
import {findNearestPlaceLookupMatch} from '@/lib/place-lookup-venue';

function addressFromLookup(addressLine: string | null | undefined): string | null {
  const trimmed = addressLine?.trim();
  return trimmed ? trimmed : null;
}

async function resolveAddressForCoordinate(
  lat: number,
  lng: number,
  cacheRows: Awaited<ReturnType<typeof listPlaceLookupCacheRows>>,
): Promise<string | null> {
  const cached = findNearestPlaceLookupMatch({lat, lng}, cacheRows);
  const cachedAddress = addressFromLookup(cached?.addressLine);
  if (cachedAddress != null) {
    return cachedAddress;
  }

  const lookup = await fetchNearbyPlaceLookup(lat, lng);
  const fromLine = addressFromLookup(lookup.addressLine);
  if (fromLine != null) {
    return fromLine;
  }

  const addressCandidate = lookup.candidates.find(
    candidate => candidate.kind === 'address',
  );
  return addressFromLookup(addressCandidate?.name);
}

export async function lookupSavedPlaceAddress(
  lat: number,
  lng: number,
): Promise<string | null> {
  const cacheRows = await listPlaceLookupCacheRows();
  return resolveAddressForCoordinate(lat, lng, cacheRows);
}

export type BackfillSavedPlaceAddressesResult = {
  total: number;
  missing: number;
  updated: number;
  unresolved: number;
};

export async function backfillMissingSavedPlaceAddresses(): Promise<BackfillSavedPlaceAddressesResult> {
  const places = await listSavedPlaces();
  const missing = places.filter(place => place.addressLine == null);
  if (missing.length === 0) {
    return {
      total: places.length,
      missing: 0,
      updated: 0,
      unresolved: 0,
    };
  }

  const cacheRows = await listPlaceLookupCacheRows();
  let updated = 0;
  let unresolved = 0;

  for (const place of missing) {
    const address = await resolveAddressForCoordinate(
      place.lat,
      place.lng,
      cacheRows,
    );
    if (address == null) {
      unresolved += 1;
      continue;
    }
    await updateSavedPlaceAddressLine(place.id, address);
    updated += 1;
  }

  return {
    total: places.length,
    missing: missing.length,
    updated,
    unresolved,
  };
}
