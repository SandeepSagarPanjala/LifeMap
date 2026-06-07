import type {LocationPointRow} from '@/db/repositories/location-days';

export type LocationExportScope = 'today' | 'all';

/** Mirrors `location_points` columns in SQLite. */
export type RawLocationPointRow = {
  id: number;
  timestamp: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  source: string;
};

export type RawLocationExportPayload = {
  exportedAt: string;
  table: 'location_points';
  scope: LocationExportScope;
  dateKey?: string;
  rowCount: number;
  rows: RawLocationPointRow[];
};

function toRawRow(point: LocationPointRow): RawLocationPointRow {
  return {
    id: point.id,
    timestamp: point.timestamp.toISOString(),
    lat: point.lat,
    lng: point.lng,
    accuracy: point.accuracy,
    altitude: point.altitude,
    speed: point.speed,
    source: point.source,
  };
}

export function buildRawLocationExportPayload(
  points: LocationPointRow[],
  options: {scope: LocationExportScope; dateKey?: string},
): RawLocationExportPayload {
  const sorted = [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  return {
    exportedAt: new Date().toISOString(),
    table: 'location_points',
    scope: options.scope,
    dateKey: options.dateKey,
    rowCount: sorted.length,
    rows: sorted.map(toRawRow),
  };
}

export function buildRawLocationExportJson(
  points: LocationPointRow[],
  options: {scope: LocationExportScope; dateKey?: string},
): string {
  return JSON.stringify(buildRawLocationExportPayload(points, options), null, 2);
}

export function buildRawLocationExportCsv(points: LocationPointRow[]): string {
  const sorted = [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const header = 'id,timestamp,lat,lng,accuracy,altitude,speed,source';
  const rows = sorted.map(point =>
    [
      point.id,
      point.timestamp.toISOString(),
      point.lat,
      point.lng,
      point.accuracy ?? '',
      point.altitude ?? '',
      point.speed ?? '',
      point.source,
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

export function exportFileLabel(
  format: 'json' | 'csv',
  scope: LocationExportScope,
  dateKey: string,
): string {
  const suffix = scope === 'today' ? dateKey : 'all';
  return `lifemap-location-points-${suffix}.${format}`;
}
