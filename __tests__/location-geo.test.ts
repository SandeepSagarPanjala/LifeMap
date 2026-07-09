import {
  calculatePathDistanceKm,
  distanceKm,
  downsampleMapCoordinates,
  formatDistance,
  regionForCoordinates,
} from '../src/lib/location-geo';

describe('location-geo', () => {
  it('computes distance between two coordinates', () => {
    const sf = { lat: 37.7749, lng: -122.4194 };
    const nearby = { lat: 37.7849, lng: -122.4094 };
    expect(distanceKm(sf, nearby)).toBeGreaterThan(0);
    expect(distanceKm(sf, nearby)).toBeLessThan(2);
  });

  it('sums path distance', () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.01 },
      { lat: 0, lng: 0.02 },
    ];
    expect(calculatePathDistanceKm(points)).toBeGreaterThan(0);
  });

  it('formats distance for display', () => {
    expect(formatDistance(0.4)).toBe('400 m');
    expect(formatDistance(2.5)).toBe('2.5 km');
  });

  it('builds a map region from coordinates', () => {
    const region = regionForCoordinates([
      { latitude: 37.77, longitude: -122.42 },
      { latitude: 37.78, longitude: -122.41 },
    ]);
    expect(region.latitude).toBeCloseTo(37.775, 2);
    expect(region.latitudeDelta).toBeGreaterThan(0);
  });

  it('downsamples map polylines to a safe vertex cap', () => {
    const dense = Array.from({ length: 500 }, (_, index) => ({
      latitude: 33 + index * 0.0001,
      longitude: -97 - index * 0.0001,
    }));
    const sampled = downsampleMapCoordinates(dense, 180);
    expect(sampled).toHaveLength(180);
    expect(sampled[0]).toEqual(dense[0]);
    expect(sampled[sampled.length - 1]).toEqual(dense[dense.length - 1]);
  });
});
