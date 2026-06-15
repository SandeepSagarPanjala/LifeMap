import {
  getExportTableStats,
  type ExportTableStats,
} from '@/db/repositories/database-export';
import {
  readSettingsStatsCache,
  SETTINGS_STATS_CACHE_KEYS,
  writeSettingsStatsCache,
  type CachedSettingsStats,
} from '@/db/repositories/settings-stats-cache';
import {
  getAppStorageBreakdown,
  type AppStorageBreakdown,
} from '@/db/repositories/storage-stats';

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
