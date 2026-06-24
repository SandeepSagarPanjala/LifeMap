import {getTodayDateKey} from '@/lib/day-utils';
import {
  historyCacheKey,
  historyDataCache,
} from '@/lib/history-data-cache';
import {getDayHistoryFingerprint} from '@/lib/history-fingerprint';
import {ensureHistoryCalendarBounds} from '@/lib/history-calendar-bounds';
import {syncTodayDisplay} from '@/lib/today-sync';
import {getCurrentTripDetectionConfig} from '@/lib/trip-detection-config';

import {ensureDatabaseReady} from '@/location/bootstrap';

/** Warm today’s timeline once DB is ready so the map is not empty on first paint. */
export async function preloadTodayHistory(): Promise<void> {
  await ensureDatabaseReady();
  await ensureHistoryCalendarBounds();

  const todayKey = getTodayDateKey();
  const detectionConfig = getCurrentTripDetectionConfig();
  const cacheKey = historyCacheKey(todayKey, detectionConfig);
  if (historyDataCache.has(cacheKey)) {
    return;
  }

  const fingerprint = await getDayHistoryFingerprint(todayKey);
  const result = await syncTodayDisplay(detectionConfig, undefined, {
    skipRepair: false,
  });
  historyDataCache.write(cacheKey, result, fingerprint);
}
