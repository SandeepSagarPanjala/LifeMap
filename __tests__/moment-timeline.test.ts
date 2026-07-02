import {
  attachMomentsToTimeline,
  findContainingTimelineEntry,
  resolveMomentCoordinate,
} from '../src/lib/moments/moment-timeline';
import type {DayTimelineEntry} from '../src/lib/trip-detection';

describe('moment timeline', () => {
  const now = new Date('2026-06-08T16:00:00.000Z');

  const stay: DayTimelineEntry = {
    id: 'stay-1',
    kind: 'stay',
    points: [],
    startAt: new Date('2026-06-08T13:00:00.000Z'),
    endAt: new Date('2026-06-08T16:00:00.000Z'),
    distanceKm: 0,
    durationMs: 3 * 60 * 60_000,
    openThroughNow: true,
  };

  const travel: DayTimelineEntry = {
    id: 'travel-1',
    kind: 'travel',
    points: [],
    startAt: new Date('2026-06-08T11:00:00.000Z'),
    endAt: new Date('2026-06-08T12:00:00.000Z'),
    distanceKm: 5,
    durationMs: 60 * 60_000,
  };

  it('places a moment inside an open visit by open timestamp', () => {
    const momentAt = new Date('2026-06-08T15:00:00.000Z');
    expect(findContainingTimelineEntry(momentAt, [travel, stay], now)).toBe(stay);
  });

  it('prefers stay over travel when both could match', () => {
    const overlappingStay: DayTimelineEntry = {
      ...stay,
      startAt: new Date('2026-06-08T11:30:00.000Z'),
    };
    const momentAt = new Date('2026-06-08T11:45:00.000Z');
    expect(
      findContainingTimelineEntry(momentAt, [travel, overlappingStay], now),
    ).toBe(overlappingStay);
  });

  it('returns null when no timeline entry contains the moment', () => {
    const momentAt = new Date('2026-06-08T09:00:00.000Z');
    expect(findContainingTimelineEntry(momentAt, [travel, stay], now)).toBeNull();
  });

  it('attaches moments to timeline entries in timestamp order', () => {
    const attachments = attachMomentsToTimeline(
      [
        {
          id: 2,
          type: 'voice',
          timestamp: new Date('2026-06-08T15:30:00.000Z'),
        },
        {
          id: 1,
          type: 'photo',
          timestamp: new Date('2026-06-08T14:00:00.000Z'),
        },
      ],
      [stay],
      now,
    );

    expect(attachments.map(item => item.moment.id)).toEqual([1, 2]);
    expect(attachments.every(item => item.entry === stay)).toBe(true);
  });

  it('interpolates map coordinates from the GPS trail at moment time', () => {
    const points = [
      {
        id: 1,
        timestamp: new Date('2026-06-08T12:00:00.000Z'),
        lat: 33,
        lng: -97,
        accuracy: null,
        altitude: null,
        speed: null,
        source: 'gps',
      },
      {
        id: 2,
        timestamp: new Date('2026-06-08T13:00:00.000Z'),
        lat: 34,
        lng: -96,
        accuracy: null,
        altitude: null,
        speed: null,
        source: 'gps',
      },
    ];
    const coordinate = resolveMomentCoordinate(
      new Date('2026-06-08T12:30:00.000Z'),
      points,
      null,
    );

    expect(coordinate).toEqual({lat: 33.5, lng: -96.5});
  });

  it('reuses sorted GPS trail cache across coordinate lookups', () => {
    const points = Array.from({length: 500}, (_, index) => ({
      id: index + 1,
      timestamp: new Date(Date.UTC(2026, 5, 8, 0, 0, index)),
      lat: 33 + index * 0.001,
      lng: -97 + index * 0.001,
      accuracy: null,
      altitude: null,
      speed: null,
      source: 'gps' as const,
    }));

    const target = new Date(Date.UTC(2026, 5, 8, 0, 4, 10));
    const first = resolveMomentCoordinate(target, points, null);
    const second = resolveMomentCoordinate(target, points, null);

    expect(first).toEqual(second);
    expect(first).not.toBeNull();
  });

  it('uses nearest stay GPS point at moment time when day trail is empty', () => {
    const stayWithPoints: DayTimelineEntry = {
      ...stay,
      anchorLat: 33.5,
      anchorLng: -97.5,
      points: [
        {
          id: 1,
          timestamp: new Date('2026-06-08T14:00:00.000Z'),
          lat: 33.1,
          lng: -97.1,
          accuracy: null,
          altitude: null,
          speed: null,
          source: 'gps',
        },
        {
          id: 2,
          timestamp: new Date('2026-06-08T15:30:00.000Z'),
          lat: 33.2,
          lng: -97.2,
          accuracy: null,
          altitude: null,
          speed: null,
          source: 'gps',
        },
      ],
    };

    expect(
      resolveMomentCoordinate(
        new Date('2026-06-08T14:10:00.000Z'),
        [],
        stayWithPoints,
      ),
    ).toEqual({lat: 33.1, lng: -97.1});
  });

  it('falls back to stay anchor when stay has no GPS points', () => {
    const anchoredStay: DayTimelineEntry = {
      ...stay,
      anchorLat: 33.5,
      anchorLng: -97.5,
      points: [],
    };

    expect(
      resolveMomentCoordinate(
        new Date('2026-06-08T15:00:00.000Z'),
        [],
        anchoredStay,
      ),
    ).toEqual({lat: 33.5, lng: -97.5});
  });
});
