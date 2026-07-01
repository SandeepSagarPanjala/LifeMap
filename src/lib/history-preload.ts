import {getTodayDateKey} from '@/lib/day-utils';
import {
  historyCacheKey,
  historyDataCache,
  TODAY_LIVE_FINGERPRINT,
} from '@/lib/history-data-cache';
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

  const result = await syncTodayDisplay(detectionConfig, undefined, {
    skipRepair: true,
  });
  historyDataCache.write(cacheKey, result, TODAY_LIVE_FINGERPRINT);
}
