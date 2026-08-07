import {
  readSettingsStatsCache,
  writeSettingsStatsCache,
  deleteSettingsStatsCache,
  SETTINGS_STATS_CACHE_KEYS,
} from '@/db/repositories/settings-stats-cache';

import type { AchievementsProgressPayload } from './types';

export async function readAchievementsProgress(): Promise<AchievementsProgressPayload | null> {
  const cached = await readSettingsStatsCache<AchievementsProgressPayload>(
    SETTINGS_STATS_CACHE_KEYS.achievementsProgress,
  );
  return cached?.payload ?? null;
}

export async function writeAchievementsProgress(
  payload: AchievementsProgressPayload,
): Promise<void> {
  await writeSettingsStatsCache(
    SETTINGS_STATS_CACHE_KEYS.achievementsProgress,
    payload,
  );
}

export async function clearAchievementsProgress(): Promise<void> {
  await deleteSettingsStatsCache(SETTINGS_STATS_CACHE_KEYS.achievementsProgress);
}

export function emptyAchievementsProgress(): AchievementsProgressPayload {
  return { unlocks: {} };
}
