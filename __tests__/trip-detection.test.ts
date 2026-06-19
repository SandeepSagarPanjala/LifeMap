import {
  dedupeLocationPoints,
  getTravelDisplayPoints,
  isSparseTravelRoute,
  stayTripCentroid,
  stayTripMarkerCoordinate,
  findNextPlayableTimelineIndex,
  findPrevPlayableTimelineIndex,
  firstPlayableTimelineIndex,
  lastPlayableTimelineIndex,
} from '../src/lib/trip-detection';
import {buildTripDetectionConfig} from '../src/lib/trip-settings';
import type {LocationPointRow, DetectedTrip} from '../src/lib/trip-detection';

const config = buildTripDetectionConfig(10, 10, 150);

const HOME = {lat: 33.21, lng: -97.13};

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

describe('trip-detection helpers', () => {
  it('dedupes same timestamp and place', () => {
    const base = makePoints([{minutes: 0, ...HOME}]);
    const dupes: LocationPointRow[] = [
      {...base[0]!, id: 1},
      {...base[0]!, id: 2, source: 'motion'},
      {...base[0]!, id: 3},
    ];
    expect(dedupeLocationPoints(dupes)).toHaveLength(1);
  });

  it('uses visit centroid for map pin when not ongoing', () => {
    const stay: DetectedTrip = {
      id: 'stay-1',
      kind: 'stay',
      points: makePoints([
        {minutes: 0, lat: 33.21, lng: -97.13},
        {minutes: 15, lat: 33.21005, lng: -97.13005},
      ]),
      startAt: new Date('2026-06-03T08:00:00'),
      endAt: new Date('2026-06-03T08:15:00'),
      distanceKm: 0,
      durationMs: 15 * 60_000,
    };
    const pin = stayTripMarkerCoordinate(stay, {ongoing: false});
    const centroid = stayTripCentroid(stay);
    expect(pin.latitude).toBe(centroid.latitude);
    expect(pin.longitude).toBe(centroid.longitude);
  });

  it('bridges drive start to visit pin when prior stay row ends on departure road GPS', () => {
    const library = {
      id: 1,
      timestamp: new Date('2026-06-06T21:25:00.000Z'),
      lat: 33.05582,
      lng: -96.83425,
      accuracy: 10,
      altitude: null,
      speed: 0,
      source: 'gps' as const,
    };
    const road = {
      id: 2,
      timestamp: new Date('2026-06-06T21:34:10.000Z'),
      lat: 33.05809,
      lng: -96.83283,
      accuracy: 10,
      altitude: null,
      speed: 14,
      source: 'gps' as const,
    };
    const previousStay: DetectedTrip = {
      id: 'stay-library',
      kind: 'stay',
      points: [library, road],
      startAt: new Date('2026-06-06T20:13:00.000Z'),
      endAt: road.timestamp,
      distanceKm: 0,
      durationMs: 1,
    };
    const travel: DetectedTrip = {
      id: 'travel-tesla',
      kind: 'travel',
      points: [road, {...road, id: 3, lat: 33.05928, lng: -96.83279}],
      startAt: road.timestamp,
      endAt: new Date('2026-06-06T21:39:00.000Z'),
      distanceKm: 1,
      durationMs: 1,
    };

    const route = getTravelDisplayPoints(travel, previousStay, [], config);
    expect(route[0]?.lat).toBeCloseTo(library.lat, 3);
    expect(route[0]?.lat).not.toBeCloseTo(road.lat, 3);
  });

  it('treats collinear few-point long routes as sparse', () => {
    const base = new Date('2026-06-13T05:43:00.000Z');
    const points = [
      {
        id: 1,
        timestamp: base,
        lat: 33.15,
        lng: -96.82,
        accuracy: 10,
        altitude: null,
        speed: 15,
        source: 'gps' as const,
      },
      {
        id: 2,
        timestamp: new Date(base.getTime() + 20 * 60_000),
        lat: 33.2,
        lng: -97.0,
        accuracy: 10,
        altitude: null,
        speed: 15,
        source: 'gps' as const,
      },
      {
        id: 3,
        timestamp: new Date(base.getTime() + 46 * 60_000),
        lat: 33.25,
        lng: -97.15,
        accuracy: 10,
        altitude: null,
        speed: 0,
        source: 'gps' as const,
      },
    ];
    expect(isSparseTravelRoute(points)).toBe(true);
  });
});

describe('playable timeline navigation', () => {
  const stay = {
    id: 'stay-1',
    kind: 'stay' as const,
    points: [],
    startAt: new Date('2026-06-08T08:00:00'),
    endAt: new Date('2026-06-08T09:00:00'),
    distanceKm: 0,
    durationMs: 3_600_000,
  };
  const gap = {
    kind: 'gap' as const,
    startAt: new Date('2026-06-08T09:00:00'),
    endAt: new Date('2026-06-08T10:00:00'),
    durationMs: 3_600_000,
    distanceKm: 0,
  };
  const travel = {
    id: 'travel-1',
    kind: 'travel' as const,
    points: [],
    startAt: new Date('2026-06-08T10:00:00'),
    endAt: new Date('2026-06-08T11:00:00'),
    distanceKm: 5,
    durationMs: 3_600_000,
  };
  const entries = [stay, gap, travel];

  it('skips gaps when moving to the next playable entry', () => {
    expect(firstPlayableTimelineIndex(entries)).toBe(0);
    expect(lastPlayableTimelineIndex(entries)).toBe(2);
    expect(findNextPlayableTimelineIndex(entries, 0)).toBe(2);
    expect(findNextPlayableTimelineIndex(entries, 1)).toBe(2);
    expect(findNextPlayableTimelineIndex(entries, 2)).toBe(-1);
  });

  it('skips gaps when moving to the previous playable entry', () => {
    expect(findPrevPlayableTimelineIndex(entries, 2)).toBe(0);
    expect(findPrevPlayableTimelineIndex(entries, 1)).toBe(0);
    expect(findPrevPlayableTimelineIndex(entries, 0)).toBe(-1);
  });
});
