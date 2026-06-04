import {buildDrawableRouteSegments} from '../src/lib/route-segments';
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

describe('buildDrawableRouteSegments', () => {
  it('does not connect same-place points separated by a long gap', () => {
    const segments = buildDrawableRouteSegments(
      makePoints([
        {minutes: 0, lat: 33.21, lng: -97.13},
        {minutes: 45, lat: 33.21001, lng: -97.13001},
        {minutes: 50, lat: 33.2103, lng: -97.1303},
        {minutes: 52, lat: 33.22, lng: -97.12},
        {minutes: 54, lat: 33.23, lng: -97.11},
      ]),
      config,
    );

    for (const segment of segments) {
      const hasMorning = segment.some(coord => Math.abs(coord.latitude - 33.21) < 0.0001);
      const hasAfternoonPing = segment.some(
        coord => Math.abs(coord.latitude - 33.21001) < 0.0001,
      );
      expect(hasMorning && hasAfternoonPing).toBe(false);
    }

    expect(segments.some(segment => segment.length >= 2)).toBe(true);
  });

  it('connects moving points along a drive', () => {
    const segments = buildDrawableRouteSegments(
      makePoints([
        {minutes: 0, lat: 33.21, lng: -97.13},
        {minutes: 2, lat: 33.22, lng: -97.12},
        {minutes: 4, lat: 33.23, lng: -97.11},
      ]),
      config,
    );

    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(3);
  });
});
