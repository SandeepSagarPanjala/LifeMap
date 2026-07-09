import {
  cacheNeedsPoiCoordinateRefresh,
  poiCoordinatesMatchAnchor,
} from '@/db/repositories/place-pois';
import type { PlacePoiRow } from '@/lib/place-lookup-types';

function poi(
  overrides: Partial<PlacePoiRow> &
    Pick<PlacePoiRow, 'id' | 'name' | 'lat' | 'lng'>,
): PlacePoiRow {
  return {
    cacheId: 1,
    source: 'mapkit',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('poi coordinate refresh helpers', () => {
  it('detects POIs at the geocode anchor', () => {
    const anchor = { lat: 33.22, lng: -97.16 };
    expect(poiCoordinatesMatchAnchor({ lat: 33.22, lng: -97.16 }, anchor)).toBe(
      true,
    );
    expect(poiCoordinatesMatchAnchor({ lat: 33.23, lng: -97.16 }, anchor)).toBe(
      false,
    );
  });

  it('marks cache for refresh when mapkit POIs sit on anchor', () => {
    const anchor = { lat: 33.22, lng: -97.16 };
    const pois = [
      poi({ id: 1, name: 'A', lat: 33.22, lng: -97.16 }),
      poi({ id: 2, name: 'B', lat: 33.22, lng: -97.16 }),
    ];
    expect(cacheNeedsPoiCoordinateRefresh(anchor, pois)).toBe(true);
  });

  it('does not refresh when mapkit POIs have distinct coordinates', () => {
    const anchor = { lat: 33.22, lng: -97.16 };
    const pois = [
      poi({ id: 1, name: 'A', lat: 33.221, lng: -97.161 }),
      poi({
        id: 2,
        name: 'Custom',
        lat: 33.22,
        lng: -97.16,
        source: 'user',
      }),
    ];
    expect(cacheNeedsPoiCoordinateRefresh(anchor, pois)).toBe(false);
  });

  it('marks cache for refresh when no mapkit POIs exist', () => {
    const anchor = { lat: 33.22, lng: -97.16 };
    const pois = [
      poi({
        id: 1,
        name: 'Custom',
        lat: 33.22,
        lng: -97.16,
        source: 'user',
      }),
    ];
    expect(cacheNeedsPoiCoordinateRefresh(anchor, pois)).toBe(true);
  });
});
