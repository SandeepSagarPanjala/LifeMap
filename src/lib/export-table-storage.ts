import {
  DATABASE_EXPORT_TABLE_NAMES,
  sumExportTableRowCounts,
  type DatabaseExportTableName,
} from '@/lib/database-export';

export function estimateExportTableStorageBytes(
  counts: Record<DatabaseExportTableName, number>,
  totalDbBytes: number,
): Record<DatabaseExportTableName, number> {
  const totalRows = sumExportTableRowCounts(counts);
  if (totalRows === 0 || totalDbBytes <= 0) {
    return Object.fromEntries(
      DATABASE_EXPORT_TABLE_NAMES.map(tableName => [tableName, 0]),
    ) as Record<DatabaseExportTableName, number>;
  }

  return Object.fromEntries(
    DATABASE_EXPORT_TABLE_NAMES.map(tableName => [
      tableName,
      Math.round(totalDbBytes * (counts[tableName] / totalRows)),
    ]),
  ) as Record<DatabaseExportTableName, number>;
}
