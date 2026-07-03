import type {HistoryData} from '@/lib/history-data-types';
import type {TripDetectionConfig} from '@/lib/trip-settings';
import {TRIP_DETECTION_VERSION} from '@/lib/trip-settings';

/** Only the day the user is viewing — no background pin for today. */
export const HISTORY_DATA_CACHE_MAX_ENTRIES = 1;

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

class HistoryDataCache {
  private slots = new Map<string, CacheSlot>();
  private accessOrder: string[] = [];

  peek(cacheKey: string): HistoryData | null {
    const slot = this.slots.get(cacheKey);
    if (slot == null) {
      return null;
    }
    this.touch(cacheKey);
    return slot.data;
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
    this.touch(cacheKey);
    return slot.data;
  }

  write(
    cacheKey: string,
    data: HistoryData,
    fingerprint: string,
  ): void {
    if (!this.slots.has(cacheKey)) {
      while (this.accessOrder.length >= HISTORY_DATA_CACHE_MAX_ENTRIES) {
        const evictKey = this.accessOrder.shift();
        if (evictKey != null) {
          this.slots.delete(evictKey);
        } else {
          break;
        }
      }
      this.accessOrder.push(cacheKey);
    } else {
      this.touch(cacheKey);
    }

    this.slots.set(cacheKey, {data, fingerprint});
  }

  clear(): void {
    this.slots.clear();
    this.accessOrder = [];
  }

  private touch(cacheKey: string): void {
    const index = this.accessOrder.indexOf(cacheKey);
    if (index >= 0) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(cacheKey);
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
