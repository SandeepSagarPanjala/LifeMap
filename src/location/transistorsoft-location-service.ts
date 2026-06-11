import BackgroundGeolocation, {
  type HeadlessEvent,
  type Location,
  type MotionChangeEvent,
  type Subscription,
} from 'react-native-background-geolocation';

import {
  getLatestLocationPoint,
  insertLocationPoint,
} from '@/db/repositories/location-points';
import {getSetting, setSetting} from '@/db/repositories/settings';
import {evaluateDepartureWatchdog} from '@/lib/departure-watchdog';
import {recordTrackingDiagnostic} from '@/lib/tracking-diagnostics';
import {
  getTrackingPresetConfig,
  SETTINGS_KEY_TRACKING_ENABLED,
  TRACKING_DISTANCE_FILTER_METERS,
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

function isLocationLike(value: unknown): value is Location {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as {coords?: {latitude?: number; longitude?: number}};
  return (
    candidate.coords?.latitude != null &&
    candidate.coords?.longitude != null
  );
}

function toLocationSource(base: string, eventName?: string): string {
  if (!eventName) {
    return base;
  }
  return `${base}:${String(eventName).toLowerCase()}`;
}

export class TransistorSoftLocationService implements LocationService {
  private configured = false;
  private subscriptions: Subscription[] = [];
  private lastPersistedMs = 0;
  private lastPersistedLat: number | null = null;
  private lastPersistedLng: number | null = null;
  private heartbeatInFlight: Promise<void> | null = null;
  private suppressOnLocationTimestampMs: number | null = null;
  private initializingPersistedClock: Promise<void> | null = null;

  /** Every SDK location callback is written — no distance or time throttling. */
  private async persistLocation(
    location: Location,
    source = 'gps',
    options?: {dedupe?: boolean},
  ): Promise<void> {
    await this.writeLocationToDatabase(location, source, {
      dedupe: options?.dedupe,
    });
  }

  private async writeLocationToDatabase(
    location: Location,
    source: string,
    options?: {dedupe?: boolean},
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
    }, {dedupe: options?.dedupe});

    this.lastPersistedMs = timestamp.getTime();
    this.lastPersistedLat = coords.latitude;
    this.lastPersistedLng = coords.longitude;
  }

  private lastSavedFix(): {lat: number; lng: number} | null {
    if (this.lastPersistedLat == null || this.lastPersistedLng == null) {
      return null;
    }
    return {lat: this.lastPersistedLat, lng: this.lastPersistedLng};
  }

  private async initializePersistedClock(): Promise<void> {
    if (this.initializingPersistedClock != null) {
      return this.initializingPersistedClock;
    }
    this.initializingPersistedClock = (async () => {
      const latest = await getLatestLocationPoint();
      if (latest?.timestamp) {
        this.lastPersistedMs = latest.timestamp.getTime();
        this.lastPersistedLat = latest.lat;
        this.lastPersistedLng = latest.lng;
      }
    })().finally(() => {
      this.initializingPersistedClock = null;
    });
    return this.initializingPersistedClock;
  }

  private async importNativeQueue(): Promise<void> {
    const pending = (await BackgroundGeolocation.getLocations()) as Location[];
    if (pending.length === 0) {
      return;
    }

    for (const item of pending) {
      if (!isLocationLike(item)) {
        continue;
      }
      const source = toLocationSource('native_queue', item.event);
      await this.persistLocation(item, source, {dedupe: true});
    }
    await BackgroundGeolocation.destroyLocations();
    await recordTrackingDiagnostic('native_queue_drained', {
      importedCount: pending.length,
    });
  }

  async drainNativeQueue(): Promise<void> {
    await this.importNativeQueue();
  }

  /** Samples GPS every heartbeat to catch silent departures after long stationary periods. */
  private async onHeartbeat(): Promise<void> {
    if (this.heartbeatInFlight != null) {
      return this.heartbeatInFlight;
    }
    this.heartbeatInFlight = this.runHeartbeat().finally(() => {
      this.heartbeatInFlight = null;
    });
    return this.heartbeatInFlight;
  }

  private async forceMovingMode(reason: string, details: Record<string, unknown>): Promise<void> {
    try {
      await BackgroundGeolocation.changePace(true);
      await recordTrackingDiagnostic('departure_force_moving', {
        reason,
        ...details,
      });
    } catch (error) {
      await recordTrackingDiagnostic('departure_force_moving_error', {
        reason,
        message: error instanceof Error ? error.message : 'unknown',
        ...details,
      });
      if (__DEV__) {
        console.warn('[LifeMap] changePace(true) failed', error);
      }
    }
  }

  private async runHeartbeat(): Promise<void> {
    await this.importNativeQueue();

    const sinceLastSaveMs =
      this.lastPersistedMs === 0 ? Number.POSITIVE_INFINITY : Date.now() - this.lastPersistedMs;

    try {
      const location = await BackgroundGeolocation.getCurrentPosition({
        samples: 1,
        persist: false,
        timeout: 30,
      });
      const {coords} = location;
      const evaluation = evaluateDepartureWatchdog({
        sinceLastSaveMs,
        lastSaved: this.lastSavedFix(),
        fresh: {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy >= 0 ? coords.accuracy : null,
          speed: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
        },
      });

      if (evaluation.forceMoving) {
        await this.forceMovingMode(evaluation.reason, {
          distanceMeters: evaluation.distanceMeters,
          sinceLastSaveMs,
          speed: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
        });
      }

      if (evaluation.shouldPersist) {
        this.suppressOnLocationTimestampMs = locationTimestamp(location).getTime();
        await this.persistLocation(location, evaluation.source, {dedupe: true});
        await recordTrackingDiagnostic(
          evaluation.source === 'heartbeat_ping' ? 'heartbeat_saved' : 'heartbeat_departure_saved',
          {
            reason: evaluation.reason,
            distanceMeters: evaluation.distanceMeters,
            timestamp: locationTimestamp(location).toISOString(),
          },
        );
        return;
      }

      await recordTrackingDiagnostic('heartbeat_checked', {
        reason: evaluation.reason,
        distanceMeters: evaluation.distanceMeters,
        sinceLastSaveMs,
      });
    } catch (error) {
      await recordTrackingDiagnostic('heartbeat_error', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      if (__DEV__) {
        console.warn('[LifeMap] Heartbeat getCurrentPosition failed', error);
      }
    }
  }

  private async onMotionChange(event: MotionChangeEvent): Promise<void> {
    await recordTrackingDiagnostic('motion_change', {
      isMoving: event.isMoving,
      hasLocation: event.location != null,
    });
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

    const presetConfig = getTrackingPresetConfig();
    await this.initializePersistedClock();
    await recordTrackingDiagnostic('tracking_configure', {
      distanceFilterMeters: TRACKING_DISTANCE_FILTER_METERS,
    });

    this.subscriptions.push(
      BackgroundGeolocation.onLocation(async location => {
        const timestampMs = locationTimestamp(location).getTime();
        if (
          this.suppressOnLocationTimestampMs != null &&
          this.suppressOnLocationTimestampMs === timestampMs
        ) {
          this.suppressOnLocationTimestampMs = null;
          return;
        }
        try {
          await this.persistLocation(location, 'gps', {dedupe: true});
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
      BackgroundGeolocation.onProviderChange(provider => {
        void recordTrackingDiagnostic('provider_change', {
          enabled: provider.enabled,
          status: provider.status,
          gps: provider.gps,
          network: provider.network,
        });
      }),
      BackgroundGeolocation.onAuthorization(event => {
        void recordTrackingDiagnostic('authorization_event', {
          status: event.status,
          success: event.success,
          error: event.error,
        });
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
    await this.importNativeQueue();

    this.configured = true;
  }

  async requestPermission(): Promise<LocationAuthorizationStatus> {
    const status = await BackgroundGeolocation.requestPermission();
    await recordTrackingDiagnostic('permission_requested', {
      status: mapAuthorizationStatus(status),
    });
    return mapAuthorizationStatus(status);
  }

  async getState(): Promise<LocationServiceState> {
    const state = await BackgroundGeolocation.getState();
    const provider = await BackgroundGeolocation.getProviderState();

    return {
      enabled: state.enabled,
      authorizationStatus: mapAuthorizationStatus(provider.status),
    };
  }

  async start(): Promise<void> {
    await BackgroundGeolocation.start();
    await this.importNativeQueue();
    await setSetting(SETTINGS_KEY_TRACKING_ENABLED, 'true');
    await recordTrackingDiagnostic('tracking_enabled', {enabled: true});
  }

  async stop(): Promise<void> {
    await BackgroundGeolocation.stop();
    await setSetting(SETTINGS_KEY_TRACKING_ENABLED, 'false');
    await recordTrackingDiagnostic('tracking_enabled', {enabled: false});
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
      await this.importNativeQueue();
      await recordTrackingDiagnostic('tracking_sync_started', {enabledFromSettings: true});
    }

    if (!enabled && state.enabled) {
      await BackgroundGeolocation.stop();
      await recordTrackingDiagnostic('tracking_sync_stopped', {enabledFromSettings: false});
    }
  }

  dispose(): void {
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
    this.lastPersistedMs = 0;
    this.lastPersistedLat = null;
    this.lastPersistedLng = null;
    this.suppressOnLocationTimestampMs = null;
    this.heartbeatInFlight = null;
    this.configured = false;
  }
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

export async function handleHeadlessLocationEvent(
  event: HeadlessEvent,
): Promise<void> {
  if (event.name !== BackgroundGeolocation.Event.Location) {
    return;
  }
  const location = event.params as Location;
  if (!isLocationLike(location)) {
    return;
  }
  await insertLocationPoint({
    timestamp: locationTimestamp(location),
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy >= 0 ? location.coords.accuracy : null,
    altitude: location.coords.altitude,
    speed:
      location.coords.speed != null && location.coords.speed >= 0
        ? location.coords.speed
        : null,
    source: toLocationSource('headless', location.event),
  }, {dedupe: true});
  await recordTrackingDiagnostic('headless_location_saved', {
    event: event.name,
    timestamp: locationTimestamp(location).toISOString(),
  });
}
