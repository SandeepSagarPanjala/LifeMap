import {getDatabase} from '@/db/client';

import {syncSavedPlaceGeofences} from '@/location/geofence-registry';
import {startNativeLocationTracking} from '@/location/native-location-persist';
import {getLocationService, resetLocationService} from './transistorsoft-location-service';
import type {LocationAuthorizationStatus} from './types';

let databaseReady: Promise<void> | null = null;
let locationBootstrap: Promise<LocationAuthorizationStatus | null> | null = null;

export function ensureDatabaseReady(): Promise<void> {
  if (!databaseReady) {
    databaseReady = getDatabase().then(() => undefined);
  }
  return databaseReady;
}

/**
 * Configure background tracking and request permissions after onboarding.
 * Safe to call multiple times — runs once.
 */
export function bootstrapLocationTracking(): Promise<LocationAuthorizationStatus | null> {
  if (!locationBootstrap) {
    locationBootstrap = (async () => {
      await ensureDatabaseReady();
      const service = getLocationService();
      await service.configure();
      const authorization = await service.requestPermission();
      await service.syncEnabledFromSettings();
      await startNativeLocationTracking();
      await syncSavedPlaceGeofences();

      return authorization;
    })();
  }

  return locationBootstrap;
}

export function resetLocationBootstrapForTests(): void {
  databaseReady = null;
  locationBootstrap = null;
  resetLocationService();
}
