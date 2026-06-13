import type {ExportPeriod} from '@/lib/export-period';
import {exportPeriodLabel} from '@/lib/export-period';

export type DatabaseExportTables = {
  location_points: unknown[];
  trips: unknown[];
  materialized_days: unknown[];
  materialization_queue: unknown[];
  tracking_events: unknown[];
  saved_places: unknown[];
  place_lookup_cache: unknown[];
  moments: unknown[];
  settings: unknown[];
};

export type DatabaseExportTableName = keyof DatabaseExportTables;

export const DATABASE_EXPORT_TABLE_NAMES: DatabaseExportTableName[] = [
  'location_points',
  'trips',
  'materialized_days',
  'materialization_queue',
  'tracking_events',
  'saved_places',
  'place_lookup_cache',
  'moments',
  'settings',
];

export function emptyDatabaseExportTables(): DatabaseExportTables {
  return {
    location_points: [],
    trips: [],
    materialized_days: [],
    materialization_queue: [],
    tracking_events: [],
    saved_places: [],
    place_lookup_cache: [],
    moments: [],
    settings: [],
  };
}

export function sumExportTableRowCounts(
  counts: Record<DatabaseExportTableName, number>,
): number {
  return DATABASE_EXPORT_TABLE_NAMES.reduce(
    (sum, tableName) => sum + counts[tableName],
    0,
  );
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
