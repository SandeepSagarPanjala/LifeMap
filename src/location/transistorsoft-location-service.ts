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
import { DRIVE_GPS_WAKE_SPEED_MS } from '@/lib/app-constants';
import {
  resetFootTrackingMode,
  updateFootTrackingMode,
} from '@/lib/foot-tracking-mode';
import { getOnFootDetectionEnabledSync } from '@/lib/on-foot-detection-settings';
import {
  createTrackingMotionGuardState,
  resetDepartureWake,
  resetTrackingMotionGuardState,
  shouldApplyDepartureWake,
  shouldLogMotionChange,
  type TrackingMotionGuardState,
} from '@/lib/tracking-diagnostic-guards';
import { getTrackingConfig } from '@/lib/tracking-presets';
import { SETTINGS_KEY_TRACKING_ENABLED } from '@/lib/app-constants';

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
  return true;
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
  private footModeActive = false;

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

  async applyTrackingProfile(
    maxReliability?: boolean,
    options: { onFoot?: boolean } = {},
  ): Promise<void> {
    const enabled = maxReliability ?? (await readMaxReliability());
    if (!this.configured) {
      return;
    }
    const onFootDetection = getOnFootDetectionEnabledSync();
    if (!onFootDetection && this.footModeActive) {
      this.footModeActive = false;
      resetFootTrackingMode();
    }
    const onFoot =
      onFootDetection && (options.onFoot ?? this.footModeActive);
    await BackgroundGeolocation.setConfig(
      getTrackingConfig(enabled, { onFoot }),
    );
  }

  private async maybeApplyFootTrackingProfile(
    location: Location,
  ): Promise<void> {
    if (!getOnFootDetectionEnabledSync()) {
      if (this.footModeActive) {
        this.footModeActive = false;
        resetFootTrackingMode();
        await this.applyTrackingProfile();
      }
      return;
    }

    const nextFootMode = updateFootTrackingMode(location);
    if (nextFootMode === this.footModeActive) {
      return;
    }
    this.footModeActive = nextFootMode;
    await this.applyTrackingProfile(undefined, { onFoot: nextFootMode });
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
    shouldLogMotionChange(this.motionGuard, event.isMoving);
    await handleMotionChangePersist(event.isMoving, event.location);
  }

  async configure(): Promise<void> {
    if (this.configured) {
      return;
    }

    const maxReliability = await readMaxReliability();
    const config = getTrackingConfig(maxReliability);

    try {
      await BackgroundGeolocation.ready(config);

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
            await this.maybeApplyFootTrackingProfile(location);
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
        }),
      );

      await drainNativeLocationQueue();
      this.configured = true;
    } catch (error) {
      this.dispose();
      throw error;
    }
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
    };
  }

  /** After start(), the SDK defaults to STATIONARY — force MOVING when max reliability is on. */
  private async forceMovingAfterStart(): Promise<void> {
    if (!(await readMaxReliability())) {
      return;
    }

    try {
      await BackgroundGeolocation.changePace(true);
      shouldApplyDepartureWake(this.motionGuard);
    } catch (error) {
      resetDepartureWake(this.motionGuard);
      if (__DEV__) {
        console.warn('[LifeMap] changePace(true) after start failed', error);
      }
    }
  }

  async start(): Promise<void> {
    await BackgroundGeolocation.start();
    await drainNativeLocationQueue();
    await this.forceMovingAfterStart();
    await setSetting(SETTINGS_KEY_TRACKING_ENABLED, 'true');
  }

  async stop(): Promise<void> {
    await BackgroundGeolocation.stop();
    await setSetting(SETTINGS_KEY_TRACKING_ENABLED, 'false');
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
    }

    if (!enabled && state.enabled) {
      await BackgroundGeolocation.stop();
    }

    await this.applyTrackingProfile();

    if (enabled) {
      const current = await BackgroundGeolocation.getState();
      if (current.enabled) {
        await this.forceMovingAfterStart();
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
    this.footModeActive = false;
    resetFootTrackingMode();
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
      await persistLocationFromSdk(
        location,
        toLocationSource('headless', location.event),
        { dedupe: true },
      );
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
