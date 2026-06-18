import {Platform} from 'react-native';
import {NativeModules} from 'react-native';

import type {
  NativePlaceLookupResult,
  PlaceLookupCandidate,
} from '@/lib/place-lookup-types';
import {PLACE_LOOKUP_VENUE_RADIUS_M} from '@/lib/place-lookup-venue';

type PlaceLookupNativeModule = {
  lookupNearbyPlace(
    lat: number,
    lng: number,
    radiusM: number,
  ): Promise<NativePlaceLookupResult>;
};

const nativeModule = NativeModules.PlaceLookupModule as
  | PlaceLookupNativeModule
  | undefined;

function dedupeCandidates(
  candidates: PlaceLookupCandidate[],
): PlaceLookupCandidate[] {
  const seen = new Set<string>();
  const sorted = [...candidates].sort(
    (a, b) => a.distanceM - b.distanceM || a.name.localeCompare(b.name),
  );
  const unique: PlaceLookupCandidate[] = [];

  for (const candidate of sorted) {
    const key = candidate.name.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(candidate);
  }

  return unique.slice(0, 8);
}

export async function fetchNearbyPlaceLookup(
  lat: number,
  lng: number,
  radiusM = PLACE_LOOKUP_VENUE_RADIUS_M,
): Promise<NativePlaceLookupResult> {
  if (!nativeModule?.lookupNearbyPlace) {
    return {addressLine: null, candidates: []};
  }

  const result = await nativeModule.lookupNearbyPlace(lat, lng, radiusM);
  const candidates = dedupeCandidates(result.candidates ?? []);

  if (Platform.OS === 'android') {
    const addressOnly = candidates.filter(c => c.kind === 'address');
    if (addressOnly.length === 0 && result.addressLine) {
      return {
        addressLine: result.addressLine,
        candidates: [
          {
            id: `address-${lat.toFixed(5)}-${lng.toFixed(5)}`,
            name: result.addressLine,
            kind: 'address',
            distanceM: 0,
          },
        ],
      };
    }
    return {
      addressLine: result.addressLine,
      candidates: addressOnly.length > 0 ? addressOnly : candidates,
    };
  }

  const poiCandidates = candidates.filter(c => c.kind === 'poi');
  const merged = [...poiCandidates];
  if (result.addressLine) {
    const hasAddress = merged.some(
      c => c.name.trim().toLowerCase() === result.addressLine!.trim().toLowerCase(),
    );
    if (!hasAddress) {
      merged.push({
        id: `address-${lat.toFixed(5)}-${lng.toFixed(5)}`,
        name: result.addressLine,
        kind: 'address',
        distanceM: 0,
      });
    }
  }

  return {
    addressLine: result.addressLine,
    candidates: dedupeCandidates(merged),
  };
}
