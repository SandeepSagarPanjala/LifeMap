import {
  animateRecenterToUser,
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
    expect(
      isCoordinateInMapView({ latitude: 33.21, longitude: -97.13 }, region),
    ).toBe(true);
    expect(
      isCoordinateInMapView({ latitude: 33.35, longitude: -97.13 }, region),
    ).toBe(false);
  });

  it('builds a region centered on a coordinate', () => {
    const next = regionAroundCoordinate(
      { latitude: 33.5, longitude: -97.2 },
      0.08,
      0.08,
    );
    expect(next.latitude).toBe(33.5);
    expect(next.longitude).toBe(-97.2);
    expect(next.latitudeDelta).toBe(0.08);
  });

  it('centers the map on the user', () => {
    const animateToRegion = jest.fn();
    const centeredRegion = centerMapOnUser(
      { animateToRegion },
      { latitude: 33.5, longitude: -97.2 },
      true,
    );
    expect(animateToRegion).toHaveBeenCalled();
    expect(centeredRegion.latitude).toBe(33.5);
    expect(centeredRegion.longitude).toBe(-97.2);
  });

  it('skips the zoom-out pulse when already at world zoom', () => {
    jest.useFakeTimers();
    const animateToRegion = jest.fn();
    animateRecenterToUser(
      { animateToRegion },
      { latitude: 33.21, longitude: -97.13 },
      {
        latitude: 20,
        longitude: 0,
        latitudeDelta: 120,
        longitudeDelta: 120,
      },
    );
    expect(animateToRegion).toHaveBeenCalledTimes(1);
    expect(animateToRegion.mock.calls[0]?.[0]).toMatchObject({
      latitude: 33.21,
      longitude: -97.13,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    jest.runOnlyPendingTimers();
    expect(animateToRegion).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('keeps the Life360 pulse at neighborhood zoom', () => {
    jest.useFakeTimers();
    const animateToRegion = jest.fn();
    animateRecenterToUser(
      { animateToRegion },
      { latitude: 33.21, longitude: -97.13 },
      region,
    );
    expect(animateToRegion).toHaveBeenCalledTimes(1);
    expect(animateToRegion.mock.calls[0]?.[0].latitudeDelta).toBeGreaterThan(
      region.latitudeDelta,
    );
    jest.runOnlyPendingTimers();
    expect(animateToRegion).toHaveBeenCalledTimes(2);
    expect(animateToRegion.mock.calls[1]?.[0]).toMatchObject({
      latitude: 33.21,
      longitude: -97.13,
      latitudeDelta: 0.01,
    });
    jest.useRealTimers();
  });
});
