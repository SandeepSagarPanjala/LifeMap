import type {ExportPeriod} from '@/lib/export-period';
import {exportPeriodLabel} from '@/lib/export-period';

export type DatabaseExportTables = {
  location_points: unknown[];
  trips: unknown[];
  trip_points: unknown[];
  materialized_days: unknown[];
  tracking_events: unknown[];
  saved_places: unknown[];
  place_lookup_cache: unknown[];
  place_pois: unknown[];
  moments: unknown[];
  settings: unknown[];
};

export type DatabaseExportTableName = keyof DatabaseExportTables;

export const DATABASE_EXPORT_TABLE_NAMES: DatabaseExportTableName[] = [
  'location_points',
  'trips',
  'trip_points',
  'materialized_days',
  'tracking_events',
  'saved_places',
  'place_lookup_cache',
  'place_pois',
  'moments',
  'settings',
];

/** Raw capture tables — GPS, places, moments, settings, and lookup cache. */
export const ORIGINAL_DATA_EXPORT_TABLE_NAMES = [
  'location_points',
  'saved_places',
  'place_lookup_cache',
  'place_pois',
  'moments',
  'settings',
] as const satisfies readonly DatabaseExportTableName[];

/** Materialized trip tables — always cleared together. */
export const MATERIALIZED_TRIP_EXPORT_TABLE_NAMES = [
  'trips',
  'trip_points',
  'materialized_days',
] as const satisfies readonly DatabaseExportTableName[];

export type MaterializedTripExportTableName =
  (typeof MATERIALIZED_TRIP_EXPORT_TABLE_NAMES)[number];

/** Materialized / derived tables — trips, seal metadata, diagnostics. */
export const ALGORITHM_DATA_EXPORT_TABLE_NAMES = [
  ...MATERIALIZED_TRIP_EXPORT_TABLE_NAMES,
  'tracking_events',
] as const satisfies readonly DatabaseExportTableName[];

export type AlgorithmDataExportTableName =
  (typeof ALGORITHM_DATA_EXPORT_TABLE_NAMES)[number];

export type OriginalDataExportTableName =
  (typeof ORIGINAL_DATA_EXPORT_TABLE_NAMES)[number];

export type OriginalDataExportTables = Pick<
  DatabaseExportTables,
  OriginalDataExportTableName
>;

export function emptyDatabaseExportTables(): DatabaseExportTables {
  return {
    location_points: [],
    trips: [],
    trip_points: [],
    materialized_days: [],
    tracking_events: [],
    saved_places: [],
    place_lookup_cache: [],
    place_pois: [],
    moments: [],
    settings: [],
  };
}

export function sumExportTableRowCounts(
  counts: Partial<Record<DatabaseExportTableName, number>>,
): number {
  return DATABASE_EXPORT_TABLE_NAMES.reduce(
    (sum, tableName) => sum + (counts[tableName] ?? 0),
    0,
  );
}

export function sumOriginalDataExportRowCounts(
  counts: Partial<Record<DatabaseExportTableName, number>>,
): number {
  return ORIGINAL_DATA_EXPORT_TABLE_NAMES.reduce(
    (sum, tableName) => sum + (counts[tableName] ?? 0),
    0,
  );
}

export function sumOriginalDataExportStorageBytes(
  storageBytes: Partial<Record<DatabaseExportTableName, number>>,
): number {
  return ORIGINAL_DATA_EXPORT_TABLE_NAMES.reduce(
    (sum, tableName) => sum + (storageBytes[tableName] ?? 0),
    0,
  );
}

export function sumAlgorithmDataExportRowCounts(
  counts: Partial<Record<DatabaseExportTableName, number>>,
): number {
  return ALGORITHM_DATA_EXPORT_TABLE_NAMES.reduce(
    (sum, tableName) => sum + (counts[tableName] ?? 0),
    0,
  );
}

export function sumAlgorithmDataExportStorageBytes(
  storageBytes: Partial<Record<DatabaseExportTableName, number>>,
): number {
  return ALGORITHM_DATA_EXPORT_TABLE_NAMES.reduce(
    (sum, tableName) => sum + (storageBytes[tableName] ?? 0),
    0,
  );
}

export function pickOriginalDataExportTables(
  tables: DatabaseExportTables,
): OriginalDataExportTables {
  return {
    location_points: tables.location_points,
    saved_places: tables.saved_places,
    moments: tables.moments,
    settings: tables.settings,
    place_lookup_cache: tables.place_lookup_cache,
    place_pois: tables.place_pois,
  };
}

export function emptyExportTableCounts(): Record<DatabaseExportTableName, number> {
  return Object.fromEntries(
    DATABASE_EXPORT_TABLE_NAMES.map(tableName => [tableName, 0]),
  ) as Record<DatabaseExportTableName, number>;
}

/** Fill in zero for tables added after stats were cached. */
export function normalizeExportTableCounts(
  counts: Partial<Record<DatabaseExportTableName, number>>,
): Record<DatabaseExportTableName, number> {
  const normalized = emptyExportTableCounts();
  for (const tableName of DATABASE_EXPORT_TABLE_NAMES) {
    const value = counts[tableName];
    if (typeof value === 'number' && Number.isFinite(value)) {
      normalized[tableName] = value;
    }
  }
  return normalized;
}

export type DatabaseExportPayload = {
  exportedAt: string;
  scope: ExportPeriod['scope'];
  dateKey?: string;
  period: {
    startAt: string;
    endAt: string;
  };
  rowCounts: Record<keyof DatabaseExportTables, number>;
  tables: DatabaseExportTables;
};

export function buildDatabaseExportJson(
  period: ExportPeriod,
  tables: DatabaseExportTables,
): string {
  const rowCounts = Object.fromEntries(
    Object.entries(tables).map(([key, rows]) => [key, rows.length]),
  ) as Record<keyof DatabaseExportTables, number>;

  const payload: DatabaseExportPayload = {
    exportedAt: new Date().toISOString(),
    scope: period.scope,
    dateKey: period.dateKey,
    period: {
      startAt: period.startAt.toISOString(),
      endAt: period.endAt.toISOString(),
    },
    rowCounts,
    tables,
  };

  return JSON.stringify(payload, null, 2);
}

export function databaseExportFileLabel(
  period: ExportPeriod,
  table?: DatabaseExportTableName,
): string {
  const periodPart = exportPeriodLabel(period);
  if (table) {
    return `lifemap-database-${table}-${periodPart}.json`;
  }
  return `lifemap-database-${periodPart}.json`;
}

export function buildSingleTableExportJson(
  table: DatabaseExportTableName,
  period: ExportPeriod,
  rows: unknown[],
): string {
  const tables = emptyDatabaseExportTables();
  tables[table] = rows;
  return buildDatabaseExportJson(period, tables);
}

export type OriginalDataExportPayload = {
  exportedAt: string;
  exportKind: 'original_data';
  scope: ExportPeriod['scope'];
  dateKey?: string;
  period: {
    startAt: string;
    endAt: string;
  };
  rowCounts: Record<OriginalDataExportTableName, number>;
  tables: OriginalDataExportTables;
};

export function buildOriginalDataExportJson(
  period: ExportPeriod,
  tables: OriginalDataExportTables,
): string {
  const rowCounts = Object.fromEntries(
    ORIGINAL_DATA_EXPORT_TABLE_NAMES.map(tableName => [
      tableName,
      tables[tableName].length,
    ]),
  ) as Record<OriginalDataExportTableName, number>;

  const payload: OriginalDataExportPayload = {
    exportedAt: new Date().toISOString(),
    exportKind: 'original_data',
    scope: period.scope,
    dateKey: period.dateKey,
    period: {
      startAt: period.startAt.toISOString(),
      endAt: period.endAt.toISOString(),
    },
    rowCounts,
    tables,
  };

  return JSON.stringify(payload, null, 2);
}

export function originalDataExportFileLabel(period: ExportPeriod): string {
  const periodPart = exportPeriodLabel(period);
  return `lifemap-original-data-${periodPart}.json`;
}
