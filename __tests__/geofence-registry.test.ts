import {GEOFENCE_WAKE_MIN_RADIUS_METERS} from '@/lib/app-constants';
import {savedPlaceGeofenceSpecs} from '@/location/geofence-registry';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';

describe('geofence registry', () => {
  it('uses at least the iOS wake radius for saved places', () => {
    const specs = savedPlaceGeofenceSpecs([
      {
        id: 1,
        kind: 'home',
        label: 'Home',
        lat: 33.1,
        lng: -96.8,
        radiusMeters: 20,
        addressLine: null,
        active: true,
        createdAt: new Date('2026-01-01'),
      },
    ]);

    expect(specs).toEqual([
      {
        identifier: 'saved-place-1',
        lat: 33.1,
        lng: -96.8,
        radiusMeters: GEOFENCE_WAKE_MIN_RADIUS_METERS,
      },
    ]);
  });

  it('keeps larger custom radii', () => {
    const place: SavedPlaceRow = {
      id: 2,
      kind: 'favorite',
      label: 'Gym',
      lat: 33.2,
      lng: -96.7,
      radiusMeters: 150,
      addressLine: null,
      active: true,
      createdAt: new Date('2026-01-01'),
    };
    expect(savedPlaceGeofenceSpecs([place])[0]?.radiusMeters).toBe(150);
  });
});
