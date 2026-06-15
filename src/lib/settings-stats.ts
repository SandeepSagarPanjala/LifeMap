import {
  getExportTableStats,
  type ExportTableStats,
} from '@/db/repositories/database-export';
import {countMaterializedDays} from '@/db/repositories/materialized-days';
import {countMotionLocationPoints} from '@/db/repositories/location-points';
import {
  readSettingsStatsCache,
  SETTINGS_STATS_CACHE_KEYS,
  writeSettingsStatsCache,
  type CachedSettingsStats,
} from '@/db/repositories/settings-stats-cache';
import {countAllTrips} from '@/db/repositories/trips';
import {
  getAppStorageBreakdown,
  type AppStorageBreakdown,
} from '@/db/repositories/storage-stats';

export type HistoryRepairStats = {
  tripCount: number;
  materializedDayCount: number;
  motionPointCount: number;
};

export async function loadCachedStorageBreakdown(): Promise<
  CachedSettingsStats<AppStorageBreakdown> | null
> {
  return readSettingsStatsCache<AppStorageBreakdown>(
    SETTINGS_STATS_CACHE_KEYS.storageBreakdown,
  );
}

export async function computeAndCacheStorageBreakdown(): Promise<
  CachedSettingsStats<AppStorageBreakdown>
> {
  const payload = await getAppStorageBreakdown();
  return writeSettingsStatsCache(
    SETTINGS_STATS_CACHE_KEYS.storageBreakdown,
    payload,
  ) as Promise<CachedSettingsStats<AppStorageBreakdown>>;
}

export async function loadCachedExportTableStats(): Promise<
  CachedSettingsStats<ExportTableStats> | null
> {
  return readSettingsStatsCache<ExportTableStats>(
    SETTINGS_STATS_CACHE_KEYS.exportTableStats,
  );
}

export async function computeAndCacheExportTableStats(): Promise<
  CachedSettingsStats<ExportTableStats>
> {
  const payload = await getExportTableStats();
  return writeSettingsStatsCache(
    SETTINGS_STATS_CACHE_KEYS.exportTableStats,
    payload,
  ) as Promise<CachedSettingsStats<ExportTableStats>>;
}

export async function loadCachedHistoryRepairStats(): Promise<
  CachedSettingsStats<HistoryRepairStats> | null
> {
  return readSettingsStatsCache<HistoryRepairStats>(
    SETTINGS_STATS_CACHE_KEYS.historyRepairStats,
  );
}

export async function computeAndCacheHistoryRepairStats(): Promise<
  CachedSettingsStats<HistoryRepairStats>
> {
  const [tripCount, materializedDayCount, motionPointCount] = await Promise.all([
    countAllTrips(),
    countMaterializedDays(),
    countMotionLocationPoints(),
  ]);
  const payload: HistoryRepairStats = {
    tripCount,
    materializedDayCount,
    motionPointCount,
  };
  return writeSettingsStatsCache(
    SETTINGS_STATS_CACHE_KEYS.historyRepairStats,
    payload,
  ) as Promise<CachedSettingsStats<HistoryRepairStats>>;
}
