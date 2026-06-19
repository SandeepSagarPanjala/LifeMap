import BackgroundGeolocation, {
  type HeadlessEvent,
  type Location,
  type MotionChangeEvent,
  type Subscription,
} from 'react-native-background-geolocation';

import { getSetting, setSetting } from '@/db/repositories/settings';
import {
  drainNativeLocationQueue,
  handleMotionChangePersist,
  isLocationLike,
  isSampleLocation,
  locationTimestamp,
  persistLocationFromSdk,
  runLocationHeartbeat,
  toLocationSource,
} from '@/location/location-persist-pipeline';
import { DRIVE_GPS_WAKE_SPEED_MS } from '@/lib/motion-tracking-policy';
import { recordTrackingDiagnostic } from '@/lib/tracking-diagnostics';
import {
  createTrackingMotionGuardState,
  resetDepartureWake,
  resetTrackingMotionGuardState,
  shouldApplyDepartureWake,
  shouldLogMotionChange,
  type TrackingMotionGuardState,
} from '@/lib/tracking-diagnostic-guards';
import {
  getTrackingConfig,
  SETTINGS_KEY_TRACKING_ENABLED,
  SETTINGS_KEY_TRACKING_MAX_RELIABILITY,
  TRACKING_DISTANCE_FILTER_METERS,
} from '@/lib/tracking-presets';

import type {
  LocationAuthorizationStatus,
  LocationService,
  LocationServiceState,
} from './types';

function mapAuthorizationStatus(status: number): LocationAuthorizationStatus {
  const { AuthorizationStatus } = BackgroundGeolocation;

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

async function readMaxReliability(): Promise<boolean> {
  const stored = await getSetting(SETTINGS_KEY_TRACKING_MAX_RELIABILITY);
  if (stored === null) {
    return true;
  }
  return stored === 'true';
}

export class TransistorSoftLocationService implements LocationService {
  private configured = false;
  private subscriptions: Subscription[] = [];
  private heartbeatInFlight: Promise<number | null> | null = null;
  private motionInFlight: Promise<void> | null = null;
  private suppressOnLocationTimestampMs: number | null = null;
  private readonly motionGuard: TrackingMotionGuardState =
    createTrackingMotionGuardState();
  private lastProviderSignature: string | null = null;

  async drainNativeQueue(): Promise<void> {
    await drainNativeLocationQueue();
  }

  async refreshPersistPipeline(): Promise<number | null> {
    const maxReliability = await readMaxReliability();
    const savedTimestampMs = await runLocationHeartbeat(maxReliability);
    if (savedTimestampMs != null) {
      this.suppressOnLocationTimestampMs = savedTimestampMs;
    }
    return savedTimestampMs;
  }

  async applyTrackingProfile(maxReliability?: boolean): Promise<void> {
    const enabled = maxReliability ?? (await readMaxReliability());
    if (!this.configured) {
      return;
    }
    await BackgroundGeolocation.setConfig(getTrackingConfig(enabled));
    await recordTrackingDiagnostic('tracking_profile_applied', {
      maxReliability: enabled,
      distanceFilterMeters: TRACKING_DISTANCE_FILTER_METERS,
    });
  }

  private async onHeartbeat(): Promise<number | null> {
    if (this.heartbeatInFlight != null) {
      return this.heartbeatInFlight;
    }
    this.heartbeatInFlight = this.refreshPersistPipeline().finally(() => {
      this.heartbeatInFlight = null;
    });
    return this.heartbeatInFlight;
  }

  private async maybeWakeFromSpeed(location: Location): Promise<void> {
    if (!shouldApplyDepartureWake(this.motionGuard)) {
      return;
    }
    const speed = location.coords.speed;
    if (speed == null || speed < DRIVE_GPS_WAKE_SPEED_MS) {
      return;
    }
    const accuracy = location.coords.accuracy;
    if (accuracy >= 0 && accuracy > 75) {
      return;
    }
    try {
      await BackgroundGeolocation.changePace(true);
      await recordTrackingDiagnostic('gps_speed_wake', {
        speed,
        accuracy: accuracy >= 0 ? accuracy : null,
      });
    } catch (error) {
      resetDepartureWake(this.motionGuard);
      if (__DEV__) {
        console.warn('[LifeMap] changePace(true) from GPS speed failed', error);
      }
    }
  }

  private async onMotionChange(event: MotionChangeEvent): Promise<void> {
    if (this.motionInFlight != null) {
      return this.motionInFlight;
    }
    this.motionInFlight = this.runMotionChange(event).finally(() => {
      this.motionInFlight = null;
    });
    return this.motionInFlight;
  }

  private async runMotionChange(event: MotionChangeEvent): Promise<void> {
    if (shouldLogMotionChange(this.motionGuard, event.isMoving)) {
      await recordTrackingDiagnostic('motion_change', {
        isMoving: event.isMoving,
        hasLocation: event.location != null,
      });
    }
    await handleMotionChangePersist(event.isMoving, event.location);
  }

  async configure(): Promise<void> {
    if (this.configured) {
      return;
    }

    if ((await getSetting(SETTINGS_KEY_TRACKING_MAX_RELIABILITY)) === null) {
      await setSetting(SETTINGS_KEY_TRACKING_MAX_RELIABILITY, 'true');
    }

    const maxReliability = await readMaxReliability();
    const config = getTrackingConfig(maxReliability);
    await recordTrackingDiagnostic('tracking_configure', {
      distanceFilterMeters: TRACKING_DISTANCE_FILTER_METERS,
      maxReliability,
    });

    this.subscriptions.push(
      BackgroundGeolocation.onLocation(async location => {
        if (isSampleLocation(location)) {
          return;
        }
        const timestampMs = locationTimestamp(location).getTime();
        if (
          this.suppressOnLocationTimestampMs != null &&
          this.suppressOnLocationTimestampMs === timestampMs
        ) {
          this.suppressOnLocationTimestampMs = null;
          return;
        }
        try {
          await this.maybeWakeFromSpeed(location);
          await persistLocationFromSdk(location, 'gps', { dedupe: true });
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
        const signature = JSON.stringify({
          enabled: provider.enabled,
          status: provider.status,
          gps: provider.gps,
          network: provider.network,
        });
        if (signature === this.lastProviderSignature) {
          return;
        }
        this.lastProviderSignature = signature;
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

    await BackgroundGeolocation.ready(config);
    await drainNativeLocationQueue();

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

  /** After start(), the SDK defaults to STATIONARY — force MOVING when max reliability is on. */
  private async forceMovingAfterStart(reason: string): Promise<void> {
    if (!(await readMaxReliability())) {
      return;
    }

    try {
      await BackgroundGeolocation.changePace(true);
      shouldApplyDepartureWake(this.motionGuard);
      await recordTrackingDiagnostic('start_force_moving', { reason });
    } catch (error) {
      resetDepartureWake(this.motionGuard);
      await recordTrackingDiagnostic('start_force_moving_error', {
        reason,
        message: error instanceof Error ? error.message : 'unknown',
      });
      if (__DEV__) {
        console.warn('[LifeMap] changePace(true) after start failed', error);
      }
    }
  }

  async start(): Promise<void> {
    await BackgroundGeolocation.start();
    await drainNativeLocationQueue();
    await this.forceMovingAfterStart('user_start');
    await setSetting(SETTINGS_KEY_TRACKING_ENABLED, 'true');
    await recordTrackingDiagnostic('tracking_enabled', { enabled: true });
  }

  async stop(): Promise<void> {
    await BackgroundGeolocation.stop();
    await setSetting(SETTINGS_KEY_TRACKING_ENABLED, 'false');
    await recordTrackingDiagnostic('tracking_enabled', { enabled: false });
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
      await drainNativeLocationQueue();
      await recordTrackingDiagnostic('tracking_sync_started', {
        enabledFromSettings: true,
      });
    }

    if (!enabled && state.enabled) {
      await BackgroundGeolocation.stop();
      await recordTrackingDiagnostic('tracking_sync_stopped', {
        enabledFromSettings: false,
      });
    }

    await this.applyTrackingProfile();

    if (enabled) {
      const current = await BackgroundGeolocation.getState();
      if (current.enabled) {
        await this.forceMovingAfterStart('bootstrap');
      }
    }
  }

  dispose(): void {
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
    this.suppressOnLocationTimestampMs = null;
    this.heartbeatInFlight = null;
    this.motionInFlight = null;
    this.configured = false;
    this.lastProviderSignature = null;
    resetTrackingMotionGuardState(this.motionGuard);
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
  const maxReliability = await readMaxReliability();

  switch (event.name) {
    case BackgroundGeolocation.Event.Location: {
      const location = event.params as Location;
      if (!isLocationLike(location) || isSampleLocation(location)) {
        return;
      }
      const saved = await persistLocationFromSdk(
        location,
        toLocationSource('headless', location.event),
        { dedupe: true },
      );
      if (saved) {
        await recordTrackingDiagnostic('headless_location_saved', {
          event: event.name,
          timestamp: locationTimestamp(location).toISOString(),
        });
      }
      return;
    }
    case BackgroundGeolocation.Event.Heartbeat: {
      await runLocationHeartbeat(maxReliability);
      return;
    }
    case BackgroundGeolocation.Event.MotionChange: {
      const motion = event.params as MotionChangeEvent;
      await handleMotionChangePersist(motion.isMoving, motion.location);
      return;
    }
    default:
      return;
  }
}
