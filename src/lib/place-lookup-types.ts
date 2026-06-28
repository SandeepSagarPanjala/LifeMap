export type PlaceLookupCandidateKind = 'poi' | 'address';

export type PlaceLookupCandidate = {
  id: string;
  name: string;
  kind: PlaceLookupCandidateKind;
  distanceM: number;
};

export type PlaceLookupStatus = 'pending' | 'complete' | 'failed';

export type PlaceLookupRow = {
  id: number;
  anchorLat: number;
  anchorLng: number;
  venueRadiusMeters: number;
  addressLine: string | null;
  candidates: PlaceLookupCandidate[];
  selectedCandidateIndex: number | null;
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

export type VisitPlaceDisplayCandidate = {
  name: string;
  kind: PlaceLookupCandidateKind;
};

export type VisitPlaceDisplay = {
  source: 'saved' | 'lookup' | 'none';
  primaryLabel: string | null;
  /** User-entered label that overrides lookup candidates. */
  customLabel: string | null;
  candidates: VisitPlaceDisplayCandidate[];
  selectedIndex: number;
  cacheId: number | null;
  materializedTripId: number | null;
  loading: boolean;
  venueRadiusMeters: number;
  /** User swiped to set the default label for this area. */
  isAreaDefault: boolean;
  /** User swiped to set the label for this specific visit. */
  isTripLabel: boolean;
};

export function isVisitPlaceLabelConfirmed(display: VisitPlaceDisplay): boolean {
  if (display.source === 'saved') {
    return true;
  }
  if (display.customLabel?.trim()) {
    return true;
  }
  return display.isTripLabel || display.isAreaDefault;
}

/** First lookup option shown in the visit card before the user confirms a label. */
export function visitPlaceDefaultLabel(display: VisitPlaceDisplay): string | null {
  const name = display.candidates[0]?.name ?? display.primaryLabel;
  return name?.trim() || null;
}
