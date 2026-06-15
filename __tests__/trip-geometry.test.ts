import type {LocationPointRow} from '@/db/repositories/location-days';
import {bearingDegrees} from '@/lib/location-geo';
import {
  pointToSegmentDistanceMeters,
  simplifyDriveRoute,
} from '@/lib/trip-route-simplify';
import {geographicMedoid, resolveVisitAnchor} from '@/lib/visit-anchor';

function point(
  lat: number,
  lng: number,
  timestampMs = 0,
): LocationPointRow {
  return {
    id: timestampMs,
    timestamp: new Date(timestampMs),
    lat,
    lng,
    accuracy: 10,
    altitude: null,
    speed: null,
    source: 'gps',
  };
}

describe('geographicMedoid', () => {
  it('picks the point closest to all others in a scatter', () => {
    const points = [
      point(33.0, -97.0),
      point(33.001, -97.001),
      point(33.002, -97.0),
      point(33.05, -97.05),
    ];
    const medoid = geographicMedoid(points);
    expect(medoid.lat).toBeCloseTo(33.001, 3);
    expect(medoid.lng).toBeCloseTo(-97.001, 3);
  });
});

describe('resolveVisitAnchor', () => {
  it('uses saved place coordinates when the cluster matches home', () => {
    const anchor = resolveVisitAnchor(
      [
        point(33.214, -97.132),
        point(33.2142, -97.1321),
        point(33.2139, -97.1318),
      ],
      [
        {
          id: 1,
          kind: 'home',
          label: 'Home',
          lat: 33.214,
          lng: -97.132,
          radiusMeters: 150,
          createdAt: new Date(),
        },
      ],
    );
    expect(anchor.lat).toBe(33.214);
    expect(anchor.lng).toBe(-97.132);
  });
});

describe('simplifyDriveRoute', () => {
  it('keeps a corner when bearing changes sharply', () => {
    const straightNorth = [
      point(33.0, -97.0, 0),
      point(33.001, -97.0, 1),
      point(33.002, -97.0, 2),
    ];
    const withRightTurn = [
      point(33.0, -97.0, 0),
      point(33.001, -97.0, 1),
      point(33.0015, -97.0, 2),
      point(33.0015, -96.999, 3),
      point(33.0015, -96.998, 4),
    ];

    expect(simplifyDriveRoute(straightNorth)).toHaveLength(2);
    const simplifiedTurn = simplifyDriveRoute(withRightTurn);
    expect(simplifiedTurn.length).toBeGreaterThan(2);
    expect(
      simplifiedTurn.some(
        candidate =>
          candidate.lat === withRightTurn[2]!.lat &&
          candidate.lng === withRightTurn[2]!.lng,
      ),
    ).toBe(true);
  });

  it('drops dense collinear points', () => {
    const dense: LocationPointRow[] = [];
    for (let i = 0; i < 20; i += 1) {
      dense.push(point(33.0 + i * 0.00005, -97.0, i));
    }
    const simplified = simplifyDriveRoute(dense);
    expect(simplified.length).toBeLessThan(dense.length);
    expect(simplified[0]).toEqual({lat: dense[0]!.lat, lng: dense[0]!.lng});
    expect(simplified[simplified.length - 1]).toEqual({
      lat: dense[dense.length - 1]!.lat,
      lng: dense[dense.length - 1]!.lng,
    });
  });
});

describe('pointToSegmentDistanceMeters', () => {
  it('returns ~0 for a point on the segment', () => {
    const distance = pointToSegmentDistanceMeters(
      {lat: 33.0, lng: -97.0},
      {lat: 33.0, lng: -97.0},
      {lat: 33.01, lng: -97.0},
    );
    expect(distance).toBeLessThan(1);
  });
});

describe('bearingDegrees', () => {
  it('faces north along a northbound segment', () => {
    expect(
      bearingDegrees({lat: 33.0, lng: -97.0}, {lat: 33.01, lng: -97.0}),
    ).toBeCloseTo(0, 0);
  });
});

describe('buildDrawableRouteSegments', () => {
  it('keeps stored trip routes as one polyline despite synthetic timestamps', () => {
    const {buildDrawableRouteSegments} = require('@/lib/route-segments');
    const {buildTripDetectionConfig, HISTORY_SAME_PLACE_RADIUS_METERS} =
      require('@/lib/trip-settings');
    const config = buildTripDetectionConfig(10, 5, HISTORY_SAME_PLACE_RADIUS_METERS);

    const storedRoute: LocationPointRow[] = [
      {
        id: -1,
        timestamp: new Date(0),
        lat: 33.2,
        lng: -97.1,
        accuracy: null,
        altitude: null,
        speed: null,
        source: 'route',
      },
      {
        id: -2,
        timestamp: new Date(3_600_000),
        lat: 33.25,
        lng: -97.05,
        accuracy: null,
        altitude: null,
        speed: null,
        source: 'route',
      },
      {
        id: -3,
        timestamp: new Date(7_200_000),
        lat: 33.25,
        lng: -97.0,
        accuracy: null,
        altitude: null,
        speed: null,
        source: 'route',
      },
    ];

    const segments = buildDrawableRouteSegments(storedRoute, config);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(3);
  });
});
