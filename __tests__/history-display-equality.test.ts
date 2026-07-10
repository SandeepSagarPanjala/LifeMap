import type { HistoryData } from '@/lib/history-data-types';
import { historyDataDisplayEqual } from '@/lib/history-display-equality';

function historyData(
  overrides: Partial<HistoryData> = {},
): HistoryData {
  const dayStart = new Date('2026-07-09T00:00:00');
  return {
    dateKey: '2026-07-09',
    points: [],
    entries: [],
    range: { startAt: dayStart, endAt: dayStart },
    ...overrides,
  };
}

describe('historyDataDisplayEqual', () => {
  it('returns true for the same reference', () => {
    const snapshot = historyData();
    expect(historyDataDisplayEqual(snapshot, snapshot)).toBe(true);
  });

  it('returns true when map-relevant fields match', () => {
    const left = historyData({
      entries: [
        {
          id: 'stay-1',
          kind: 'stay',
          points: [],
          startAt: new Date('2026-07-09T08:00:00'),
          endAt: new Date('2026-07-09T09:00:00'),
          durationMs: 3_600_000,
          distanceKm: 0,
          openThroughNow: true,
        },
      ],
      points: [{ recordedAtMs: 1, latitude: 1, longitude: 1 }],
    });
    const right = historyData({
      entries: [
        {
          id: 'stay-1',
          kind: 'stay',
          points: [{ recordedAtMs: 99, latitude: 2, longitude: 2 }],
          startAt: new Date('2026-07-09T08:00:00'),
          endAt: new Date('2026-07-09T09:00:00'),
          durationMs: 3_600_000,
          distanceKm: 0,
          openThroughNow: true,
        },
      ],
      points: [{ recordedAtMs: 1, latitude: 9, longitude: 9 }],
    });

    expect(historyDataDisplayEqual(left, right)).toBe(true);
  });

  it('returns false when entry count changes', () => {
    const left = historyData();
    const right = historyData({
      entries: [
        {
          id: 'stay-1',
          kind: 'stay',
          points: [],
          startAt: new Date('2026-07-09T08:00:00'),
          endAt: new Date('2026-07-09T09:00:00'),
          durationMs: 3_600_000,
          distanceKm: 0,
          openThroughNow: true,
        },
      ],
    });

    expect(historyDataDisplayEqual(left, right)).toBe(false);
  });

  it('returns false when the latest GPS point timestamp changes', () => {
    const left = historyData({
      points: [{ recordedAtMs: 1, latitude: 1, longitude: 1 }],
    });
    const right = historyData({
      points: [{ recordedAtMs: 2, latitude: 1, longitude: 1 }],
    });

    expect(historyDataDisplayEqual(left, right)).toBe(false);
  });
});
