import BackgroundGeolocation, {
  type Location,
  type Subscription,
} from 'react-native-background-geolocation';

import {insertLocationPoint} from '@/db/repositories/location-points';
import {distanceKm} from '@/lib/location-geo';
import {getSetting, setSetting} from '@/db/repositories/settings';
import {LocationPersistScheduler} from '@/lib/location-persist-scheduler';
import {
  DEFAULT_TRACKING_PRESET,
  getTrackingPresetConfig,
  normalizeTrackingPresetId,
  TRACKING_PRESETS,
  SETTINGS_KEY_TRACKING_ENABLED,
  SETTINGS_KEY_TRACKING_PRESET,
  type TrackingPresetId,
} from '@/lib/tracking-presets';

import type {LocationAuthorizationStatus, LocationService, LocationServiceState} from './types';

function mapAuthorizationStatus(status: number): LocationAuthorizationStatus {
  const {AuthorizationStatus} = BackgroundGeolocation;

  switch (status) {
    case AuthorizationStatus.Always:
      return 'always';
    case AuthorizationStatus.WhenInUse:
      return 'when_in_use';
    case AuthorizationStatus.Denied:
      return 'denied';
    case AuthorizationStatus.Restricted:
      return 'restricted';
    default:
      return 'not_determined';
  }
}

function locationTimestamp(location: Location): Date {
  const value = location.timestamp as string | number | Date;
  return value instanceof Date ? value : new Date(value);
}

export class TransistorSoftLocationService implements LocationService {
  private configured = false;
  private subscriptions: Subscription[] = [];
  private activePresetId: TrackingPresetId = DEFAULT_TRACKING_PRESET;
  private latestLocation: Location | null = null;
  private persistScheduler: LocationPersistScheduler | null = null;
  private lastPersistedCoords: {lat: number; lng: number} | null = null;

  private rebuildPersistScheduler(): void {
    const preset = TRACKING_PRESETS[this.activePresetId];
    this.persistScheduler?.reset();

    if (preset.maxPersistIntervalMs <= 0) {
      this.persistScheduler = null;
      return;
    }

    this.persistScheduler = new LocationPersistScheduler(
      preset.maxPersistIntervalMs,
      async () => {
        if (this.latestLocation) {
          await this.writeLocationToDatabase(this.latestLocation);
        }
      },
    );
  }

  private movedEnoughSinceLastSave(
    location: Location,
    distanceFilterMeters: number,
  ): boolean {
    if (!this.lastPersistedCoords) {
      return true;
    }

    const movedKm = distanceKm(this.lastPersistedCoords, {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    });
    return movedKm * 1000 >= distanceFilterMeters;
  }

  private async persistLocation(location: Location): Promise<void> {
    this.latestLocation = location;
    const preset = TRACKING_PRESETS[this.activePresetId];

    if (preset.maxPersistIntervalMs <= 0) {
      await this.writeLocationToDatabase(location);
      return;
    }

    if (this.movedEnoughSinceLastSave(location, preset.distanceFilter)) {
      const timestampMs = locationTimestamp(location).getTime();
      this.persistScheduler?.reset();
      await this.writeLocationToDatabase(location);
      this.persistScheduler?.markPersisted(timestampMs);
      return;
    }

    const timestampMs = locationTimestamp(location).getTime();
    this.persistScheduler?.enqueue(timestampMs);
  }

  private async writeLocationToDatabase(location: Location): Promise<void> {
    const timestamp = locationTimestamp(location);
    const {coords} = location;

    await insertLocationPoint({
      timestamp,
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy >= 0 ? coords.accuracy : null,
      altitude: coords.altitude,
      speed: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
      source: 'gps',
    });

    this.lastPersistedCoords = {lat: coords.latitude, lng: coords.longitude};
  }

  private async refreshHeartbeatLocation(): Promise<void> {
    const preset = TRACKING_PRESETS[this.activePresetId];
    if (!preset.useHeartbeatFloor) {
      return;
    }

    try {
      const location = await BackgroundGeolocation.getCurrentPosition({
        samples: 1,
        persist: false,
        timeout: 30,
      });
      await this.persistLocation(location);
    } catch (error) {
      if (__DEV__) {
        console.warn('[LifeMap] Heartbeat getCurrentPosition failed', error);
      }
    }
  }

  async configure(): Promise<void> {
    if (this.configured) {
      return;
    }

    this.activePresetId = await readStoredPreset();
    this.rebuildPersistScheduler();
    const presetConfig = getTrackingPresetConfig(this.activePresetId);

    this.subscriptions.push(
      BackgroundGeolocation.onLocation(async location => {
        try {
          await this.persistLocation(location);
        } catch (error) {
          if (__DEV__) {
            console.warn('[LifeMap] Failed to persist location', error);
          }
        }
      }),
      BackgroundGeolocation.onHeartbeat(() => {
        void this.refreshHeartbeatLocation();
      }),
    );

    await BackgroundGeolocation.ready({
      ...presetConfig,
      locationAuthorizationRequest: BackgroundGeolocation.LocationRequest.Always,
      stopOnTerminate: false,
      startOnBoot: true,
      foregroundService: true,
      autoSync: false,
      batchSync: false,
      maxRecordsToPersist: 250,
      notification: {
        title: 'LifeMap',
        text: 'Recording your day privately on this device',
      },
      backgroundPermissionRationale: {
        title: 'Allow LifeMap to track in the background?',
        message:
          'LifeMap needs always-on location so your timeline stays complete when the app is closed. Everything stays encrypted on your phone.',
        positiveAction: 'Change to Always',
        negativeAction: 'Cancel',
      },
      debug: false,
      logLevel: BackgroundGeolocation.LogLevel.Warning,
    } as Parameters<typeof BackgroundGeolocation.ready>[0]);

    await BackgroundGeolocation.setConfig({
      debug: false,
      logLevel: BackgroundGeolocation.LogLevel.Warning,
    } as Parameters<typeof BackgroundGeolocation.setConfig>[0]);

    this.configured = true;
  }

  async requestPermission(): Promise<LocationAuthorizationStatus> {
    const status = await BackgroundGeolocation.requestPermission();
    return mapAuthorizationStatus(status);
  }

  async getState(): Promise<LocationServiceState> {
    const state = await BackgroundGeolocation.getState();
    const provider = await BackgroundGeolocation.getProviderState();

    return {
      enabled: state.enabled,
      authorizationStatus: mapAuthorizationStatus(provider.status),
      presetId: await readStoredPreset(),
    };
  }

  async start(): Promise<void> {
    await BackgroundGeolocation.start();
    await setSetting(SETTINGS_KEY_TRACKING_ENABLED, 'true');
  }

  async stop(): Promise<void> {
    await BackgroundGeolocation.stop();
    await setSetting(SETTINGS_KEY_TRACKING_ENABLED, 'false');
  }

  async setPreset(presetId: TrackingPresetId): Promise<void> {
    this.activePresetId = presetId;
    this.latestLocation = null;
    this.lastPersistedCoords = null;
    this.rebuildPersistScheduler();
    await setSetting(SETTINGS_KEY_TRACKING_PRESET, presetId);
    await BackgroundGeolocation.setConfig(getTrackingPresetConfig(presetId));
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      await this.start();
      return;
    }
    await this.stop();
  }

  async syncEnabledFromSettings(): Promise<void> {
    const enabled = await readStoredEnabled();
    const state = await BackgroundGeolocation.getState();

    if (enabled && !state.enabled) {
      await BackgroundGeolocation.start();
    }

    if (!enabled && state.enabled) {
      await BackgroundGeolocation.stop();
    }
  }

  dispose(): void {
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
    this.persistScheduler?.reset();
    this.persistScheduler = null;
    this.latestLocation = null;
    this.lastPersistedCoords = null;
    this.configured = false;
  }
}

async function readStoredPreset(): Promise<TrackingPresetId> {
  const stored = await getSetting(SETTINGS_KEY_TRACKING_PRESET);
  return normalizeTrackingPresetId(stored);
}

async function readStoredEnabled(): Promise<boolean> {
  const stored = await getSetting(SETTINGS_KEY_TRACKING_ENABLED);
  if (stored === null) {
    return true;
  }
  return stored === 'true';
}

let locationService: TransistorSoftLocationService | null = null;

export function getLocationService(): TransistorSoftLocationService {
  if (!locationService) {
    locationService = new TransistorSoftLocationService();
  }
  return locationService;
}

export function resetLocationService(): void {
  if (locationService) {
    locationService.dispose();
    locationService = null;
  }
}
