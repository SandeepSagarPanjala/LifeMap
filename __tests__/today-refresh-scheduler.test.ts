import {
  getTodayHistoryRefreshRevision,
  refreshTodayOnForeground,
  resetTodayRefreshSchedulerForTests,
  scheduleTodayRefreshAfterGps,
  subscribeTodayHistoryRefresh,
} from '@/lib/today-refresh-scheduler';

describe('today refresh scheduler', () => {
  beforeEach(() => {
    resetTodayRefreshSchedulerForTests();
  });

  it('refreshes listeners when the app returns to the foreground', () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    refreshTodayOnForeground();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getTodayHistoryRefreshRevision()).toBe(1);
  });

  it('does not refresh listeners after GPS saves', () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    scheduleTodayRefreshAfterGps();
    scheduleTodayRefreshAfterGps();

    expect(listener).not.toHaveBeenCalled();
    expect(getTodayHistoryRefreshRevision()).toBe(0);
  });
});
