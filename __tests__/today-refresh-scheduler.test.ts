import {
  getTodayHistoryRefreshRevision,
  resetTodayRefreshSchedulerForTests,
  scheduleTodayImmediateMapRefresh,
  scheduleTodayRefreshAfterGps,
  subscribeTodayHistoryRefresh,
  TODAY_MAP_REFRESH_DEBOUNCE_MS,
  TODAY_MAP_REFRESH_MAX_WAIT_MS,
} from '@/lib/today-refresh-scheduler';

jest.mock('@/lib/trip-materialization', () => ({
  persistTodaySealableSegments: jest.fn().mockResolvedValue(0),
}));

describe('today refresh scheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetTodayRefreshSchedulerForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refreshes immediately on foreground/motion hook', () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    scheduleTodayImmediateMapRefresh();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getTodayHistoryRefreshRevision()).toBe(1);
  });

  it('debounces map refresh until GPS saves go quiet', () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    scheduleTodayRefreshAfterGps();
    scheduleTodayRefreshAfterGps();

    expect(listener).not.toHaveBeenCalled();
    jest.advanceTimersByTime(TODAY_MAP_REFRESH_DEBOUNCE_MS - 1);
    expect(listener).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('forces a map refresh while GPS keeps saving', () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    scheduleTodayRefreshAfterGps();
    jest.advanceTimersByTime(TODAY_MAP_REFRESH_DEBOUNCE_MS - 1);
    scheduleTodayRefreshAfterGps();
    jest.advanceTimersByTime(TODAY_MAP_REFRESH_DEBOUNCE_MS - 1);

    expect(listener).not.toHaveBeenCalled();

    jest.advanceTimersByTime(
      TODAY_MAP_REFRESH_MAX_WAIT_MS - (TODAY_MAP_REFRESH_DEBOUNCE_MS - 1),
    );
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
