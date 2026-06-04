import {buildStayMapCircles} from '../src/lib/stay-map';
import type {DetectedTrip} from '../src/lib/trip-detection';

function stay(
  id: string,
  lat: number,
  lng: number,
): DetectedTrip {
  const timestamp = new Date('2026-06-04T09:00:00.000Z');
  return {
    id,
    kind: 'stay',
    points: [
      {
        id: 1,
        timestamp,
        lat,
        lng,
        accuracy: 10,
        altitude: null,
        speed: null,
        source: 'gps',
      },
    ],
    startAt: timestamp,
    endAt: timestamp,
    distanceKm: 0,
    durationMs: 0,
  };
}

describe('buildStayMapCircles', () => {
  it('places a circle at the stay centroid with dwell radius', () => {
    const circles = buildStayMapCircles([stay('a', 33.23, -97.16)], 150);
    expect(circles).toHaveLength(1);
    expect(circles[0]?.radiusMeters).toBe(150);
    expect(circles[0]?.center.latitude).toBe(33.23);
    expect(circles[0]?.center.longitude).toBe(-97.16);
  });
});
