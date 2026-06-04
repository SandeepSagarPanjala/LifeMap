import {detectTrips} from '../src/lib/trip-detection';
import {buildTripDetectionConfig} from '../src/lib/trip-settings';
import type {LocationPointRow} from '../src/db/repositories/location-days';

const config = buildTripDetectionConfig(10, 10, 150);

function makePoints(
  specs: Array<{minutes: number; lat: number; lng: number}>,
): LocationPointRow[] {
  const start = new Date('2026-06-03T08:00:00');
  return specs.map((spec, index) => ({
    id: index + 1,
    timestamp: new Date(start.getTime() + spec.minutes * 60_000),
    lat: spec.lat,
    lng: spec.lng,
    accuracy: 10,
    altitude: null,
    speed: null,
    source: 'gps',
  }));
}

describe('detectTrips', () => {
  it('splits when gap is longer than 10 minutes', () => {
    const trips = detectTrips(
      makePoints([
        {minutes: 0, lat: 33.21, lng: -97.13},
        {minutes: 5, lat: 33.22, lng: -97.12},
        {minutes: 16, lat: 33.23, lng: -97.11},
      ]),
      config,
    );

    expect(trips).toHaveLength(2);
    expect(trips[0]?.kind).toBe('travel');
    expect(trips[1]?.kind).toBe('travel');
  });

  it('creates stay + travel legs for a long stop', () => {
    const trips = detectTrips(
      makePoints([
        {minutes: 0, lat: 33.21, lng: -97.13},
        {minutes: 5, lat: 33.215, lng: -97.125},
        {minutes: 15, lat: 33.22, lng: -97.12},
        {minutes: 25, lat: 33.22, lng: -97.12},
        {minutes: 35, lat: 33.23, lng: -97.11},
      ]),
      config,
    );

    expect(trips.some(t => t.kind === 'stay')).toBe(true);
    expect(trips.some(t => t.kind === 'travel')).toBe(true);
    expect(trips.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps a short stop as one travel trip', () => {
    const trips = detectTrips(
      makePoints([
        {minutes: 0, lat: 33.21, lng: -97.13},
        {minutes: 5, lat: 33.22, lng: -97.12},
        {minutes: 8, lat: 33.22, lng: -97.12},
        {minutes: 12, lat: 33.23, lng: -97.11},
      ]),
      config,
    );

    expect(trips).toHaveLength(1);
    expect(trips[0]?.kind).toBe('travel');
  });
});
