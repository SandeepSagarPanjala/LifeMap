import {
  centerMapOnUser,
  isCoordinateInMapView,
  regionAroundCoordinate,
} from '../src/lib/map-location-utils';

describe('map location utils', () => {
  const region = {
    latitude: 33.21,
    longitude: -97.13,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  it('detects when a coordinate is inside the visible region', () => {
    expect(isCoordinateInMapView({latitude: 33.21, longitude: -97.13}, region)).toBe(true);
    expect(isCoordinateInMapView({latitude: 33.35, longitude: -97.13}, region)).toBe(false);
  });

  it('builds a region centered on a coordinate', () => {
    const next = regionAroundCoordinate({latitude: 33.5, longitude: -97.2}, 0.08, 0.08);
    expect(next.latitude).toBe(33.5);
    expect(next.longitude).toBe(-97.2);
    expect(next.latitudeDelta).toBe(0.08);
  });

  it('centers the map on the user', () => {
    const animateToRegion = jest.fn();
    const region = centerMapOnUser(
      {animateToRegion},
      {latitude: 33.5, longitude: -97.2},
      true,
    );
    expect(animateToRegion).toHaveBeenCalled();
    expect(region.latitude).toBe(33.5);
    expect(region.longitude).toBe(-97.2);
  });
});
