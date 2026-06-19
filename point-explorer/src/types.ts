export type LocationPointRow = {
  id: number;
  timestamp: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  source: string;
};

export type StoredTripExportRow = {
  id: number;
  kind: 'stay' | 'travel' | 'missing';
  dateKey: string;
  startAt: string;
  endAt: string;
  durationMs: number;
  distanceKm: number;
  centroidLat: number;
  centroidLng: number;
  segmentOrder: number;
  savedPlaceLabel: string | null;
  savedPlaceId: number | null;
  inferred: boolean;
};

export type StoredTripPointExportRow = {
  id?: number;
  tripId: number;
  seq: number;
  lat: number;
  lng: number;
  recordedAt: string | null;
  locationPointId: number | null;
  source: string | null;
};

export type LocationExport = {
  exportedAt?: string;
  table?: string;
  scope?: string;
  rowCount?: number;
  rows: LocationPointRow[];
};

/** Full database export from LifeMap Settings → All tables. */
export type SavedPlaceRow = {
  id: number;
  kind: 'home' | 'work' | 'favorite';
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  createdAt?: string;
};

export type DatabaseExport = {
  exportedAt?: string;
  exportKind?: 'original_data' | string;
  scope?: string;
  rowCounts?: Partial<Record<string, number>>;
  tables?: {
    location_points?: LocationPointRow[];
    trips?: StoredTripExportRow[];
    trip_points?: StoredTripPointExportRow[];
    saved_places?: SavedPlaceRow[];
    moments?: unknown[];
    settings?: unknown[];
    place_lookup_cache?: unknown[];
  };
};

export type UploadDataKind = 'location_points' | 'stored_trips' | 'unknown';
export type UploadMode = 'detect' | 'plot';

export type MomentRow = {
  id: number;
  timestamp: string;
  lat: number | null;
  lng: number | null;
};

export type ParsedPoint = LocationPointRow & {
  at: Date;
  dateKey: string;
};
