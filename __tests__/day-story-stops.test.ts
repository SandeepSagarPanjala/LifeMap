import {
  buildDayStoryStops,
  formatDayStoryVisitNumbers,
  isCoordinateOnDayStoryStop,
} from '../src/lib/day-story-stops';
import type { DetectedTrip } from '../src/lib/trip-detection';
import type { SavedPlaceRow } from '../src/db/repositories/saved-places';

function stay(
  id: string,
  startIso: string,
  lat: number,
  lng: number,
  extras: Partial<DetectedTrip> = {},
): DetectedTrip {
  const startAt = new Date(startIso);
  return {
    id,
    kind: 'stay',
    points: [
      {
        id: 1,
        timestamp: startAt,
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
      },
    ],
    startAt,
    endAt: new Date(startAt.getTime() + 60_000),
    distanceKm: 0,
    durationMs: 60_000,
    anchorLat: lat,
    anchorLng: lng,
    ...extras,
  };
}

const home: SavedPlaceRow = {
  id: 1,
  kind: 'home',
  label: 'Home',
  lat: 33.23,
  lng: -97.16,
  radiusMeters: 150,
  addressLine: null,
  active: true,
  createdAt: new Date(),
};

describe('buildDayStoryStops', () => {
  it('numbers stays chronologically and labels addresses', () => {
    const stops = buildDayStoryStops([
      stay('a', '2026-07-10T13:00:00.000Z', 33.2, -97.1, {
        placeKind: 'cache',
        placeLabel: '3925 N Elm St',
      }),
      stay('b', '2026-07-10T15:00:00.000Z', 33.25, -97.14, {
        placeKind: 'cache',
        poiId: 9,
        poiLabel: 'Walmart',
      }),
    ]);
    expect(stops).toHaveLength(2);
    expect(stops[0]?.visitNumbers).toEqual([1]);
    expect(stops[0]?.label).toBe('3925 N Elm St');
    expect(stops[1]?.visitNumbers).toEqual([2]);
    expect(stops[1]?.label).toBe('Walmart');
  });

  it('groups Home revisits into one stop with multiple numbers', () => {
    const stops = buildDayStoryStops(
      [
        stay('h1', '2026-07-10T08:00:00.000Z', 33.23, -97.16, {
          placeKind: 'saved',
          placeId: 1,
          placeLabel: 'Home',
        }),
        stay('w', '2026-07-10T10:00:00.000Z', 33.25, -97.14, {
          placeKind: 'cache',
          poiId: 2,
          poiLabel: 'Walmart',
        }),
        stay('h2', '2026-07-10T12:00:00.000Z', 33.2301, -97.1601, {
          placeKind: 'saved',
          placeId: 1,
          placeLabel: 'Home',
        }),
        stay('h3', '2026-07-10T20:00:00.000Z', 33.23, -97.16, {
          placeKind: 'saved',
          placeId: 1,
          placeLabel: 'Home',
        }),
      ],
      [home],
    );
    const homeStop = stops.find(stop => stop.isHome);
    expect(homeStop?.visitNumbers).toEqual([1, 3, 4]);
    expect(formatDayStoryVisitNumbers(homeStop!.visitNumbers)).toBe('1 · 3 · 4');
    expect(stops.find(stop => stop.label === 'Walmart')?.visitNumbers).toEqual([
      2,
    ]);
  });

  it('pins Home on GPS stay location, not a distant saved-place coordinate', () => {
    const distantHome: SavedPlaceRow = {
      ...home,
      lat: 33.4,
      lng: -96.9,
    };
    const stops = buildDayStoryStops(
      [
        stay('h1', '2026-07-10T08:00:00.000Z', 33.23, -97.16, {
          placeKind: 'saved',
          placeId: 1,
          placeLabel: 'Home',
        }),
      ],
      [distantHome],
    );
    const homeStop = stops.find(stop => stop.isHome)!;
    expect(homeStop.coordinate.latitude).toBeCloseTo(33.23, 5);
    expect(homeStop.coordinate.longitude).toBeCloseTo(-97.16, 5);
  });

  it('does not group cache placeId with a saved place of the same numeric id', () => {
    const stops = buildDayStoryStops(
      [
        stay('home', '2026-07-10T08:00:00.000Z', 33.23, -97.16, {
          placeKind: 'saved',
          placeId: 1,
          placeLabel: 'Home',
        }),
        stay('shop', '2026-07-10T12:00:00.000Z', 33.25, -97.14, {
          placeKind: 'cache',
          placeId: 1,
          placeLabel: '3925 N Elm St',
        }),
      ],
      [home],
    );
    expect(stops).toHaveLength(2);
    expect(stops.find(stop => stop.isHome)?.visitNumbers).toEqual([1]);
    expect(stops.find(stop => stop.label === '3925 N Elm St')?.visitNumbers).toEqual([
      2,
    ]);
    expect(stops.find(stop => stop.label === '3925 N Elm St')?.isHome).toBe(false);
  });

  it('groups nearby unlabeled stays by proximity', () => {
    const stops = buildDayStoryStops([
      stay('a', '2026-07-10T09:00:00.000Z', 33.23, -97.16, {
        placeLabel: '3925 N Elm St',
        placeKind: 'cache',
      }),
      stay('b', '2026-07-10T18:00:00.000Z', 33.2302, -97.1602, {
        placeLabel: '3925 N Elm St',
        placeKind: 'cache',
      }),
    ]);
    expect(stops).toHaveLength(1);
    expect(stops[0]?.visitNumbers).toEqual([1, 2]);
  });

  it('updates poiCategory when a later revisit has a newer category', () => {
    const stops = buildDayStoryStops([
      stay('a', '2026-07-10T14:00:00.000Z', 33.23, -97.16, {
        placeKind: 'cache',
        poiId: 2,
        poiLabel: 'CVS',
        poiCategory: 'grocery',
      }),
      stay('b', '2026-07-10T18:00:00.000Z', 33.2301, -97.1601, {
        placeKind: 'cache',
        poiId: 2,
        poiLabel: 'CVS',
        poiCategory: 'pharmacy',
      }),
    ]);
    expect(stops).toHaveLength(1);
    expect(stops[0]?.poiId).toBe(2);
    expect(stops[0]?.poiCategory).toBe('pharmacy');
  });
});

describe('isCoordinateOnDayStoryStop', () => {
  it('detects pins on a stop', () => {
    const stops = buildDayStoryStops([
      stay('a', '2026-07-10T09:00:00.000Z', 33.23, -97.16, {
        placeKind: 'saved',
        placeId: 1,
        placeLabel: 'Home',
      }),
    ], [home]);
    expect(
      isCoordinateOnDayStoryStop(
        { latitude: 33.23, longitude: -97.16 },
        stops,
        150,
      ),
    ).toBe(true);
    expect(
      isCoordinateOnDayStoryStop(
        { latitude: 33.3, longitude: -97.3 },
        stops,
        150,
      ),
    ).toBe(false);
  });
});
