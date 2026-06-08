import type {SavedPlaceRow} from '../src/db/repositories/saved-places';
import {
  canAddSavedPlace,
  matchSavedPlaceForPoint,
  matchSavedPlaceForStay,
  matchSavedPlaceForTripEndpoint,
  MAX_SAVED_PLACES,
} from '../src/lib/saved-places';
import {shouldShowSavedPlaceCircles} from '../src/lib/saved-places-map';
import type {DetectedTrip} from '../src/lib/trip-detection';

function place(
  kind: SavedPlaceRow['kind'],
  label: string,
  lat: number,
  lng: number,
  radiusMeters = 150,
): SavedPlaceRow {
  return {
    id: 1,
    kind,
    label,
    lat,
    lng,
    radiusMeters,
    createdAt: new Date(),
  };
}

describe('saved places matching', () => {
  it('matches home before work when both overlap', () => {
    const anchor = {lat: 33.21, lng: -97.13};
    const match = matchSavedPlaceForPoint(anchor, [
      place('work', 'Work', 33.21, -97.13),
      place('home', 'Home', 33.21, -97.13),
    ]);
    expect(match?.kind).toBe('home');
  });

  it('matches favorite by name within radius', () => {
    const match = matchSavedPlaceForPoint(
      {lat: 33.2105, lng: -97.1305},
      [place('favorite', "Mom's", 33.21, -97.13)],
    );
    expect(match?.label).toBe("Mom's");
  });

  it('matches a stay to a saved place', () => {
    const stay: DetectedTrip = {
      id: 'stay-1',
      kind: 'stay',
      points: [
        {
          id: 1,
          timestamp: new Date('2026-06-08T05:00:00.000Z'),
          lat: 33.21,
          lng: -97.13,
          accuracy: 10,
          altitude: null,
          speed: null,
          source: 'gps',
        },
      ],
      startAt: new Date('2026-06-08T05:00:00.000Z'),
      endAt: new Date('2026-06-08T05:00:00.000Z'),
      distanceKm: 0,
      durationMs: 0,
    };
    const match = matchSavedPlaceForStay(stay, [
      place('home', 'Home', 33.21, -97.13),
    ]);
    expect(match?.kind).toBe('home');
  });

  it('matches drive start and end to saved places', () => {
    const travel: DetectedTrip = {
      id: 'travel-1',
      kind: 'travel',
      points: [
        {
          id: 1,
          timestamp: new Date('2026-06-08T05:00:00.000Z'),
          lat: 33.21,
          lng: -97.13,
          accuracy: 10,
          altitude: null,
          speed: null,
          source: 'gps',
        },
        {
          id: 2,
          timestamp: new Date('2026-06-08T05:10:00.000Z'),
          lat: 33.25,
          lng: -97.15,
          accuracy: 10,
          altitude: null,
          speed: null,
          source: 'gps',
        },
      ],
      startAt: new Date('2026-06-08T05:00:00.000Z'),
      endAt: new Date('2026-06-08T05:10:00.000Z'),
      distanceKm: 5,
      durationMs: 600_000,
    };
    const places = [
      place('home', 'Home', 33.21, -97.13),
      place('favorite', 'Latitude Magnolia', 33.25, -97.15),
    ];
    expect(
      matchSavedPlaceForTripEndpoint(travel, 'start', places)?.label,
    ).toBe('Home');
    expect(
      matchSavedPlaceForTripEndpoint(travel, 'end', places)?.label,
    ).toBe('Latitude Magnolia');
  });
});

describe('saved places limits', () => {
  function makePlaces(count: number): SavedPlaceRow[] {
    return Array.from({length: count}, (_, index) =>
      place('favorite', `Spot ${index + 1}`, 33.21, -97.13 + index * 0.001),
    );
  }

  it('blocks new favorites at the max place count', () => {
    expect(canAddSavedPlace(makePlaces(MAX_SAVED_PLACES), 'favorite')).toBe(
      false,
    );
  });

  it('still allows replacing home when at the max place count', () => {
    const places = [
      place('home', 'Home', 33.21, -97.13),
      ...makePlaces(MAX_SAVED_PLACES - 1),
    ];
    expect(canAddSavedPlace(places, 'home')).toBe(true);
  });

  it('allows a new home when below the max place count', () => {
    expect(canAddSavedPlace(makePlaces(MAX_SAVED_PLACES - 1), 'home')).toBe(
      true,
    );
  });
});

describe('saved places map circles', () => {
  it('shows circles when zoomed in', () => {
    expect(shouldShowSavedPlaceCircles(0.005)).toBe(true);
  });

  it('hides circles when zoomed far out', () => {
    expect(shouldShowSavedPlaceCircles(0.05)).toBe(false);
  });
});
