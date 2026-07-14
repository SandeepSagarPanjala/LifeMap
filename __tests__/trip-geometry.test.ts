import type { LocationPointRow } from '@/db/repositories/location-days';
import { bearingDegrees } from '@/lib/location-geo';
import { geographicMedoid, resolveVisitAnchor } from '@/lib/visit-anchor';

function point(lat: number, lng: number, timestampMs = 0): LocationPointRow {
  return {
    id: timestampMs,
    timestamp: new Date(timestampMs),
    lat,
    lng,
    accuracy: 10,
    altitude: null,
    speed: null,
    source: 'gps',
    heading: null,
    headingAccuracy: null,
    speedAccuracy: null,
    altitudeAccuracy: null,
    activityType: null,
    activityConfidence: null,
    isMoving: null,
    isMock: null,
    uuid: null,
    batteryLevel: null,
    batteryIsCharging: null,
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
          addressLine: null,
          active: true,
          createdAt: new Date(),
        },
      ],
    );
    expect(anchor.lat).toBe(33.214);
    expect(anchor.lng).toBe(-97.132);
  });
});

describe('bearingDegrees', () => {
  it('faces north along a northbound segment', () => {
    expect(
      bearingDegrees({ lat: 33.0, lng: -97.0 }, { lat: 33.01, lng: -97.0 }),
    ).toBeCloseTo(0, 0);
  });
});

describe('buildDrawableRouteSegments', () => {
  it('keeps stored trip routes as one polyline despite synthetic timestamps', () => {
    const { buildDrawableRouteSegments } = require('@/lib/route-segments');
    const { HISTORY_SAME_PLACE_RADIUS_METERS } = require('@/lib/app-constants');
    const { buildTripDetectionConfig } = require('@/lib/trip-settings');
    const config = buildTripDetectionConfig(
      10,
      5,
      HISTORY_SAME_PLACE_RADIUS_METERS,
    );

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
        heading: null,
        headingAccuracy: null,
        speedAccuracy: null,
        altitudeAccuracy: null,
        activityType: null,
        activityConfidence: null,
        isMoving: null,
        isMock: null,
        uuid: null,
        batteryLevel: null,
        batteryIsCharging: null,
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
        heading: null,
        headingAccuracy: null,
        speedAccuracy: null,
        altitudeAccuracy: null,
        activityType: null,
        activityConfidence: null,
        isMoving: null,
        isMock: null,
        uuid: null,
        batteryLevel: null,
        batteryIsCharging: null,
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
        heading: null,
        headingAccuracy: null,
        speedAccuracy: null,
        altitudeAccuracy: null,
        activityType: null,
        activityConfidence: null,
        isMoving: null,
        isMock: null,
        uuid: null,
        batteryLevel: null,
        batteryIsCharging: null,
      },
    ];

    const segments = buildDrawableRouteSegments(storedRoute, config);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(3);
  });
});
