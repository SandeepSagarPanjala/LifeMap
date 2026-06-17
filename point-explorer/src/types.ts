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
  scope?: string;
  tables?: {
    location_points?: LocationPointRow[];
    saved_places?: SavedPlaceRow[];
  };
};

export type ParsedPoint = LocationPointRow & {
  at: Date;
  dateKey: string;
};
