import {makeMoment} from './helpers/fixtures';
import {
  countMomentsForEntry,
  filterMomentsForEntry,
} from '@/lib/moments/moment-counts';
import type {DetectedTrip} from '@/lib/trip-detection';

function moment(
  id: number,
  iso: string,
  type: 'note' | 'photo' | 'voice' = 'note',
) {
  return makeMoment({id, timestamp: new Date(iso), type});
}

function materializedStay(): DetectedTrip {
  return {
    id: 'stay-1',
    kind: 'stay',
    points: [],
    startAt: new Date('2026-06-17T10:00:00.000Z'),
    endAt: new Date('2026-06-17T11:00:00.000Z'),
    durationMs: 3_600_000,
    distanceKm: 0,
    materializedTripId: 99,
    momentRefs: [
      {momentId: 2, momentKind: 'photo'},
      {momentId: 3, momentKind: 'voice'},
    ],
  };
}

describe('materialized moment counts', () => {
  const dayMoments = [
    moment(1, '2026-06-17T09:00:00.000Z'),
    moment(2, '2026-06-17T10:30:00.000Z', 'photo'),
    moment(3, '2026-06-17T10:45:00.000Z', 'voice'),
    moment(4, '2026-06-17T12:00:00.000Z', 'photo'),
  ];

  it('uses moment_refs for sealed trips instead of timestamp scan', () => {
    const entry = materializedStay();
    expect(countMomentsForEntry(dayMoments, entry)).toEqual({
      photo: 1,
      video: 0,
      voice: 1,
      note: 0,
      activity: 0,
    });
    expect(filterMomentsForEntry(dayMoments, entry).map(row => row.id)).toEqual([
      2, 3,
    ]);
  });

  it('falls back to timestamp window for live tail entries', () => {
    const entry: DetectedTrip = {
      ...materializedStay(),
      materializedTripId: undefined,
      momentRefs: undefined,
    };
    expect(countMomentsForEntry(dayMoments, entry).photo).toBe(1);
    expect(filterMomentsForEntry(dayMoments, entry).map(row => row.id)).toEqual([
      2, 3,
    ]);
  });
});
