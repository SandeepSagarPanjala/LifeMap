export type SavedPlaceRow = {
  id: number;
  kind: 'home' | 'work' | 'favorite';
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  addressLine?: string | null;
  active?: boolean;
  createdAt?: Date | string;
};

export type RawLocationPoint = {
  id: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  source: string;
  timestamp: Date | string;
};

export type LocationPointRow = RawLocationPoint & {
  timestamp: Date;
};

export type ParsedPoint = LocationPointRow & {
  at: Date;
  dateKey: string;
};

export type SegmentationMomentType =
  | 'photo'
  | 'note'
  | 'video'
  | 'voice'
  | 'activity';

export type SegmentationMoment = {
  timestamp: Date | string;
  type?: SegmentationMomentType;
};

export type PlaceLookupCandidateKind = 'poi' | 'address';

export type PlaceLookupCandidate = {
  id: string;
  name: string;
  kind: PlaceLookupCandidateKind;
  distanceM: number;
  lat: number;
  lng: number;
};

export type PlaceLookupStatus = 'pending' | 'complete' | 'failed';

/** Geocode cache row — address anchor only. */
export type PlaceLookupRow = {
  id: number;
  anchorLat: number;
  anchorLng: number;
  venueRadiusMeters: number;
  addressLine: string | null;
  lookupStatus: PlaceLookupStatus;
  fetchedAt?: Date | string | null;
};

export type PlacePoiSource = 'mapkit' | 'user';

export type PlacePoiRow = {
  id: number;
  cacheId: number;
  name: string;
  lat: number;
  lng: number;
  source: PlacePoiSource;
  createdAt?: Date | string;
};

export type SegmentationPlaceOptions = {
  resolveClosestPoi?: boolean;
};

/** Detection tuning — same shape as mobile `TripDetectionConfig`. */
export type SegmentationConfig = {
  gapMinutes: number;
  dwellMinutes: number;
  dwellRadiusMeters: number;
};

export type SegmentationOptions = {
  savedPlaces?: readonly SavedPlaceRow[];
  placeLookupCache?: readonly PlaceLookupRow[];
  placePois?: readonly PlacePoiRow[];
  resolveClosestPoi?: boolean;
};
