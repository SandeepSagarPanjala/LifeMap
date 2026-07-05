import {
  __resetPlaceLookupServiceForTests,
  enqueuePlaceLookupForStay,
  resetPlaceLookupSessionBudget,
  shouldSkipPlaceLookupForStay,
  stayQualifiesForPlaceLookup,
} from '@/lib/place-lookup-service';
import {PLACE_LOOKUP_VENUE_RADIUS_M} from '@/lib/app-constants';
import {
  findNearestPlaceLookupMatch,
  isWithinPlaceLookupVenue,
} from '@/lib/place-lookup-venue';
import {resolveVisitPlaceDisplay} from '@/lib/place-lookup-display';
import {isVisitPlaceLabelConfirmed} from '@/lib/place-lookup-types';
import type {PlaceLookupRow, PlacePoiRow} from '@/lib/place-lookup-types';
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
    lookupStatus: 'complete',
    fetchedAt: new Date(),
    ...overrides,
  };
}

function poisForCache(cacheId: number): PlacePoiRow[] {
  return [
    {
      id: 1,
      cacheId,
      name: 'Walmart',
      lat: 33.2101,
      lng: -97.1301,
      source: 'mapkit',
      createdAt: new Date(),
    },
    {
      id: 2,
      cacheId,
      name: '123 Main St',
      lat: 33.21,
      lng: -97.13,
      source: 'mapkit',
      createdAt: new Date(),
    },
  ];
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
  it('uses the selected POI when set', () => {
    const row = placeRow(33.21, -97.13);
    const display = resolveVisitPlaceDisplay({
      placeKind: 'cache',
      placeLabel: row.addressLine,
      poiId: 2,
      poiLabel: '123 Main St',
      cacheId: row.id,
      pois: poisForCache(row.id),
    });
    expect(display.primaryLabel).toBe('123 Main St');
    expect(display.selectedPoiId).toBe(2);
    expect(isVisitPlaceLabelConfirmed(display)).toBe(true);
  });

  it('treats unselected lookup labels as not confirmed', () => {
    const row = placeRow(33.21, -97.13);
    const display = resolveVisitPlaceDisplay({
      placeKind: 'cache',
      placeLabel: row.addressLine,
      poiLabel: 'Walmart',
      cacheId: row.id,
      pois: poisForCache(row.id),
    });
    expect(display.primaryLabel).toBe('Walmart');
    expect(display.selectedPoiId).toBeNull();
    expect(isVisitPlaceLabelConfirmed(display)).toBe(false);
  });

  it('uses a user-selected POI label when provided', () => {
    const row = placeRow(33.21, -97.13);
    const display = resolveVisitPlaceDisplay({
      placeKind: 'cache',
      placeLabel: row.addressLine,
      poiId: 99,
      poiLabel: 'Client HQ',
      cacheId: row.id,
      pois: poisForCache(row.id),
    });
    expect(display.primaryLabel).toBe('Client HQ');
    expect(isVisitPlaceLabelConfirmed(display)).toBe(true);
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
    visit.placeId = 1;
    visit.placeLabel = 'Home';
    visit.placeKind = 'saved';
    expect(
      shouldSkipPlaceLookupForStay(visit, [
        {
          id: 1,
          kind: 'home',
          label: 'Home',
          lat: 33.21,
          lng: -97.13,
          radiusMeters: 150,
          addressLine: null,
          active: true,
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
