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

import type {
  ParsedPoint,
  PlaceLookupRow,
  SavedPlaceRow,
} from '@lifemap/segmentation';

export type {ParsedPoint, PlaceLookupRow, SavedPlaceRow};

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

export type MomentType = 'photo' | 'note' | 'video' | 'voice' | 'activity';

export type MomentRow = {
  id: number;
  type?: MomentType;
  timestamp: string;
  lat: number | null;
  lng: number | null;
};
