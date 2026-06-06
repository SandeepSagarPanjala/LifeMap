import BackgroundGeolocation, {
  type Location,
  type MotionChangeEvent,
  type Subscription,
} from 'react-native-background-geolocation';

import {insertLocationPoint} from '@/db/repositories/location-points';
import {getSetting, setSetting} from '@/db/repositories/settings';
import {STATIONARY_PING_MIN_MS} from '@/lib/motion-tracking-policy';
import {
  DEFAULT_TRACKING_PRESET,
  getTrackingPresetConfig,
  normalizeTrackingPresetId,
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
  private lastPersistedMs = 0;

  /** Every SDK location callback is written — no distance or time throttling. */
  private async persistLocation(location: Location, source = 'gps'): Promise<void> {
    await this.writeLocationToDatabase(location, source);
  }

  private async writeLocationToDatabase(
    location: Location,
    source: string,
  ): Promise<void> {
    const timestamp = locationTimestamp(location);
    const {coords} = location;

    await insertLocationPoint({
      timestamp,
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy >= 0 ? coords.accuracy : null,
      altitude: coords.altitude,
      speed: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
      source,
    });

    this.lastPersistedMs = timestamp.getTime();
  }

  /** Fresh GPS when the SDK has been quiet 30+ min while tracking is still on. */
  private async onHeartbeat(): Promise<void> {
    const sinceLastSaveMs = Date.now() - this.lastPersistedMs;
    if (this.lastPersistedMs !== 0 && sinceLastSaveMs < STATIONARY_PING_MIN_MS) {
      return;
    }

    try {
      const location = await BackgroundGeolocation.getCurrentPosition({
        samples: 1,
        persist: false,
        timeout: 30,
      });
      await this.persistLocation(location, 'heartbeat_ping');
    } catch (error) {
      if (__DEV__) {
        console.warn('[LifeMap] Stationary ping getCurrentPosition failed', error);
      }
    }
  }

  private async onMotionChange(event: MotionChangeEvent): Promise<void> {
    if (event.location) {
      try {
        await this.persistLocation(event.location, 'motion');
      } catch (error) {
        if (__DEV__) {
          console.warn('[LifeMap] Failed to persist motion change', error);
        }
      }
    }
  }

  async configure(): Promise<void> {
    if (this.configured) {
      return;
    }

    this.activePresetId = await readStoredPreset();
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
      BackgroundGeolocation.onMotionChange(event => {
        void this.onMotionChange(event);
      }),
      BackgroundGeolocation.onHeartbeat(() => {
        void this.onHeartbeat();
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
      maxRecordsToPersist: -1,
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
    this.lastPersistedMs = 0;
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
    this.lastPersistedMs = 0;
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
