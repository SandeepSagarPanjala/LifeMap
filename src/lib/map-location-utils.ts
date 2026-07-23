import type { Region } from 'react-native-maps';
import { MAP_USER_ZOOM_DELTA } from '@/lib/app-constants';

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

const RECENTER_ZOOM_DELTA = MAP_USER_ZOOM_DELTA;
const ZOOM_OUT_FACTOR = 1.5;
const ZOOM_OUT_MS = 280;
const ZOOM_IN_MS = 420;
/**
 * MapKit can abort when animateToRegion uses deltas near/over ~180°. Cap the
 * Life360-style pulse well below that.
 */
const MAX_SAFE_MAP_DELTA = 80;
/**
 * If already this zoomed out, skip the "zoom out further" pulse — from world
 * view that pulse would push latitudeDelta past MapKit's safe range.
 */
const SKIP_PULSE_WHEN_DELTA_ABOVE = 0.35;

type MapAnimateRef = {
  animateToRegion: (region: Region, duration?: number) => void;
};

function clampMapDelta(delta: number): number {
  if (!Number.isFinite(delta) || delta <= 0) {
    return RECENTER_ZOOM_DELTA;
  }
  return Math.min(delta, MAX_SAFE_MAP_DELTA);
}

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
  const target = regionAroundCoordinate(
    user,
    RECENTER_ZOOM_DELTA,
    RECENTER_ZOOM_DELTA,
  );
  const currentLatDelta = clampMapDelta(currentRegion.latitudeDelta);
  const currentLngDelta = clampMapDelta(currentRegion.longitudeDelta);

  // World / continent zoom: flying out further crashes or no-ops MapKit.
  if (
    currentLatDelta >= SKIP_PULSE_WHEN_DELTA_ABOVE ||
    currentLngDelta >= SKIP_PULSE_WHEN_DELTA_ABOVE
  ) {
    map.animateToRegion(target, ZOOM_OUT_MS + ZOOM_IN_MS);
    return;
  }

  const zoomedOut = regionAroundCoordinate(
    {
      latitude: (currentRegion.latitude + user.latitude) / 2,
      longitude: (currentRegion.longitude + user.longitude) / 2,
    },
    clampMapDelta(
      Math.max(currentLatDelta * ZOOM_OUT_FACTOR, RECENTER_ZOOM_DELTA * 2),
    ),
    clampMapDelta(
      Math.max(currentLngDelta * ZOOM_OUT_FACTOR, RECENTER_ZOOM_DELTA * 2),
    ),
  );

  map.animateToRegion(zoomedOut, ZOOM_OUT_MS);
  setTimeout(() => {
    map.animateToRegion(target, ZOOM_IN_MS);
  }, ZOOM_OUT_MS + 40);
}
