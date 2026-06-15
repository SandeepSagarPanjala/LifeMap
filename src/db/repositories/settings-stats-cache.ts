import {eq} from 'drizzle-orm';

import {getDatabase} from '../client';
import {settingsStatsCache} from '../schema';

export const SETTINGS_STATS_CACHE_KEYS = {
  storageBreakdown: 'storage_breakdown',
  exportTableStats: 'export_table_stats',
} as const;

export type SettingsStatsCacheKey =
  (typeof SETTINGS_STATS_CACHE_KEYS)[keyof typeof SETTINGS_STATS_CACHE_KEYS];

export type CachedSettingsStats<T> = {
  payload: T;
  calculatedAt: Date;
};

export async function readSettingsStatsCache<T>(
  key: SettingsStatsCacheKey,
): Promise<CachedSettingsStats<T> | null> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(settingsStatsCache)
    .where(eq(settingsStatsCache.key, key))
    .limit(1);
  const row = rows[0];
  if (row == null) {
    return null;
  }

  try {
    return {
      payload: JSON.parse(row.payloadJson) as T,
      calculatedAt: row.calculatedAt,
    };
  } catch {
    return null;
  }
}

export async function writeSettingsStatsCache(
  key: SettingsStatsCacheKey,
  payload: unknown,
): Promise<CachedSettingsStats<unknown>> {
  const db = await getDatabase();
  const calculatedAt = new Date();
  const payloadJson = JSON.stringify(payload);
  const existing = await db
    .select()
    .from(settingsStatsCache)
    .where(eq(settingsStatsCache.key, key))
    .limit(1);

  if (existing[0]) {
    await db
      .update(settingsStatsCache)
      .set({payloadJson, calculatedAt})
      .where(eq(settingsStatsCache.key, key));
  } else {
    await db.insert(settingsStatsCache).values({
      key,
      payloadJson,
      calculatedAt,
    });
  }

  return {payload, calculatedAt};
}

export async function deleteSettingsStatsCache(
  key: SettingsStatsCacheKey,
): Promise<void> {
  const db = await getDatabase();
  await db.delete(settingsStatsCache).where(eq(settingsStatsCache.key, key));
}
