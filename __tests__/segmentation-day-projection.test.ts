import {
  projectSegmentsForDay,
  type MissingSegment,
  type StaySegment,
} from '../src/lib/segmentation/trips';
import {
  dateKeyForTimestamp,
  dayEndExclusive,
  dayStart,
} from '../src/lib/segmentation/day-bounds';
import type { ParsedPoint, SavedPlaceRow } from '../src/lib/segmentation/types';

function parsedPoint(id: number, iso: string): ParsedPoint {
  const at = new Date(iso);
  return {
    id,
    timestamp: at,
    lat: 33.25,
    lng: -97.15,
    accuracy: 10,
    altitude: null,
    speed: null,
    source: 'gps',
    at,
    dateKey: dateKeyForTimestamp(at),
  };
}

function homeStaySegment(points: ParsedPoint[]): StaySegment {
  const startAt = points[0]!.at;
  const endAt = points[points.length - 1]!.at;
  return {
    kind: 'stay',
    id: `stay-${startAt.getTime()}`,
    order: 1,
    startAt,
    endAt,
    durationMs: endAt.getTime() - startAt.getTime(),
    points,
    placeLabel: 'Home',
    placeId: 1,
    placeKind: 'saved',
    stop: {
      id: 'stop-home',
      lat: 33.25,
      lng: -97.15,
      arrivedAt: startAt,
      leftAt: endAt,
      durationMs: endAt.getTime() - startAt.getTime(),
      pointCount: points.length,
      spreadM: 40,
      pointIds: points.map(point => point.id),
    },
  };
}

const savedPlaces: SavedPlaceRow[] = [
  {
    id: 1,
    kind: 'home',
    label: 'Home',
    lat: 33.25,
    lng: -97.15,
    radiusMeters: 150,
    addressLine: null,
    active: true,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
  },
];

describe('projectSegmentsForDay', () => {
  it('shows a full middle day for multi-day home stays', () => {
    const stay = homeStaySegment([
      parsedPoint(1, '2026-06-16T10:00:00.000Z'),
      parsedPoint(2, '2026-06-17T18:00:00.000Z'),
      parsedPoint(3, '2026-06-18T22:00:00.000Z'),
    ]);

    const jun16 = projectSegmentsForDay([stay], '2026-06-16', savedPlaces);
    const jun17 = projectSegmentsForDay([stay], '2026-06-17', savedPlaces);
    const jun18 = projectSegmentsForDay([stay], '2026-06-18', savedPlaces);

    expect(jun16).toHaveLength(1);
    expect(jun17).toHaveLength(1);
    expect(jun18).toHaveLength(1);

    expect(jun17[0]?.kind).toBe('stay');
    if (jun17[0]?.kind === 'stay') {
      expect(jun17[0].placeLabel).toBe('Home');
      expect(jun17[0].startAt).toEqual(dayStart('2026-06-17'));
      expect(jun17[0].endAt).toEqual(dayEndExclusive('2026-06-17'));
      expect(jun17[0].points).toHaveLength(1);
      expect(jun17[0].points[0]?.id).toBe(2);
    }
  });

  it('splits overnight missing at local midnight on each day', () => {
    const missing: MissingSegment = {
      kind: 'missing',
      id: 'missing-home-work',
      order: 1,
      startAt: new Date('2026-07-08T04:11:58.000Z'), // Jul 7 11:11 PM CDT
      endAt: new Date('2026-07-08T15:22:22.000Z'), // Jul 8 10:22 AM CDT
      durationMs:
        Date.parse('2026-07-08T15:22:22.000Z') -
        Date.parse('2026-07-08T04:11:58.000Z'),
      distanceM: 43_500,
      fromKind: 'stay',
      toKind: 'stay',
      fromLat: 33.25,
      fromLng: -97.15,
      toLat: 32.9,
      toLng: -96.95,
      points: [],
    };

    const jul7 = projectSegmentsForDay([missing], '2026-07-07');
    const jul8 = projectSegmentsForDay([missing], '2026-07-08');

    expect(jul7).toHaveLength(1);
    expect(jul8).toHaveLength(1);
    expect(jul7[0]?.kind).toBe('missing');
    expect(jul8[0]?.kind).toBe('missing');
    if (jul7[0]?.kind === 'missing' && jul8[0]?.kind === 'missing') {
      expect(jul7[0].startAt).toEqual(missing.startAt);
      expect(jul7[0].endAt).toEqual(dayEndExclusive('2026-07-07'));
      expect(jul8[0].startAt).toEqual(dayStart('2026-07-08'));
      expect(jul8[0].endAt).toEqual(missing.endAt);
      // Full overnight span must not appear as one block on either day.
      expect(jul7[0].durationMs).toBeLessThan(missing.durationMs);
      expect(jul8[0].durationMs).toBeLessThan(missing.durationMs);
    }
  });
});
