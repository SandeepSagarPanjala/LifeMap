import type {SavedPlaceRow} from '../src/db/repositories/saved-places';
import {
  canAddSavedPlace,
  matchDriveEndSavedPlace,
  matchDriveStartSavedPlace,
  matchSavedPlaceForPoint,
  matchSavedPlaceForStay,
  matchSavedPlaceForTripEndpoint,
  MAX_SAVED_PLACES,
  MAX_SAVED_PLACE_LABEL_LENGTH,
  normalizeSavedPlaceLabel,
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
    addressLine: null,
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

  it('matches drive end from the following visit when last GPS is still on the road', () => {
    const travel: DetectedTrip = {
      id: 'travel-1',
      kind: 'travel',
      points: [
        {
          id: 1,
          timestamp: new Date('2026-06-08T05:00:00.000Z'),
          lat: 33.052,
          lng: -96.83459,
          accuracy: 10,
          altitude: null,
          speed: null,
          source: 'gps',
        },
      ],
      startAt: new Date('2026-06-08T05:00:00.000Z'),
      endAt: new Date('2026-06-08T05:10:00.000Z'),
      distanceKm: 1,
      durationMs: 600_000,
    };
    const nextStay: DetectedTrip = {
      id: 'stay-1',
      kind: 'stay',
      points: [
        {
          id: 2,
          timestamp: new Date('2026-06-08T05:10:00.000Z'),
          lat: 33.05532,
          lng: -96.83445,
          accuracy: 10,
          altitude: null,
          speed: null,
          source: 'gps',
        },
      ],
      startAt: new Date('2026-06-08T05:10:00.000Z'),
      endAt: new Date('2026-06-08T05:40:00.000Z'),
      distanceKm: 0,
      durationMs: 1_800_000,
    };
    const library = place('favorite', 'Library', 33.05595, -96.83449);

    expect(matchSavedPlaceForTripEndpoint(travel, 'end', [library])).toBeNull();
    expect(matchDriveEndSavedPlace(travel, nextStay, [library])?.label).toBe(
      'Library',
    );
  });

  it('matches drive start from the previous visit when departure GPS is outside radius', () => {
    const previousStay: DetectedTrip = {
      id: 'stay-0',
      kind: 'stay',
      points: [
        {
          id: 1,
          timestamp: new Date('2026-06-08T04:00:00.000Z'),
          lat: 33.05532,
          lng: -96.83445,
          accuracy: 10,
          altitude: null,
          speed: null,
          source: 'gps',
        },
      ],
      startAt: new Date('2026-06-08T04:00:00.000Z'),
      endAt: new Date('2026-06-08T04:55:00.000Z'),
      distanceKm: 0,
      durationMs: 3_300_000,
    };
    const travel: DetectedTrip = {
      id: 'travel-1',
      kind: 'travel',
      points: [
        {
          id: 2,
          timestamp: new Date('2026-06-08T05:00:00.000Z'),
          lat: 33.052,
          lng: -96.83459,
          accuracy: 10,
          altitude: null,
          speed: null,
          source: 'gps',
        },
      ],
      startAt: new Date('2026-06-08T05:00:00.000Z'),
      endAt: new Date('2026-06-08T05:10:00.000Z'),
      distanceKm: 1,
      durationMs: 600_000,
    };
    const library = place('favorite', 'Library', 33.05595, -96.83449);

    expect(
      matchSavedPlaceForTripEndpoint(travel, 'start', [library]),
    ).toBeNull();
    expect(
      matchDriveStartSavedPlace(travel, previousStay, [library])?.label,
    ).toBe('Library');
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

describe('saved places label validation', () => {
  it('trims whitespace from labels', () => {
    expect(normalizeSavedPlaceLabel('  Library  ')).toBe('Library');
  });

  it('rejects empty labels', () => {
    expect(() => normalizeSavedPlaceLabel('   ')).toThrow('Place name is required');
  });

  it('rejects labels over the max length', () => {
    const long = 'a'.repeat(MAX_SAVED_PLACE_LABEL_LENGTH + 1);
    expect(() => normalizeSavedPlaceLabel(long)).toThrow(
      `${MAX_SAVED_PLACE_LABEL_LENGTH} characters or fewer`,
    );
  });

  it('accepts labels at the max length', () => {
    const max = 'a'.repeat(MAX_SAVED_PLACE_LABEL_LENGTH);
    expect(normalizeSavedPlaceLabel(max)).toBe(max);
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
