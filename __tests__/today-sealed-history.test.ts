import type {DetectedTrip} from '@/lib/trip-detection';
import {
  filterLiveTailEntries,
  mergeSealedAndLiveTimeline,
  sealedThroughMs,
  tailGpsStartMs,
  trimSealedAtBoundary,
} from '@/lib/today-sealed-history';
import type {TripRow} from '@/db/repositories/trips';
import {makeTripRow} from './helpers/trip-row-fixture';

function stay(id: string, startMs: number, endMs: number, open = false): DetectedTrip {
  const startAt = new Date(startMs);
  const endAt = new Date(endMs);
  return {
    id,
    kind: 'stay',
    points: [
      {
        id: 1,
        timestamp: startAt,
        lat: 33.2,
        lng: -97.1,
        accuracy: 10,
        altitude: null,
        speed: null,
        source: 'gps',
      },
    ],
    startAt,
    endAt,
    durationMs: endMs - startMs,
    distanceKm: 0,
    openThroughNow: open,
  };
}

function travel(id: string, startMs: number, endMs: number): DetectedTrip {
  const startAt = new Date(startMs);
  const endAt = new Date(endMs);
  return {
    id,
    kind: 'travel',
    points: [
      {
        id: 1,
        timestamp: startAt,
        lat: 33.2,
        lng: -97.1,
        accuracy: 10,
        altitude: null,
        speed: null,
        source: 'gps',
      },
      {
        id: 2,
        timestamp: endAt,
        lat: 33.25,
        lng: -97.05,
        accuracy: 10,
        altitude: null,
        speed: null,
        source: 'gps',
      },
    ],
    startAt,
    endAt,
    durationMs: endMs - startMs,
    distanceKm: 2,
  };
}

describe('sealedThroughMs', () => {
  it('returns the latest closed trip end', () => {
    const rows: TripRow[] = [
      makeTripRow({
        id: 1,
        eventKey: 'a',
        kind: 'stay',
        startAt: new Date(1_000),
        endAt: new Date(5_000),
      }),
      makeTripRow({
        id: 2,
        eventKey: 'b',
        kind: 'travel',
        startAt: new Date(5_000),
        endAt: new Date(9_000),
        distanceKm: 1,
      }),
    ];
    expect(sealedThroughMs(rows)).toBe(9_000);
  });
});

describe('mergeSealedAndLiveTimeline', () => {
  it('appends only live tail after the sealed prefix', () => {
    const sealed = [stay('home', 1_000, 5_000), travel('drive', 5_000, 9_000)];
    const live = [
      stay('home', 1_000, 5_000),
      travel('drive', 5_000, 9_000),
      stay('shop', 9_000, 12_000, true),
    ];
    const merged = mergeSealedAndLiveTimeline(sealed, live, 9_000);
    const playable = merged.filter(entry => entry.kind !== 'gap');
    expect(playable.map(entry => entry.id)).toEqual([
      'home',
      'drive',
      'shop',
    ]);
    if (playable[2]?.kind === 'stay') {
      expect(playable[2].openThroughNow).toBe(true);
    }
  });

  it('replaces the overlapping sealed stay with the open tail stay', () => {
    const sealed = [stay('home', 1_000, 5_000)];
    const live = [stay('home', 1_000, 12_000, true)];
    const tail = filterLiveTailEntries(live, 5_000);
    const trimmed = trimSealedAtBoundary(sealed, tail);
    expect(trimmed).toHaveLength(0);
    const merged = mergeSealedAndLiveTimeline(sealed, live, 5_000);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.kind).toBe('stay');
  });
});

describe('tailGpsStartMs', () => {
  it('never starts before day start', () => {
    expect(tailGpsStartMs(10_000, 0)).toBe(0);
  });
});
