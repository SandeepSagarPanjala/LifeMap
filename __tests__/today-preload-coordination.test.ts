import {
  markTodayPreloadedForMountSkip,
  resetTodayPreloadMountSkip,
  shouldSkipTodayPreloadMountSync,
} from '@/lib/today-preload-coordination';

describe('today-preload-coordination', () => {
  beforeEach(() => {
    resetTodayPreloadMountSkip();
  });

  it('skips mount sync while cache key matches across repeated checks', () => {
    markTodayPreloadedForMountSkip('2026-07-09:15:100:v1');
    expect(shouldSkipTodayPreloadMountSync('2026-07-09:15:100:v1')).toBe(true);
    expect(shouldSkipTodayPreloadMountSync('2026-07-09:15:100:v1')).toBe(true);
  });

  it('does not skip when cache key differs', () => {
    markTodayPreloadedForMountSkip('2026-07-09:15:100:v1');
    expect(shouldSkipTodayPreloadMountSync('2026-07-09:20:100:v1')).toBe(false);
    expect(shouldSkipTodayPreloadMountSync('2026-07-09:15:100:v1')).toBe(true);
  });

  it('resets on beginTodayOpenCycle boundary', () => {
    markTodayPreloadedForMountSkip('2026-07-09:15:100:v1');
    resetTodayPreloadMountSkip();
    expect(shouldSkipTodayPreloadMountSync('2026-07-09:15:100:v1')).toBe(false);
  });
});
