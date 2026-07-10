import type { HistoryData } from '@/lib/history-data-types';
import { historyDataDisplayEqual } from '@/lib/history-display-equality';
import { makeLocationPoint } from './helpers/fixtures';

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
      points: [makeLocationPoint({ id: 1, lat: 1, lng: 1, timestamp: new Date(1) })],
    });
    const right = historyData({
      entries: [
        {
          id: 'stay-1',
          kind: 'stay',
          points: [makeLocationPoint({ id: 2, lat: 2, lng: 2, timestamp: new Date(99) })],
          startAt: new Date('2026-07-09T08:00:00'),
          endAt: new Date('2026-07-09T09:00:00'),
          durationMs: 3_600_000,
          distanceKm: 0,
          openThroughNow: true,
        },
      ],
      points: [makeLocationPoint({ id: 3, lat: 9, lng: 9, timestamp: new Date(1) })],
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
      points: [makeLocationPoint({ id: 1, lat: 1, lng: 1, timestamp: new Date(1) })],
    });
    const right = historyData({
      points: [makeLocationPoint({ id: 2, lat: 1, lng: 1, timestamp: new Date(2) })],
    });

    expect(historyDataDisplayEqual(left, right)).toBe(false);
  });
});
