import BackgroundGeolocation, {
  type Location,
  type Subscription,
} from 'react-native-background-geolocation';

import {insertLocationPoint} from '@/db/repositories/location-points';
import {getSetting, setSetting} from '@/db/repositories/settings';
import {
  DEFAULT_TRACKING_PRESET,
  getTrackingPresetConfig,
  isTrackingPresetId,
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

async function persistLocation(location: Location): Promise<void> {
  const {coords} = location;

  await insertLocationPoint({
    timestamp: locationTimestamp(location),
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy >= 0 ? coords.accuracy : null,
    altitude: coords.altitude,
    speed: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
    source: 'gps',
  });
}

async function readStoredPreset(): Promise<TrackingPresetId> {
  const stored = await getSetting(SETTINGS_KEY_TRACKING_PRESET);
  return isTrackingPresetId(stored) ? stored : DEFAULT_TRACKING_PRESET;
}

async function readStoredEnabled(): Promise<boolean> {
  const stored = await getSetting(SETTINGS_KEY_TRACKING_ENABLED);
  if (stored === null) {
    return true;
  }
  return stored === 'true';
}

export class TransistorSoftLocationService implements LocationService {
  private configured = false;
  private subscriptions: Subscription[] = [];

  async configure(): Promise<void> {
    if (this.configured) {
      return;
    }

    const presetId = await readStoredPreset();
    const presetConfig = getTrackingPresetConfig(presetId);

    this.subscriptions.push(
      BackgroundGeolocation.onLocation(async location => {
        try {
          await persistLocation(location);
        } catch (error) {
          if (__DEV__) {
            console.warn('[LifeMap] Failed to persist location', error);
          }
        }
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
      debug: __DEV__,
      logLevel: __DEV__
        ? BackgroundGeolocation.LogLevel.Verbose
        : BackgroundGeolocation.LogLevel.Off,
    } as Parameters<typeof BackgroundGeolocation.ready>[0]);

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
    this.configured = false;
  }
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
