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

export function databaseExportFileLabel(period: ExportPeriod): string {
  return `lifemap-database-${exportPeriodLabel(period)}.json`;
}
