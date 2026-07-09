import type { SavedPlaceRow } from '../src/db/repositories/saved-places';
import {
  MAX_SAVED_PLACE_LABEL_LENGTH,
  MAX_SAVED_PLACES,
} from '../src/lib/app-constants';
import {
  canAddSavedPlace,
  lookupSavedPlaceById,
  matchDriveEndSavedPlace,
  matchDriveStartSavedPlace,
  matchSavedPlaceForPoint,
  matchSavedPlaceForStay,
  matchSavedPlaceForTripEndpoint,
  normalizeSavedPlaceLabel,
} from '../src/lib/saved-places';
import { shouldShowSavedPlaceCircles } from '../src/lib/saved-places-map';
import type { DetectedTrip } from '../src/lib/trip-detection';

function place(
  kind: SavedPlaceRow['kind'],
  label: string,
  lat: number,
  lng: number,
  radiusMeters = 150,
  id = 1,
): SavedPlaceRow {
  return {
    id,
    kind,
    label,
    lat,
    lng,
    radiusMeters,
    addressLine: null,
    active: true,
    createdAt: new Date(),
  };
}

describe('saved places matching', () => {
  it('matches home before work when both overlap', () => {
    const anchor = { lat: 33.21, lng: -97.13 };
    const match = matchSavedPlaceForPoint(anchor, [
      place('work', 'Work', 33.21, -97.13, 150, 2),
      place('home', 'Home', 33.21, -97.13, 150, 1),
    ]);
    expect(match?.kind).toBe('home');
  });

  it('matches favorite by name within radius', () => {
    const match = matchSavedPlaceForPoint({ lat: 33.2105, lng: -97.1305 }, [
      place('favorite', "Mom's", 33.21, -97.13),
    ]);
    expect(match?.label).toBe("Mom's");
  });

  it('resolves a stay from trip savedPlaceId only', () => {
    const home = place('home', 'Home', 33.21, -97.13);
    const stay: DetectedTrip = {
      id: 'stay-1',
      kind: 'stay',
      points: [],
      startAt: new Date('2026-06-08T05:00:00.000Z'),
      endAt: new Date('2026-06-08T17:00:00.000Z'),
      distanceKm: 0,
      durationMs: 0,
      placeId: home.id,
      placeLabel: home.label,
      placeKind: 'saved' as const,
    };
    expect(matchSavedPlaceForStay(stay, [home])?.label).toBe('Home');
  });

  it('does not geofence-match unlabeled stays at runtime', () => {
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
    expect(
      matchSavedPlaceForStay(stay, [place('home', 'Home', 33.21, -97.13)]),
    ).toBeNull();
  });

  it('matches drive endpoints from trip ids', () => {
    const home = place('home', 'Home', 33.21, -97.13, 150, 1);
    const work = place('work', 'Work', 33.25, -97.15, 150, 2);
    const travel: DetectedTrip = {
      id: 'travel-1',
      kind: 'travel',
      points: [],
      startAt: new Date('2026-06-08T05:00:00.000Z'),
      endAt: new Date('2026-06-08T05:10:00.000Z'),
      distanceKm: 5,
      durationMs: 600_000,
      fromPlaceId: home.id,
      fromPlaceLabel: home.label,
      fromPlaceKind: 'saved' as const,
      toPlaceId: work.id,
      toPlaceLabel: work.label,
      toPlaceKind: 'saved' as const,
    };
    expect(
      matchSavedPlaceForTripEndpoint(travel, 'start', [home, work])?.label,
    ).toBe('Home');
    expect(
      matchSavedPlaceForTripEndpoint(travel, 'end', [home, work])?.label,
    ).toBe('Work');
  });

  it('matches drive end from the following stay savedPlaceId', () => {
    const library = place('favorite', 'Library', 33.05595, -96.83449, 150, 3);
    const travel: DetectedTrip = {
      id: 'travel-1',
      kind: 'travel',
      points: [],
      startAt: new Date('2026-06-08T05:00:00.000Z'),
      endAt: new Date('2026-06-08T05:10:00.000Z'),
      distanceKm: 1,
      durationMs: 600_000,
    };
    const nextStay: DetectedTrip = {
      id: 'stay-1',
      kind: 'stay',
      points: [],
      startAt: new Date('2026-06-08T05:10:00.000Z'),
      endAt: new Date('2026-06-08T05:40:00.000Z'),
      distanceKm: 0,
      durationMs: 1_800_000,
      placeId: library.id,
      placeLabel: library.label,
      placeKind: 'saved' as const,
    };

    expect(matchDriveEndSavedPlace(travel, nextStay, [library])?.label).toBe(
      'Library',
    );
  });

  it('matches drive start from the previous stay savedPlaceId', () => {
    const library = place('favorite', 'Library', 33.05595, -96.83449, 150, 3);
    const previousStay: DetectedTrip = {
      id: 'stay-0',
      kind: 'stay',
      points: [],
      startAt: new Date('2026-06-08T04:00:00.000Z'),
      endAt: new Date('2026-06-08T04:55:00.000Z'),
      distanceKm: 0,
      durationMs: 3_300_000,
      placeId: library.id,
      placeLabel: library.label,
      placeKind: 'saved' as const,
    };
    const travel: DetectedTrip = {
      id: 'travel-1',
      kind: 'travel',
      points: [],
      startAt: new Date('2026-06-08T05:00:00.000Z'),
      endAt: new Date('2026-06-08T05:10:00.000Z'),
      distanceKm: 1,
      durationMs: 600_000,
    };

    expect(
      matchDriveStartSavedPlace(travel, previousStay, [library])?.label,
    ).toBe('Library');
  });

  it('lookupSavedPlaceById returns null for unknown ids', () => {
    expect(
      lookupSavedPlaceById(99, [place('home', 'Home', 33.21, -97.13)]),
    ).toBeNull();
  });
});

describe('saved places limits', () => {
  function makePlaces(count: number): SavedPlaceRow[] {
    return Array.from({ length: count }, (_, index) =>
      place(
        'favorite',
        `Spot ${index + 1}`,
        33.21,
        -97.13 + index * 0.001,
        150,
        index + 1,
      ),
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
    expect(() => normalizeSavedPlaceLabel('   ')).toThrow(
      'Place name is required',
    );
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
