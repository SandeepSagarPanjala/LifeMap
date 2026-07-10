import { getTodayDateKey } from '@/lib/day-utils';
import {
  historyCacheKey,
  historyDataCache,
  TODAY_LIVE_FINGERPRINT,
} from '@/lib/history-data-cache';
import { loadHistoryForDayCoalesced } from '@/lib/history-day-load';
import { ensureHistoryCalendarBounds } from '@/lib/history-calendar-bounds';
import { getCurrentTripDetectionConfig } from '@/lib/trip-detection-config';
import { markTodayPreloadedForMountSkip } from '@/lib/today-preload-coordination';

import { ensureDatabaseReady } from '@/location/bootstrap';

/** Warm today’s timeline once DB is ready so the map is not empty on first paint. */
export async function preloadTodayHistory(): Promise<void> {
  await ensureDatabaseReady();
  await ensureHistoryCalendarBounds();

  const todayKey = getTodayDateKey();
  const detectionConfig = getCurrentTripDetectionConfig();
  const cacheKey = historyCacheKey(todayKey, detectionConfig);
  if (historyDataCache.has(cacheKey)) {
    markTodayPreloadedForMountSkip(cacheKey);
    return;
  }

  const result = await loadHistoryForDayCoalesced(todayKey, detectionConfig);
  historyDataCache.write(cacheKey, result, TODAY_LIVE_FINGERPRINT);
  markTodayPreloadedForMountSkip(cacheKey);
}
