import type {Region} from 'react-native-maps';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type LocationPointLike = {
  lat: number;
  lng: number;
};
export type DistanceUnit = 'km' | 'mi';

const EARTH_RADIUS_KM = 6371;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Haversine distance in kilometers between two coordinates. */
export function distanceKm(a: LocationPointLike, b: LocationPointLike): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function calculatePathDistanceKm(points: LocationPointLike[]): number {
  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distanceKm(points[i - 1]!, points[i]!);
  }
  return total;
}

export function toMapCoordinates(points: LocationPointLike[]): MapCoordinate[] {
  return points.map(point => ({
    latitude: point.lat,
    longitude: point.lng,
  }));
}

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

/** Fit map camera to points with padding. */
export function regionForCoordinates(
  coordinates: MapCoordinate[],
  paddingFactor = 1.4,
): Region {
  if (coordinates.length === 0) {
    return DEFAULT_REGION;
  }

  if (coordinates.length === 1) {
    const [only] = coordinates;
    return {
      latitude: only!.latitude,
      longitude: only!.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  let minLat = coordinates[0]!.latitude;
  let maxLat = coordinates[0]!.latitude;
  let minLng = coordinates[0]!.longitude;
  let maxLng = coordinates[0]!.longitude;

  for (const coord of coordinates) {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
  }

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max((maxLat - minLat) * paddingFactor, 0.01);
  const longitudeDelta = Math.max((maxLng - minLng) * paddingFactor, 0.01);

  return {latitude, longitude, latitudeDelta, longitudeDelta};
}

export function formatDistance(km: number, unit: DistanceUnit = 'km'): string {
  if (unit === 'mi') {
    const miles = km * 0.621371;
    if (miles < 1) {
      const feet = Math.round(miles * 5280);
      return `${feet} ft`;
    }
    return `${miles.toFixed(1)} mi`;
  }

  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}
