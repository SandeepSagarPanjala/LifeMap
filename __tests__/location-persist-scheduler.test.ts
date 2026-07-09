import { LocationPersistScheduler } from '../src/lib/location-persist-scheduler';

describe('LocationPersistScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves immediately on first point', async () => {
    const flushes: number[] = [];
    const scheduler = new LocationPersistScheduler(
      30_000,
      ({ timestampMs }) => {
        flushes.push(timestampMs);
      },
    );

    scheduler.enqueue(1_000);
    await Promise.resolve();

    expect(flushes).toEqual([1_000]);
  });

  it('keeps only the latest fix in a burst window', async () => {
    const flushes: number[] = [];
    const scheduler = new LocationPersistScheduler(
      30_000,
      ({ timestampMs }) => {
        flushes.push(timestampMs);
      },
    );

    scheduler.enqueue(1_000);
    await Promise.resolve();
    expect(flushes).toEqual([1_000]);

    scheduler.enqueue(5_000);
    scheduler.enqueue(10_000);
    scheduler.enqueue(25_000);

    jest.advanceTimersByTime(5_000);
    await Promise.resolve();
    expect(flushes).toHaveLength(1);

    jest.advanceTimersByTime(25_000);
    await Promise.resolve();

    expect(flushes).toEqual([1_000, 25_000]);
  });

  it('saves immediately after the window has elapsed', async () => {
    const flushes: number[] = [];
    const scheduler = new LocationPersistScheduler(
      30_000,
      ({ timestampMs }) => {
        flushes.push(timestampMs);
      },
    );

    scheduler.enqueue(0);
    await Promise.resolve();

    scheduler.enqueue(35_000);
    await Promise.resolve();

    expect(flushes).toEqual([0, 35_000]);
  });
});
