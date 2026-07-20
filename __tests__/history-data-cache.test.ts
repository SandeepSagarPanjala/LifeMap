import type { HistoryData } from '../src/lib/history-data-types';
import { getTodayDateKey } from '../src/lib/day-utils';
import { HISTORY_DATA_CACHE_MAX_ENTRIES } from '@/lib/app-constants';
import {
  historyCacheKey,
  historyDataCache,
  resetHistoryDataCacheForTests,
} from '../src/lib/history-data-cache';
import { buildTripDetectionConfig } from '../src/lib/trip-settings';

const config = buildTripDetectionConfig(10, 10, 25);

function sampleData(dateKey: string): HistoryData {
  return {
    dateKey,
    points: [],
    entries: [],
    range: { startAt: new Date(), endAt: new Date() },
  };
}

describe('historyDataCache', () => {
  beforeEach(() => {
    resetHistoryDataCacheForTests();
  });

  it('evicts the oldest day when cache exceeds max entries', () => {
    const keys = Array.from(
      { length: HISTORY_DATA_CACHE_MAX_ENTRIES + 1 },
      (_, index) => {
        const day = String(index + 1).padStart(2, '0');
        const dateKey = `2026-06-${day}`;
        return {
          cacheKey: historyCacheKey(dateKey, config),
          dateKey,
        };
      },
    );

    for (const [index, item] of keys.entries()) {
      historyDataCache.write(
        item.cacheKey,
        sampleData(item.dateKey),
        `${index + 1}:${index + 1}`,
      );
    }

    const [oldest, ...remaining] = keys;
    expect(historyDataCache.peek(oldest!.cacheKey)).toBeNull();
    for (const item of remaining) {
      expect(historyDataCache.peek(item.cacheKey)?.dateKey).toBe(item.dateKey);
    }
  });

  it('keeps today when the user browses one other day', () => {
    const todayKey = getTodayDateKey();
    const todayCacheKey = historyCacheKey(todayKey, config);
    const pastKey = historyCacheKey('2026-06-01', config);

    historyDataCache.write(todayCacheKey, sampleData(todayKey), 'today');
    historyDataCache.write(pastKey, sampleData('2026-06-01'), '1:1');

    expect(historyDataCache.peek(todayCacheKey)?.dateKey).toBe(todayKey);
    expect(historyDataCache.peek(pastKey)?.dateKey).toBe('2026-06-01');
  });
});
