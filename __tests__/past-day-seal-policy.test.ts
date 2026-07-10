import {
  filterEntriesForPastDaySeal,
  isCrossMidnightTravelForDay,
  splitEntriesForPastDaySeal,
} from '@/lib/past-day-seal-policy';
import type { DetectedTrip } from '@/lib/trip-detection';

function stay(startMs: number, endMs: number): DetectedTrip {
  return {
    id: `stay-${startMs}`,
    kind: 'stay',
    points: [],
    startAt: new Date(startMs),
    endAt: new Date(endMs),
    durationMs: endMs - startMs,
    distanceKm: 0,
  };
}

function travel(startMs: number, endMs: number): DetectedTrip {
  return {
    id: `travel-${startMs}`,
    kind: 'travel',
    points: [],
    startAt: new Date(startMs),
    endAt: new Date(endMs),
    durationMs: endMs - startMs,
    distanceKm: 2,
  };
}

describe('isCrossMidnightTravelForDay', () => {
  it('returns true when a drive ends on the next calendar day', () => {
    const drive = travel(
      Date.parse('2026-07-09T04:00:00.000Z'), // Jul 8 11pm CDT
      Date.parse('2026-07-09T06:00:00.000Z'), // Jul 9 1am CDT
    );
    expect(isCrossMidnightTravelForDay(drive, '2026-07-08')).toBe(true);
    expect(isCrossMidnightTravelForDay(drive, '2026-07-09')).toBe(false);
  });

  it('returns false for a drive fully inside one day', () => {
    const drive = travel(
      Date.parse('2026-07-08T19:00:00.000Z'),
      Date.parse('2026-07-08T20:00:00.000Z'),
    );
    expect(isCrossMidnightTravelForDay(drive, '2026-07-08')).toBe(false);
  });
});

describe('splitEntriesForPastDaySeal', () => {
  it('drops only the last cross-midnight drive and records its start', () => {
    const home = stay(
      Date.parse('2026-07-08T23:00:00.000Z'),
      Date.parse('2026-07-09T01:00:00.000Z'),
    );
    const driveStartMs = Date.parse('2026-07-09T04:00:00.000Z');
    const drive = travel(
      driveStartMs,
      Date.parse('2026-07-09T06:00:00.000Z'),
    );
    const split = splitEntriesForPastDaySeal([home, drive], '2026-07-08');
    expect(split.sealable).toHaveLength(1);
    expect(split.sealable[0]).toMatchObject({ kind: 'stay' });
    expect(split.excludedCrossMidnightFromMs).toBe(driveStartMs);
  });

  it('keeps a same-day drive as the last segment', () => {
    const home = stay(
      Date.parse('2026-07-08T15:00:00.000Z'),
      Date.parse('2026-07-08T17:00:00.000Z'),
    );
    const drive = travel(
      Date.parse('2026-07-08T19:00:00.000Z'),
      Date.parse('2026-07-08T20:00:00.000Z'),
    );
    const split = splitEntriesForPastDaySeal([home, drive], '2026-07-08');
    expect(split.sealable).toHaveLength(2);
    expect(split.excludedCrossMidnightFromMs).toBeNull();
  });
});

describe('filterEntriesForPastDaySeal', () => {
  it('returns only sealable entries', () => {
    const drive = travel(
      Date.parse('2026-07-09T04:00:00.000Z'),
      Date.parse('2026-07-09T06:00:00.000Z'),
    );
    expect(filterEntriesForPastDaySeal([drive], '2026-07-08')).toEqual([]);
  });
});
