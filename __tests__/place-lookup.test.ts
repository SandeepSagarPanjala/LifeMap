import {
  __resetPlaceLookupServiceForTests,
  enqueuePlaceLookupForStay,
  resetPlaceLookupSessionBudget,
  shouldSkipPlaceLookupForStay,
  stayQualifiesForPlaceLookup,
} from '@/lib/place-lookup-service';
import {
  findNearestPlaceLookupMatch,
  isWithinPlaceLookupVenue,
  PLACE_LOOKUP_VENUE_RADIUS_M,
} from '@/lib/place-lookup-venue';
import {resolveVisitPlaceDisplay} from '@/lib/place-lookup-display';
import type {PlaceLookupRow} from '@/lib/place-lookup-types';
import type {DetectedTrip} from '@/lib/trip-detection';

function placeRow(
  lat: number,
  lng: number,
  overrides: Partial<PlaceLookupRow> = {},
): PlaceLookupRow {
  return {
    id: 1,
    anchorLat: lat,
    anchorLng: lng,
    venueRadiusMeters: PLACE_LOOKUP_VENUE_RADIUS_M,
    addressLine: '123 Main St',
    candidates: [
      {
        id: 'poi-walmart',
        name: 'Walmart',
        kind: 'poi',
        distanceM: 12,
      },
      {
        id: 'address-main',
        name: '123 Main St',
        kind: 'address',
        distanceM: 0,
      },
    ],
    selectedCandidateIndex: null,
    lookupStatus: 'complete',
    fetchedAt: new Date(),
    ...overrides,
  };
}

function stay(points: {lat: number; lng: number}[]): DetectedTrip {
  const now = new Date('2026-06-08T12:00:00.000Z');
  return {
    id: 'stay-1',
    kind: 'stay',
    points: points.map((point, index) => ({
      id: index + 1,
      timestamp: new Date(now.getTime() + index * 60_000),
      lat: point.lat,
      lng: point.lng,
      accuracy: 10,
      altitude: null,
      speed: null,
      source: 'gps',
    })),
    startAt: now,
    endAt: new Date(now.getTime() + points.length * 60_000),
    distanceKm: 0,
    durationMs: points.length * 60_000,
  };
}

describe('place lookup venue matching', () => {
  it('matches anchors within the visit venue radius', () => {
    const anchor = {lat: 33.21, lng: -97.13};
    const cached = placeRow(33.2102, -97.1302);
    expect(isWithinPlaceLookupVenue(anchor, {
      lat: cached.anchorLat,
      lng: cached.anchorLng,
    })).toBe(true);
    expect(findNearestPlaceLookupMatch(anchor, [cached])?.id).toBe(1);
  });

  it('does not match anchors outside the venue radius', () => {
    const anchor = {lat: 33.21, lng: -97.13};
    const cached = placeRow(33.22, -97.15);
    expect(findNearestPlaceLookupMatch(anchor, [cached])).toBeNull();
  });
});

describe('place lookup display', () => {
  it('uses the selected candidate when set', () => {
    const row = placeRow(33.21, -97.13, {selectedCandidateIndex: 1});
    const display = resolveVisitPlaceDisplay(row);
    expect(display.primaryLabel).toBe('123 Main St');
    expect(display.isAreaDefault).toBe(true);
  });
});

describe('place lookup service guards', () => {
  beforeEach(() => {
    __resetPlaceLookupServiceForTests();
    resetPlaceLookupSessionBudget();
  });

  it('requires dwell minutes before lookup qualifies', () => {
    const shortStay = stay([{lat: 33.21, lng: -97.13}]);
    shortStay.durationMs = 2 * 60_000;
    expect(
      stayQualifiesForPlaceLookup(shortStay, {
        gapMinutes: 10,
        dwellMinutes: 5,
        dwellRadiusMeters: 25,
      }),
    ).toBe(false);
  });

  it('skips saved places', () => {
    const visit = stay([{lat: 33.21, lng: -97.13}]);
    visit.durationMs = 30 * 60_000;
    expect(
      shouldSkipPlaceLookupForStay(visit, [
        {
          id: 1,
          kind: 'home',
          label: 'Home',
          lat: 33.21,
          lng: -97.13,
          radiusMeters: 150,
          createdAt: new Date(),
        },
      ]),
    ).toBe(true);
  });
});

jest.mock('@/db/repositories/place-lookup-cache', () => ({
  findPlaceLookupNearAnchor: jest.fn().mockResolvedValue(null),
  insertPendingPlaceLookup: jest.fn(),
  completePlaceLookup: jest.fn(),
  failPlaceLookup: jest.fn(),
}));

jest.mock('@/lib/place-lookup-native', () => ({
  fetchNearbyPlaceLookup: jest.fn().mockResolvedValue({
    addressLine: '123 Main St',
    candidates: [],
  }),
}));

describe('place lookup enqueue', () => {
  beforeEach(() => {
    __resetPlaceLookupServiceForTests();
    resetPlaceLookupSessionBudget();
  });

  it('does not throw when native lookup succeeds', async () => {
    const visit = stay([{lat: 33.21, lng: -97.13}]);
    visit.durationMs = 30 * 60_000;
    await expect(
      enqueuePlaceLookupForStay(visit, [], {
        gapMinutes: 10,
        dwellMinutes: 5,
        dwellRadiusMeters: 25,
      }),
    ).resolves.toBeUndefined();
  });
});
