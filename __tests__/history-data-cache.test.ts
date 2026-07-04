import type {HistoryData} from '../src/lib/history-data-types';
import {getTodayDateKey} from '../src/lib/day-utils';
import {HISTORY_DATA_CACHE_MAX_ENTRIES} from '@/lib/app-constants';
import {
  historyCacheKey,
  historyDataCache,
  resetHistoryDataCacheForTests,
} from '../src/lib/history-data-cache';
import {buildTripDetectionConfig} from '../src/lib/trip-settings';

const config = buildTripDetectionConfig(10, 10, 25);

function sampleData(dateKey: string): HistoryData {
  return {
    dateKey,
    points: [],
    entries: [],
    range: {startAt: new Date(), endAt: new Date()},
  };
}

describe('historyDataCache', () => {
  beforeEach(() => {
    resetHistoryDataCacheForTests();
  });

  it('keeps only the most recently viewed day', () => {
    const firstKey = historyCacheKey('2026-06-01', config);
    const secondKey = historyCacheKey('2026-06-02', config);

    historyDataCache.write(firstKey, sampleData('2026-06-01'), '1:1');
    historyDataCache.write(secondKey, sampleData('2026-06-02'), '2:2');

    expect(historyDataCache.peek(firstKey)).toBeNull();
    expect(historyDataCache.peek(secondKey)?.dateKey).toBe('2026-06-02');
    expect(HISTORY_DATA_CACHE_MAX_ENTRIES).toBe(1);
  });

  it('evicts today when the user browses another day', () => {
    const todayKey = getTodayDateKey();
    const todayCacheKey = historyCacheKey(todayKey, config);
    const pastKey = historyCacheKey('2026-06-01', config);

    historyDataCache.write(todayCacheKey, sampleData(todayKey), 'today');
    historyDataCache.write(pastKey, sampleData('2026-06-01'), '1:1');

    expect(historyDataCache.peek(todayCacheKey)).toBeNull();
    expect(historyDataCache.peek(pastKey)?.dateKey).toBe('2026-06-01');
  });
});
