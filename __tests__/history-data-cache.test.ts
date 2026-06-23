import type {HistoryData} from '../src/lib/history-data-types';
import {getTodayDateKey} from '../src/lib/day-utils';
import {
  historyCacheKey,
  historyDataCache,
  HISTORY_DATA_CACHE_MAX_ENTRIES,
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

  it('evicts the oldest day when more than max entries are stored', () => {
    const firstKey = historyCacheKey('2026-06-01', config);
    const secondKey = historyCacheKey('2026-06-02', config);
    const thirdKey = historyCacheKey('2026-06-03', config);

    historyDataCache.write(firstKey, sampleData('2026-06-01'), '1:1');
    historyDataCache.write(secondKey, sampleData('2026-06-02'), '2:2');
    historyDataCache.write(thirdKey, sampleData('2026-06-03'), '3:3');

    expect(historyDataCache.peek(firstKey)).toBeNull();
    expect(historyDataCache.peek(secondKey)?.dateKey).toBe('2026-06-02');
    expect(historyDataCache.peek(thirdKey)?.dateKey).toBe('2026-06-03');
    expect(HISTORY_DATA_CACHE_MAX_ENTRIES).toBe(2);
  });

  it('never evicts today when browsing other days', () => {
    const todayKey = getTodayDateKey();
    const todayCacheKey = historyCacheKey(todayKey, config);
    const firstKey = historyCacheKey('2026-06-01', config);
    const secondKey = historyCacheKey('2026-06-02', config);
    const thirdKey = historyCacheKey('2026-06-03', config);

    historyDataCache.write(todayCacheKey, sampleData(todayKey), 'today');
    historyDataCache.write(firstKey, sampleData('2026-06-01'), '1:1');
    historyDataCache.write(secondKey, sampleData('2026-06-02'), '2:2');
    historyDataCache.write(thirdKey, sampleData('2026-06-03'), '3:3');

    expect(historyDataCache.peek(todayCacheKey)?.dateKey).toBe(todayKey);
    expect(historyDataCache.peek(firstKey)).toBeNull();
    expect(historyDataCache.peek(secondKey)).toBeNull();
    expect(historyDataCache.peek(thirdKey)?.dateKey).toBe('2026-06-03');
  });
});
