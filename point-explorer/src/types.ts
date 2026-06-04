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

export type ParsedPoint = LocationPointRow & {
  at: Date;
  dateKey: string;
};
