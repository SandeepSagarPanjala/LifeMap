import type { HistoryData } from '../src/lib/history-data-types';
import { getTodayDateKey } from '../src/lib/day-utils';
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

  it('ignores past-day writes so browsing cannot fill the cache', () => {
    const pastKey = historyCacheKey('2026-06-01', config);
    historyDataCache.write(pastKey, sampleData('2026-06-01'), '1:1');
    expect(historyDataCache.peek(pastKey)).toBeNull();
  });

  it('keeps today and ignores past-day writes after today is cached', () => {
    const todayKey = getTodayDateKey();
    const todayCacheKey = historyCacheKey(todayKey, config);
    const pastKey = historyCacheKey('2026-06-01', config);

    historyDataCache.write(todayCacheKey, sampleData(todayKey), 'today');
    historyDataCache.write(pastKey, sampleData('2026-06-01'), '1:1');

    expect(historyDataCache.peek(todayCacheKey)?.dateKey).toBe(todayKey);
    expect(historyDataCache.peek(pastKey)).toBeNull();

    historyDataCache.write(todayCacheKey, sampleData(todayKey), 'today-2');
    expect(historyDataCache.peek(todayCacheKey)?.dateKey).toBe(todayKey);
    expect(historyDataCache.getFingerprint(todayKey)).toBe('today-2');
  });
});
