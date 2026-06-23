import {
  canExtendOpenStayWithNewPoints,
  openStayEventKey,
} from '@/lib/today-sync';
import {buildTripDetectionConfig} from '@/lib/trip-settings';
import type {TripRow} from '@/db/repositories/trips';
import {makeTripRow} from './helpers/trip-row-fixture';

const config = buildTripDetectionConfig(10, 10, 150);

function stayTrip(overrides: Partial<TripRow> = {}): TripRow {
  const startAt = new Date('2026-06-22T08:00:00');
  const endAt = new Date('2026-06-22T20:00:00');
  return makeTripRow({
    id: 1,
    eventKey: 'stay:open',
    kind: 'stay',
    startAt,
    endAt,
    centroidLat: 33.21,
    centroidLng: -97.13,
    ...overrides,
  });
}

describe('openStayEventKey', () => {
  it('is stable for the same start time', () => {
    const startAt = new Date('2026-06-22T08:00:00');
    expect(openStayEventKey(startAt)).toBe(`stay:${startAt.getTime()}:open`);
  });
});

describe('canExtendOpenStayWithNewPoints', () => {
  it('allows clock-only extend when there are no new points', () => {
    expect(canExtendOpenStayWithNewPoints(stayTrip(), [], config)).toBe(true);
  });

  it('allows new points within dwell radius of the stay centroid', () => {
    expect(
      canExtendOpenStayWithNewPoints(stayTrip(), [
        {
          id: 1,
          timestamp: new Date('2026-06-22T20:00:00'),
          lat: 33.21001,
          lng: -97.13001,
          accuracy: 10,
          altitude: null,
          speed: null,
          source: 'gps',
        },
      ], config),
    ).toBe(true);
  });

  it('rejects new points outside dwell radius', () => {
    expect(
      canExtendOpenStayWithNewPoints(stayTrip(), [
        {
          id: 1,
          timestamp: new Date('2026-06-22T20:00:00'),
          lat: 33.25,
          lng: -97.13,
          accuracy: 10,
          altitude: null,
          speed: null,
          source: 'gps',
        },
      ], config),
    ).toBe(false);
  });

  it('rejects when the last trip is not a stay', () => {
    expect(
      canExtendOpenStayWithNewPoints(
        stayTrip({kind: 'travel'}),
        [],
        config,
      ),
    ).toBe(false);
  });
});
