import type { DetectedTrip } from '@/lib/trip-detection';

import { resetBootstrapTraceForTests } from '@/lib/log-bootstrap';
import {
  getTodayHistoryRefreshRevision,
  isGpsRefreshTimerActiveForTests,
  isOpenDriveRefreshSuppressedForTests,
  refreshTodayOnForeground,
  resetTodayRefreshSchedulerForTests,
  scheduleTodayRefreshAfterGps,
  setTodayRefreshAppForeground,
  subscribeTodayHistoryRefresh,
  updateTodayRefreshAfterSync,
} from '@/lib/today-refresh-scheduler';

function openDrive(): DetectedTrip {
  return {
    id: 'drive-open',
    kind: 'travel',
    points: [],
    startAt: new Date('2026-06-22T08:00:00'),
    endAt: new Date('2026-06-22T08:30:00'),
    durationMs: 30 * 60_000,
    distanceKm: 12,
    openThroughNow: true,
  };
}

function openStay(): DetectedTrip {
  return {
    id: 'stay-open',
    kind: 'stay',
    points: [],
    startAt: new Date('2026-06-22T08:00:00'),
    endAt: new Date('2026-06-22T08:30:00'),
    durationMs: 30 * 60_000,
    distanceKm: 0,
    openThroughNow: true,
  };
}

describe('today refresh scheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetBootstrapTraceForTests();
    resetTodayRefreshSchedulerForTests();
    setTodayRefreshAppForeground(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refreshes listeners when the app returns to the foreground', async () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    await refreshTodayOnForeground();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getTodayHistoryRefreshRevision()).toBe(1);
  });

  it('waits for async listeners before completing foreground refresh', async () => {
    let resolveSync: (() => void) | undefined;
    subscribeTodayHistoryRefresh(
      () =>
        new Promise<void>(resolve => {
          resolveSync = resolve;
        }),
    );

    const refreshPromise = refreshTodayOnForeground();
    await Promise.resolve();

    expect(getTodayHistoryRefreshRevision()).toBe(1);
    await expect(
      Promise.race([
        refreshPromise.then(() => 'done'),
        Promise.resolve('pending'),
      ]),
    ).resolves.toBe('pending');

    resolveSync?.();
    await refreshPromise;
  });

  it('does not refresh listeners immediately after GPS saves', () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    scheduleTodayRefreshAfterGps();
    scheduleTodayRefreshAfterGps();

    expect(listener).not.toHaveBeenCalled();
    expect(getTodayHistoryRefreshRevision()).toBe(0);
  });

  it('refreshes after the GPS debounce while not driving', async () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    scheduleTodayRefreshAfterGps();
    jest.advanceTimersByTime(8_000);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('suppresses GPS debounce while an open drive is active', async () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    updateTodayRefreshAfterSync(openDrive());

    expect(isOpenDriveRefreshSuppressedForTests()).toBe(true);

    scheduleTodayRefreshAfterGps();
    jest.advanceTimersByTime(8_000);

    expect(listener).not.toHaveBeenCalled();
  });

  it('clears a pending GPS debounce when an open drive starts', async () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    scheduleTodayRefreshAfterGps();
    updateTodayRefreshAfterSync(openDrive());

    jest.advanceTimersByTime(8_000);

    expect(listener).not.toHaveBeenCalled();
  });

  it('restores GPS debounce after sync reports an open stay', async () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    updateTodayRefreshAfterSync(openDrive());
    updateTodayRefreshAfterSync(openStay());

    expect(isOpenDriveRefreshSuppressedForTests()).toBe(false);

    scheduleTodayRefreshAfterGps();
    jest.advanceTimersByTime(8_000);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when the app is backgrounded', async () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    setTodayRefreshAppForeground(false);
    await refreshTodayOnForeground();

    expect(listener).not.toHaveBeenCalled();
    expect(getTodayHistoryRefreshRevision()).toBe(0);
  });

  it('does not schedule GPS debounce refresh while backgrounded', () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    setTodayRefreshAppForeground(false);
    scheduleTodayRefreshAfterGps();
    jest.advanceTimersByTime(8_000);

    expect(listener).not.toHaveBeenCalled();
    expect(getTodayHistoryRefreshRevision()).toBe(0);
  });

  it('clears a pending GPS debounce when the app backgrounds', () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    scheduleTodayRefreshAfterGps();
    setTodayRefreshAppForeground(false);
    jest.advanceTimersByTime(8_000);

    expect(listener).not.toHaveBeenCalled();
    expect(getTodayHistoryRefreshRevision()).toBe(0);
    expect(isGpsRefreshTimerActiveForTests()).toBe(false);
  });
});
