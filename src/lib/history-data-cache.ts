import type { HistoryData } from '@/lib/history-data-types';
import { TRIP_DETECTION_VERSION } from '@/lib/app-constants';
import { getTodayDateKey } from '@/lib/day-utils';
import type { TripDetectionConfig } from '@/lib/trip-settings';

/** Today never uses fingerprint cache validation — placeholder for RAM peek only. */
export const TODAY_LIVE_FINGERPRINT = 'today-live';

export function historyCacheKey(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
): string {
  return `${dateKey}:${detectionConfig.dwellMinutes}:${detectionConfig.dwellRadiusMeters}:v${TRIP_DETECTION_VERSION}`;
}

type CacheSlot = {
  data: HistoryData;
  fingerprint: string;
};

/**
 * Today-only RAM cache. Past days are never stored so browsing history cannot
 * evict Today (the day users return to constantly).
 */
class HistoryDataCache {
  private slots = new Map<string, CacheSlot>();

  peek(cacheKey: string): HistoryData | null {
    return this.slots.get(cacheKey)?.data ?? null;
  }

  getFingerprint(dateKey: string): string | undefined {
    for (const slot of this.slots.values()) {
      if (slot.data.dateKey === dateKey) {
        return slot.fingerprint;
      }
    }
    return undefined;
  }

  has(cacheKey: string): boolean {
    return this.slots.has(cacheKey);
  }

  read(cacheKey: string, dateKey: string): HistoryData | null {
    const slot = this.slots.get(cacheKey);
    if (slot == null || slot.data.dateKey !== dateKey) {
      return null;
    }
    return slot.data;
  }

  write(cacheKey: string, data: HistoryData, fingerprint: string): void {
    if (data.dateKey !== getTodayDateKey()) {
      return;
    }

    // Keep a single Today slot (config key may change); drop everything else.
    this.slots.clear();
    this.slots.set(cacheKey, { data, fingerprint });
  }

  clear(): void {
    this.slots.clear();
  }
}

export const historyDataCache = new HistoryDataCache();

export function clearHistoryDataCache(): void {
  historyDataCache.clear();
}

/** @internal — reset between tests. */
export function resetHistoryDataCacheForTests(): void {
  clearHistoryDataCache();
}
