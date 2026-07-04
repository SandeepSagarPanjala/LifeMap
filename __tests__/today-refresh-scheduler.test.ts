import type {DetectedTrip} from '@/lib/trip-detection';

jest.mock('@/lib/drive-map-refresh-settings', () => ({
  ...jest.requireActual('@/lib/drive-map-refresh-settings'),
  getDriveMapRefreshIntervalMs: jest.fn().mockResolvedValue(30_000),
}));

import type {DriveMapRefreshIntervalMs} from '@/lib/app-constants';
import {getDriveMapRefreshIntervalMs} from '@/lib/drive-map-refresh-settings';
import {
  getTodayHistoryRefreshRevision,
  isDriveRefreshIntervalActiveForTests,
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
    resetTodayRefreshSchedulerForTests();
    setTodayRefreshAppForeground(true);
    jest.mocked(getDriveMapRefreshIntervalMs).mockResolvedValue(30_000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refreshes listeners when the app returns to the foreground', () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    refreshTodayOnForeground();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getTodayHistoryRefreshRevision()).toBe(1);
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

  it('starts a drive interval after sync reports an open drive', async () => {
    updateTodayRefreshAfterSync(openDrive());
    await Promise.resolve();

    expect(isDriveRefreshIntervalActiveForTests()).toBe(true);
  });

  it('stops the drive interval when sync reports an open stay', async () => {
    updateTodayRefreshAfterSync(openDrive());
    await Promise.resolve();

    updateTodayRefreshAfterSync(openStay());

    expect(isDriveRefreshIntervalActiveForTests()).toBe(false);
  });

  it('ignores GPS debounce while the drive interval is active', async () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    updateTodayRefreshAfterSync(openDrive());
    await Promise.resolve();

    scheduleTodayRefreshAfterGps();
    jest.advanceTimersByTime(8_000);

    expect(listener).not.toHaveBeenCalled();
  });

  it('refreshes on the drive interval cadence', async () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    updateTodayRefreshAfterSync(openDrive());
    await Promise.resolve();

    jest.advanceTimersByTime(30_000);
    expect(listener).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(30_000);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops the drive interval when the app backgrounds', async () => {
    updateTodayRefreshAfterSync(openDrive());
    await Promise.resolve();

    setTodayRefreshAppForeground(false);

    expect(isDriveRefreshIntervalActiveForTests()).toBe(false);
  });

  it('does not start the drive interval in the background', async () => {
    setTodayRefreshAppForeground(false);

    updateTodayRefreshAfterSync(openDrive());
    await Promise.resolve();

    expect(isDriveRefreshIntervalActiveForTests()).toBe(false);
  });

  it('starts only one drive interval when start is requested concurrently', async () => {
    let resolveInterval: ((ms: DriveMapRefreshIntervalMs) => void) | null = null;
    jest.mocked(getDriveMapRefreshIntervalMs).mockImplementation(
      () =>
        new Promise<DriveMapRefreshIntervalMs>(resolve => {
          resolveInterval = resolve;
        }),
    );

    updateTodayRefreshAfterSync(openDrive());
    updateTodayRefreshAfterSync(openDrive());

    resolveInterval!(30_000);
    await Promise.resolve();

    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);
    jest.advanceTimersByTime(30_000);

    expect(isDriveRefreshIntervalActiveForTests()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clears a pending GPS debounce when the drive interval starts', async () => {
    const listener = jest.fn();
    subscribeTodayHistoryRefresh(listener);

    scheduleTodayRefreshAfterGps();
    updateTodayRefreshAfterSync(openDrive());
    await Promise.resolve();

    jest.advanceTimersByTime(8_000);

    expect(listener).not.toHaveBeenCalled();
  });
});
