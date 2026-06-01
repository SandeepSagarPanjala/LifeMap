import {getDatabase} from '@/db/client';

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

      const state = await service.getState();
      const canTrack =
        authorization === 'always' ||
        authorization === 'when_in_use' ||
        state.authorizationStatus === 'always' ||
        state.authorizationStatus === 'when_in_use';

      if (canTrack && !state.enabled) {
        await service.start();
      }

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
