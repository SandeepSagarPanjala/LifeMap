import type {Region} from 'react-native-maps';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export function isCoordinateInMapView(
  coordinate: MapCoordinate,
  region: Region,
): boolean {
  const latMin = region.latitude - region.latitudeDelta / 2;
  const latMax = region.latitude + region.latitudeDelta / 2;
  const lngMin = region.longitude - region.longitudeDelta / 2;
  const lngMax = region.longitude + region.longitudeDelta / 2;

  return (
    coordinate.latitude >= latMin &&
    coordinate.latitude <= latMax &&
    coordinate.longitude >= lngMin &&
    coordinate.longitude <= lngMax
  );
}

export function regionAroundCoordinate(
  coordinate: MapCoordinate,
  latitudeDelta: number,
  longitudeDelta: number,
): Region {
  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    latitudeDelta,
    longitudeDelta,
  };
}

export const MAP_USER_ZOOM_DELTA = 0.01;
const RECENTER_ZOOM_DELTA = MAP_USER_ZOOM_DELTA;
const ZOOM_OUT_FACTOR = 1.5;
const ZOOM_OUT_MS = 280;
const ZOOM_IN_MS = 420;

type MapAnimateRef = {
  animateToRegion: (region: Region, duration?: number) => void;
};

/** Center the map on the user (straight zoom, no pulse). */
export function centerMapOnUser(
  map: MapAnimateRef,
  user: MapCoordinate,
  animated = true,
): Region {
  const region = regionAroundCoordinate(
    user,
    RECENTER_ZOOM_DELTA,
    RECENTER_ZOOM_DELTA,
  );
  map.animateToRegion(region, animated ? 450 : 1);
  return region;
}

/** Brief zoom-out then zoom-in to current location (Life360-style recenter). */
export function animateRecenterToUser(
  map: MapAnimateRef,
  user: MapCoordinate,
  currentRegion: Region,
): void {
  const zoomedOut = regionAroundCoordinate(
    {
      latitude: (currentRegion.latitude + user.latitude) / 2,
      longitude: (currentRegion.longitude + user.longitude) / 2,
    },
    Math.max(currentRegion.latitudeDelta * ZOOM_OUT_FACTOR, RECENTER_ZOOM_DELTA * 2),
    Math.max(currentRegion.longitudeDelta * ZOOM_OUT_FACTOR, RECENTER_ZOOM_DELTA * 2),
  );

  map.animateToRegion(zoomedOut, ZOOM_OUT_MS);
  setTimeout(() => {
    map.animateToRegion(
      regionAroundCoordinate(user, RECENTER_ZOOM_DELTA, RECENTER_ZOOM_DELTA),
      ZOOM_IN_MS,
    );
  }, ZOOM_OUT_MS + 40);
}
