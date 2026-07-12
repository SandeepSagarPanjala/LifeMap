export type PlacePoiSource = 'mapkit' | 'user';

export type PlacePoiRow = {
  id: number;
  cacheId: number;
  name: string;
  lat: number;
  lng: number;
  /** MapKit `pointOfInterestCategory` raw value, e.g. MKPOICategoryRestaurant. */
  category: string | null;
  source: PlacePoiSource;
  createdAt: Date;
};

export type PlaceLookupCandidateKind = 'poi' | 'address';

export type PlaceLookupCandidate = {
  id: string;
  name: string;
  kind: PlaceLookupCandidateKind;
  distanceM: number;
  lat: number;
  lng: number;
  /** MapKit `pointOfInterestCategory` raw value, when available. */
  category?: string | null;
};

export type PlaceLookupStatus = 'pending' | 'complete' | 'failed';

/** Geocode cache row — address anchor only; POIs live in place_pois. */
export type PlaceLookupRow = {
  id: number;
  anchorLat: number;
  anchorLng: number;
  venueRadiusMeters: number;
  addressLine: string | null;
  lookupStatus: PlaceLookupStatus;
  fetchedAt: Date | null;
};

export type NativePlaceLookupResult = {
  addressLine: string | null;
  candidates: PlaceLookupCandidate[];
};

export type AddressGeocodeResult = {
  lat: number;
  lng: number;
  addressLine: string | null;
};

export type NativeAddressGeocodeResponse = {
  results: AddressGeocodeResult[];
};

export type ResolvedVisitPlace = {
  placeKind: 'saved' | 'cache' | null;
  placeId: number | null;
  /** Saved place name or street address. */
  placeLabel: string | null;
  poiId: number | null;
  poiLabel: string | null;
};

/** Primary label shown in history / map callouts. */
export function visitDisplayLabel(resolved: {
  placeKind?: 'saved' | 'cache' | null;
  placeLabel?: string | null;
  poiLabel?: string | null;
}): string | null {
  if (resolved.placeKind === 'saved') {
    return resolved.placeLabel?.trim() || null;
  }
  if (resolved.placeKind === 'cache') {
    return resolved.poiLabel?.trim() || resolved.placeLabel?.trim() || null;
  }
  return resolved.placeLabel?.trim() || null;
}

export type VisitPlaceDisplayCandidate = {
  id: number;
  name: string;
  source: PlacePoiSource;
  category: string | null;
};

export type VisitPlaceDisplay = {
  source: 'saved' | 'lookup' | 'none';
  /** Saved name or street address. */
  addressLabel: string | null;
  /** POI or user label for cache visits. */
  primaryLabel: string | null;
  candidates: VisitPlaceDisplayCandidate[];
  selectedPoiId: number | null;
  cacheId: number | null;
  materializedTripId: number | null;
  loading: boolean;
  venueRadiusMeters: number;
};

export function isVisitPlaceLabelConfirmed(
  display: VisitPlaceDisplay,
): boolean {
  if (display.source === 'saved') {
    return true;
  }
  return display.selectedPoiId != null;
}

export function visitPlaceSelectedCategory(
  display: VisitPlaceDisplay,
): string | null {
  if (display.selectedPoiId == null) {
    return null;
  }
  return (
    display.candidates.find(candidate => candidate.id === display.selectedPoiId)
      ?.category ?? null
  );
}

export function visitPlaceDefaultLabel(
  display: VisitPlaceDisplay,
): string | null {
  return display.primaryLabel?.trim() || display.addressLabel?.trim() || null;
}
