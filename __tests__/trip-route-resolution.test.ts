import type { LocationPointRow } from '@/db/repositories/location-days';
import type { DetectedTrip } from '@/lib/trip-detection';
import {
  hydrateTravelRoutesFromDayPoints,
  isRawGpsDayPoints,
  resolveRoutePointsForPlayableTrip,
} from '@/lib/timeline-from-trips';

function gpsPoint(
  id: number,
  lat: number,
  lng: number,
  timestampMs: number,
): LocationPointRow {
  return {
    id,
    timestamp: new Date(timestampMs),
    lat,
    lng,
    accuracy: 10,
    altitude: null,
    speed: 5,
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

function sparseStoredTravel(startMs: number, endMs: number): DetectedTrip {
  return {
    id: 'materialized-1',
    kind: 'travel',
    materializedTripId: 1,
    startAt: new Date(startMs),
    endAt: new Date(endMs),
    durationMs: endMs - startMs,
    distanceKm: 5,
    points: [
      {
        id: -1,
        timestamp: new Date(startMs),
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
        timestamp: new Date(endMs),
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
    ],
  };
}

describe('trip route resolution', () => {
  it('detects raw GPS day points', () => {
    expect(isRawGpsDayPoints([gpsPoint(1, 33, -97, 0)])).toBe(true);
    expect(
      isRawGpsDayPoints([
        {
          id: -1,
          timestamp: new Date(),
          lat: 33,
          lng: -97,
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
      ]),
    ).toBe(false);
  });

  it('prefers raw GPS over sparse stored trip routes', () => {
    const startMs = 0;
    const endMs = 600_000;
    const travel = sparseStoredTravel(startMs, endMs);
    const dayPoints = [
      gpsPoint(1, 33.2, -97.1, startMs + 10_000),
      gpsPoint(2, 33.21, -97.09, startMs + 120_000),
      gpsPoint(3, 33.22, -97.08, startMs + 240_000),
      gpsPoint(4, 33.23, -97.07, startMs + 360_000),
      gpsPoint(5, 33.24, -97.06, startMs + 480_000),
      gpsPoint(6, 33.25, -97.0, endMs - 10_000),
    ];

    const resolved = resolveRoutePointsForPlayableTrip(
      travel,
      [travel],
      dayPoints,
    );

    expect(resolved).toHaveLength(6);
    expect(resolved.every(point => point.source === 'gps')).toBe(true);
  });

  it('hydrates travel entries for map display', () => {
    const startMs = 0;
    const endMs = 600_000;
    const travel = sparseStoredTravel(startMs, endMs);
    const dayPoints = [
      gpsPoint(1, 33.2, -97.1, startMs + 10_000),
      gpsPoint(2, 33.21, -97.09, startMs + 120_000),
      gpsPoint(3, 33.25, -97.0, endMs - 10_000),
    ];

    const hydrated = hydrateTravelRoutesFromDayPoints([travel], dayPoints);
    expect(hydrated[0]?.kind).toBe('travel');
    if (hydrated[0]?.kind === 'travel') {
      expect(hydrated[0].points).toHaveLength(3);
    }
  });
});
