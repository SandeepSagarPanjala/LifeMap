import {
  loadYesterdayLookbackPointsForToday,
  resolveYesterdayLookbackFromMs,
} from '@/lib/today-lookback';
import type { TripRow } from '@/db/repositories/trips';

jest.mock('@/db/repositories/location-days', () => ({
  getLocationPointsInRange: jest.fn(async () => [{ id: 1 }]),
}));

jest.mock('@/db/repositories/materialized-days', () => ({
  getMaterializedDay: jest.fn(async () => null),
}));

const { getLocationPointsInRange } = jest.requireMock(
  '@/db/repositories/location-days',
);
const { getMaterializedDay } = jest.requireMock(
  '@/db/repositories/materialized-days',
);

function makeTripRow(endAt: Date): TripRow {
  return {
    id: 1,
    eventKey: 'stay:1:2',
    kind: 'stay',
    dateKey: '2026-07-09',
    startAt: new Date(endAt.getTime() - 3_600_000),
    endAt,
    durationMs: 3_600_000,
    distanceKm: 0,
    centroidLat: 0,
    centroidLng: 0,
    segmentOrder: 1,
    placeLabel: null,
    placeId: null,
    placeKind: null,
    poiId: null,
    poiLabel: null,
    momentRefs: null,
    inferred: false,
    selectedCandidateIndex: null,
    detectionVersion: 1,
    closedAt: endAt,
  };
}

describe('resolveYesterdayLookbackFromMs', () => {
  it('returns null when yesterday did not exclude a cross-midnight drive', () => {
    expect(resolveYesterdayLookbackFromMs(null)).toBeNull();
    expect(resolveYesterdayLookbackFromMs(undefined)).toBeNull();
  });

  it('returns the excluded drive start ms when set', () => {
    expect(resolveYesterdayLookbackFromMs(1_234_567_890)).toBe(1_234_567_890);
  });
});

describe('loadYesterdayLookbackPointsForToday', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns no lookback when today already has sealed trips', async () => {
    const points = await loadYesterdayLookbackPointsForToday('2026-07-09', [
      makeTripRow(new Date('2026-07-09T08:00:00.000Z')),
    ]);
    expect(points).toEqual([]);
    expect(getMaterializedDay).not.toHaveBeenCalled();
    expect(getLocationPointsInRange).not.toHaveBeenCalled();
  });

  it('returns no lookback when yesterday has no excluded drive flag', async () => {
    getMaterializedDay.mockResolvedValueOnce({
      excludedCrossMidnightFromMs: null,
    });

    const points = await loadYesterdayLookbackPointsForToday('2026-07-09', []);

    expect(points).toEqual([]);
    expect(getMaterializedDay).toHaveBeenCalledWith('2026-07-08');
    expect(getLocationPointsInRange).not.toHaveBeenCalled();
  });

  it('loads yesterday GPS from the excluded drive start when today is empty', async () => {
    const driveStartMs = Date.parse('2026-07-09T04:00:00.000Z');
    getMaterializedDay.mockResolvedValueOnce({
      excludedCrossMidnightFromMs: driveStartMs,
    });

    await loadYesterdayLookbackPointsForToday('2026-07-09', []);

    expect(getMaterializedDay).toHaveBeenCalledWith('2026-07-08');
    expect(getLocationPointsInRange).toHaveBeenCalledWith(
      new Date(driveStartMs),
      expect.any(Date),
    );
  });
});
