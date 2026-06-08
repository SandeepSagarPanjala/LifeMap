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

export type VisitPlaceDisplayCandidate = {
  name: string;
  kind: PlaceLookupCandidateKind;
};

export type VisitPlaceDisplay = {
  source: 'saved' | 'lookup' | 'none';
  primaryLabel: string | null;
  candidates: VisitPlaceDisplayCandidate[];
  selectedIndex: number;
  cacheId: number | null;
  loading: boolean;
  /** User swiped to set the default label for this area. */
  isAreaDefault: boolean;
};
