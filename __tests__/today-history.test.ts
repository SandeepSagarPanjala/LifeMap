import {
  prepareDayHistoryTimeline,
  prepareTodayHistoryTimeline,
} from '../src/lib/today-history';
import {buildTripDetectionConfig} from '../src/lib/trip-settings';
import type {LocationPointRow} from '../src/db/repositories/location-days';

const config = buildTripDetectionConfig(10, 10, 25);
const home = {lat: 33.25045, lng: -97.15306};

function row(
  iso: string,
  id: number,
  coords = home,
): LocationPointRow {
  return {
    id,
    timestamp: new Date(iso),
    lat: coords.lat,
    lng: coords.lng,
    accuracy: 10,
    altitude: null,
    speed: null,
    source: 'gps',
  };
}

describe('prepareTodayHistoryTimeline', () => {
  const dayStart = new Date('2026-06-04T05:00:00.000Z'); // Jun 4 12 AM CDT
  const now = new Date('2026-06-04T08:42:00.000Z'); // 3:42 AM CDT

  it('extends open visit to now and from midnight when still home overnight', () => {
    const lookback = [row('2026-06-04T04:12:00.000Z', 1)]; // 11:12 PM Jun 3 CDT
    const today = [row('2026-06-04T06:36:29.000Z', 3)]; // 1:36 AM CDT

    const entries = prepareTodayHistoryTimeline(
      today,
      lookback,
      dayStart,
      now,
      config,
    );
    const stay = entries.find(e => e.kind === 'stay');
    expect(stay?.kind).toBe('stay');
    if (stay?.kind === 'stay') {
      expect(stay.startAt).toEqual(dayStart);
      expect(stay.endAt).toEqual(now);
      expect(stay.openThroughNow).toBe(true);
      expect(stay.durationMs).toBe(now.getTime() - dayStart.getTime());
    }
  });

  it('extends last stay through end of day on a past day with no later saves', () => {
    const dayKey = '2026-06-03';
    const dayStart = new Date('2026-06-03T05:00:00.000Z');
    const lastPing = new Date('2026-06-04T04:12:13.000Z');
    const now = new Date('2026-06-04T12:00:00.000Z');
    const dayPoints = [
      row('2026-06-03T23:49:00.000Z', 1),
      row(lastPing.toISOString(), 2),
    ];

    const entries = prepareDayHistoryTimeline(
      dayKey,
      dayPoints,
      [],
      config,
      now,
    );
    const stay = entries[entries.length - 1];
    expect(stay?.kind).toBe('stay');
    if (stay?.kind === 'stay') {
      expect(stay.openThroughNow).toBeFalsy();
      expect(stay.endAt.getTime()).toBeGreaterThan(lastPing.getTime());
      expect(stay.endAt.getTime()).toBe(
        new Date('2026-06-04T04:59:59.999Z').getTime(),
      );
    }
  });

  it('extends last stay through now when no saves after last ping', () => {
    const today = [
      row('2026-06-04T06:36:29.000Z', 1),
      row('2026-06-04T08:11:12.000Z', 2),
    ];

    const entries = prepareTodayHistoryTimeline(
      today,
      [],
      dayStart,
      now,
      config,
    );
    const stay = entries.find(e => e.kind === 'stay');
    expect(stay?.kind).toBe('stay');
    if (stay?.kind === 'stay') {
      expect(stay.endAt).toEqual(now);
      expect(stay.openThroughNow).toBe(true);
    }
  });
});
