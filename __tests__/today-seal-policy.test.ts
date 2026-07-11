import {
  getSealableTodayEntries,
  getTodayLiveBufferStartIndex,
} from '@/lib/today-seal-policy';
import { buildTripDetectionConfig } from '@/lib/trip-settings';
import type { DetectedTrip } from '@/lib/trip-detection';

const config = buildTripDetectionConfig(10, 5, 75);

function stay(
  id: string,
  startMs: number,
  endMs: number,
  openThroughNow?: boolean,
): DetectedTrip {
  return {
    id,
    kind: 'stay',
    points: [],
    startAt: new Date(startMs),
    endAt: new Date(endMs),
    durationMs: endMs - startMs,
    distanceKm: 0,
    openThroughNow,
  };
}

function travel(id: string, startMs: number, endMs: number): DetectedTrip {
  return {
    id,
    kind: 'travel',
    points: [],
    startAt: new Date(startMs),
    endAt: new Date(endMs),
    durationMs: endMs - startMs,
    distanceKm: 2,
  };
}

describe('today seal policy', () => {
  it('keeps a single open home stay entirely live', () => {
    const now = new Date('2026-06-19T22:00:00.000Z');
    const entries = [stay('home', 1_000, 2_000, true)];
    expect(getTodayLiveBufferStartIndex(entries, now, config)).toBe(0);
    expect(getSealableTodayEntries(entries, now, config)).toHaveLength(0);
  });

  it('hard X − 2: seals only the prefix and always leaves the last 2 live', () => {
    const now = new Date('2026-06-19T22:00:00.000Z');
    const entries = [
      stay(
        'home',
        now.getTime() - 8 * 60 * 60_000,
        now.getTime() - 3 * 60 * 60_000,
      ),
      travel(
        'out',
        now.getTime() - 3 * 60 * 60_000,
        now.getTime() - 2 * 60 * 60_000,
      ),
      stay(
        'shop',
        now.getTime() - 2 * 60 * 60_000,
        now.getTime() - 30 * 60_000,
      ),
      travel('back', now.getTime() - 30 * 60_000, now.getTime() - 10 * 60_000),
      stay(
        'home-again',
        now.getTime() - 10 * 60_000,
        now.getTime() - 1 * 60_000,
        true,
      ),
    ];

    expect(getTodayLiveBufferStartIndex(entries, now, config)).toBe(
      entries.length - 2,
    );
    expect(
      getSealableTodayEntries(entries, now, config).map(entry => entry.id),
    ).toEqual(['home', 'out', 'shop']);
  });

  it('hard X − 2: does not seal the last 2 even when they ended long ago', () => {
    const now = new Date('2026-06-19T22:00:00.000Z');
    const entries = [
      stay(
        'home',
        now.getTime() - 4 * 60 * 60_000,
        now.getTime() - 3 * 60 * 60_000,
      ),
      travel(
        'drive',
        now.getTime() - 3 * 60 * 60_000,
        now.getTime() - 2 * 60 * 60_000,
      ),
      stay(
        'stop',
        now.getTime() - 2 * 60 * 60_000,
        now.getTime() - 90 * 60_000,
      ),
    ];

    expect(getTodayLiveBufferStartIndex(entries, now, config)).toBe(1);
    expect(
      getSealableTodayEntries(entries, now, config).map(entry => entry.id),
    ).toEqual(['home']);
  });

  it('does not seal when X − 2 ≤ 0', () => {
    const now = new Date('2026-06-19T22:00:00.000Z');
    const entries = [
      travel('a', now.getTime() - 20 * 60_000, now.getTime() - 10 * 60_000),
      stay('b', now.getTime() - 10 * 60_000, now.getTime(), true),
    ];
    expect(getTodayLiveBufferStartIndex(entries, now, config)).toBe(0);
    expect(getSealableTodayEntries(entries, now, config)).toHaveLength(0);
  });
});
