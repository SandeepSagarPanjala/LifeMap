import {Platform} from 'react-native';
import {NativeModules} from 'react-native';

import type {
  AddressGeocodeResult,
  NativeAddressGeocodeResponse,
  NativePlaceLookupResult,
  PlaceLookupCandidate,
} from '@/lib/place-lookup-types';
import {PLACE_LOOKUP_VENUE_RADIUS_M} from '@/lib/app-constants';

type PlaceLookupNativeModule = {
  lookupNearbyPlace(
    lat: number,
    lng: number,
    radiusM: number,
  ): Promise<NativePlaceLookupResult>;
  geocodeAddress(address: string): Promise<NativeAddressGeocodeResponse>;
};

const nativeModule = NativeModules.PlaceLookupModule as
  | PlaceLookupNativeModule
  | undefined;

function dedupeCandidates(
  candidates: PlaceLookupCandidate[],
  fallbackLat: number,
  fallbackLng: number,
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
    unique.push({
      ...candidate,
      lat: Number.isFinite(candidate.lat) ? candidate.lat : fallbackLat,
      lng: Number.isFinite(candidate.lng) ? candidate.lng : fallbackLng,
    });
  }

  return unique.slice(0, 8);
}

function normalizeGeocodeResults(
  results: AddressGeocodeResult[],
): AddressGeocodeResult[] {
  const seen = new Set<string>();
  const unique: AddressGeocodeResult[] = [];

  for (const result of results) {
    const key = `${result.lat.toFixed(5)},${result.lng.toFixed(5)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const addressLine = result.addressLine?.trim();
    unique.push({
      lat: result.lat,
      lng: result.lng,
      addressLine: addressLine ? addressLine : null,
    });
  }

  return unique.slice(0, 5);
}

export async function fetchAddressGeocode(
  address: string,
): Promise<AddressGeocodeResult[]> {
  const trimmed = address.trim();
  if (!trimmed || !nativeModule?.geocodeAddress) {
    return [];
  }

  const response = await nativeModule.geocodeAddress(trimmed);
  return normalizeGeocodeResults(response.results ?? []);
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
  const candidates = dedupeCandidates(result.candidates ?? [], lat, lng);

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
            lat,
            lng,
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
  return {
    addressLine: result.addressLine,
    candidates: dedupeCandidates(poiCandidates, lat, lng),
  };
}

/** iOS-only — POI resolution uses MapKit coordinates. */
export function platformResolvesClosestPoi(): boolean {
  return Platform.OS === 'ios';
}
