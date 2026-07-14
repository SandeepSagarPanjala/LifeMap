import { Platform } from 'react-native';
import { NativeModules } from 'react-native';

import type { Location } from 'react-native-background-geolocation';

import { sdkLocationExtras } from '@/lib/sdk-location-extras';

function locationTimestamp(location: Location): Date {
  const value = location.timestamp as string | number | Date;
  return value instanceof Date ? value : new Date(value);
}

type NativeGeofenceSpec = {
  identifier: string;
  lat: number;
  lng: number;
  radiusMeters: number;
};

type LocationPersistExtras = {
  heading?: number | null;
  headingAccuracy?: number | null;
  speedAccuracy?: number | null;
  altitudeAccuracy?: number | null;
  activityType?: string | null;
  activityConfidence?: number | null;
  isMoving?: boolean | null;
  isMock?: boolean | null;
  uuid?: string | null;
  batteryLevel?: number | null;
  batteryIsCharging?: boolean | null;
};

type LocationPersistNativeModule = {
  startNativeTracking(): Promise<{ started: boolean; databasePath: string }>;
  stopNativeTracking(): Promise<boolean>;
  insertLocation(
    timestampMs: number,
    lat: number,
    lng: number,
    accuracy: number,
    altitude: number,
    speed: number,
    source: string,
    extras: LocationPersistExtras | null,
  ): Promise<boolean>;
  drainTransistorQueue(): Promise<number>;
  syncGeofences(specs: NativeGeofenceSpec[]): Promise<number>;
  getNativePersistStatus(): Promise<{
    databasePath: string;
    lastTimestampMs?: number;
  }>;
};

const nativeModule = NativeModules.LocationPersistModule as
  | LocationPersistNativeModule
  | undefined;

export function isNativeLocationPersistAvailable(): boolean {
  return Platform.OS === 'ios' && nativeModule?.insertLocation != null;
}

export async function startNativeLocationTracking(): Promise<void> {
  if (!isNativeLocationPersistAvailable()) {
    return;
  }
  await nativeModule!.startNativeTracking();
}

export async function nativePersistLocation(
  location: Location,
  source: string,
): Promise<boolean> {
  if (!isNativeLocationPersistAvailable()) {
    return false;
  }

  const timestamp = locationTimestamp(location);
  const { coords } = location;
  const extras = sdkLocationExtras(location);
  return nativeModule!.insertLocation(
    timestamp.getTime(),
    coords.latitude,
    coords.longitude,
    coords.accuracy ?? -1,
    coords.altitude ?? -1,
    coords.speed ?? -1,
    source,
    extras,
  );
}

export async function nativeDrainTransistorQueue(): Promise<number> {
  if (!isNativeLocationPersistAvailable()) {
    return 0;
  }
  return nativeModule!.drainTransistorQueue();
}

export async function nativeSyncGeofences(
  specs: NativeGeofenceSpec[],
): Promise<number> {
  if (!isNativeLocationPersistAvailable()) {
    return 0;
  }
  return nativeModule!.syncGeofences(specs);
}

export type { NativeGeofenceSpec };
