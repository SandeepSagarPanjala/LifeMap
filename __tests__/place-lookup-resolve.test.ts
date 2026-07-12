import { closestPlacePoiToAnchor } from '@/db/repositories/place-pois';
import { stayNeedsLazyPlaceLookup } from '@/lib/place-lookup-resolve';
import type { PlacePoiRow } from '@/lib/place-lookup-types';
import type { DetectedTrip } from '@/lib/trip-detection';

function poi(id: number, lat: number, lng: number, name = 'POI'): PlacePoiRow {
  return {
    id,
    cacheId: 1,
    name,
    lat,
    lng,
    category: null,
    source: 'mapkit',
    createdAt: new Date(),
  };
}

function stay(overrides: Partial<DetectedTrip> = {}): DetectedTrip {
  return {
    id: 'stay:1:2',
    kind: 'stay',
    points: [],
    startAt: new Date('2026-03-09T12:00:00.000Z'),
    endAt: new Date('2026-03-09T13:00:00.000Z'),
    durationMs: 60 * 60_000,
    distanceKm: 0,
    ...overrides,
  };
}

describe('closestPlacePoiToAnchor', () => {
  it('picks the nearest POI to the anchor', () => {
    const anchor = { lat: 37.7749, lng: -122.4194 };
    const closest = closestPlacePoiToAnchor(anchor, [
      poi(1, 37.7755, -122.4194, 'Far'),
      poi(2, 37.77491, -122.41941, 'Near'),
    ]);
    expect(closest?.id).toBe(2);
  });
});

describe('stayNeedsLazyPlaceLookup', () => {
  it('returns true for unlabeled closed stays', () => {
    expect(stayNeedsLazyPlaceLookup(stay(), [])).toBe(true);
  });

  it('returns false when cache or POI is already linked', () => {
    expect(
      stayNeedsLazyPlaceLookup(stay({ placeKind: 'cache', placeId: 3 }), []),
    ).toBe(false);
    expect(
      stayNeedsLazyPlaceLookup(stay({ poiId: 4, poiLabel: 'Cafe' }), []),
    ).toBe(false);
  });

  it('returns false for open visits', () => {
    expect(stayNeedsLazyPlaceLookup(stay({ openThroughNow: true }), [])).toBe(
      false,
    );
  });
});
