import type {Region} from 'react-native-maps';

import {getLatestLocationPoint} from '@/db/repositories/location-points';
import {MAP_FALLBACK_REGION} from '@/screens/map/map-screen-constants';

import {MAP_USER_ZOOM_DELTA} from '@/lib/app-constants';
import {
  regionAroundCoordinate,
  type MapCoordinate,
} from './map-location-utils';

/** Last known GPS from the database — used before live puck is ready. */
export async function resolveMapBootstrapRegion(): Promise<Region> {
  const latest = await getLatestLocationPoint();
  if (latest == null) {
    return MAP_FALLBACK_REGION;
  }
  return regionAroundCoordinate(
    {latitude: latest.lat, longitude: latest.lng},
    MAP_USER_ZOOM_DELTA,
    MAP_USER_ZOOM_DELTA,
  );
}

export function coordinateFromRegion(region: Region): MapCoordinate {
  return {latitude: region.latitude, longitude: region.longitude};
}

export function isWorldFallbackRegion(region: Region): boolean {
  return (
    region.latitude === MAP_FALLBACK_REGION.latitude &&
    region.longitude === MAP_FALLBACK_REGION.longitude &&
    region.latitudeDelta === MAP_FALLBACK_REGION.latitudeDelta
  );
}
