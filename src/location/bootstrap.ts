import { getDatabase } from '@/db/client';

import { syncSavedPlaceGeofences } from '@/location/geofence-registry';
import { startNativeLocationTracking } from '@/location/native-location-persist';
import {
  getLocationService,
  resetLocationService,
} from './transistorsoft-location-service';
import type { LocationAuthorizationStatus } from './types';

let databaseReady: Promise<void> | null = null;
let locationBootstrap: Promise<LocationAuthorizationStatus | null> | null =
  null;

export function ensureDatabaseReady(): Promise<void> {
  if (databaseReady) {
    return databaseReady;
  }

  databaseReady = getDatabase()
    .then(() => undefined)
    .catch(error => {
      databaseReady = null;
      throw error;
    });
  return databaseReady;
}

async function runLocationBootstrap(): Promise<LocationAuthorizationStatus | null> {
  await ensureDatabaseReady();
  const service = getLocationService();
  await service.configure();
  const authorization = await service.requestPermission();
  await service.syncEnabledFromSettings();
  await startNativeLocationTracking();
  await syncSavedPlaceGeofences();
  return authorization;
}

/**
 * Configure background tracking and request permissions after onboarding.
 * Retries after failure — the cached promise is cleared on reject.
 */
export function bootstrapLocationTracking(): Promise<LocationAuthorizationStatus | null> {
  if (locationBootstrap) {
    return locationBootstrap;
  }

  locationBootstrap = runLocationBootstrap().catch(error => {
    locationBootstrap = null;
    throw error;
  });
  return locationBootstrap;
}

export function resetLocationBootstrapForTests(): void {
  databaseReady = null;
  locationBootstrap = null;
  resetLocationService();
}
