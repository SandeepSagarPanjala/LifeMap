import BackgroundGeolocation, {
  type Location,
} from 'react-native-background-geolocation';

import {
  nativeDrainTransistorQueue,
  nativePersistLocation,
} from '@/location/native-location-persist';

import {
  getLatestLocationPoint,
  insertLocationPoint,
} from '@/db/repositories/location-points';
import { evaluateDepartureWatchdog } from '@/lib/departure-watchdog';
import {
  isExactDuplicatePersist,
  shouldSkipMotionPersist,
  type LastPersistedFix,
} from '@/lib/location-save-guard';
import {
  DEPARTURE_WATCHDOG_MIN_MS,
  DEPARTURE_WATCHDOG_MIN_MS_MAX_RELIABILITY,
  STATIONARY_PING_MIN_MS,
  STATIONARY_PING_MIN_MS_MAX_RELIABILITY,
} from '@/lib/app-constants';
import { HEARTBEAT_CURRENT_POSITION_REQUEST } from '@/lib/motion-tracking-policy';
import { sdkLocationExtras } from '@/lib/sdk-location-extras';
import {
  createTrackingMotionGuardState,
  resetDepartureWake,
  shouldApplyDepartureWake,
  type TrackingMotionGuardState,
} from '@/lib/tracking-diagnostic-guards';

const departureWakeGuard: TrackingMotionGuardState =
  createTrackingMotionGuardState();

export function locationTimestamp(location: Location): Date {
  const value = location.timestamp as string | number | Date;
  return value instanceof Date ? value : new Date(value);
}

export function isSampleLocation(location: Location): boolean {
  return (location as Location & { sample?: boolean }).sample === true;
}

export function isLocationLike(value: unknown): value is Location {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as {
    coords?: { latitude?: number; longitude?: number };
  };
  return (
    candidate.coords?.latitude != null && candidate.coords?.longitude != null
  );
}

export function toLocationSource(base: string, eventName?: string): string {
  if (!eventName) {
    return base;
  }
  return `${base}:${String(eventName).toLowerCase()}`;
}

export async function loadLastPersistedFix(): Promise<LastPersistedFix | null> {
  const latest = await getLatestLocationPoint();
  if (latest?.timestamp == null) {
    return null;
  }
  return {
    timestampMs: latest.timestamp.getTime(),
    lat: latest.lat,
    lng: latest.lng,
  };
}

export async function persistLocationFromSdk(
  location: Location,
  source: string,
  options?: { dedupe?: boolean; allowRapidMotion?: boolean },
): Promise<boolean> {
  const timestamp = locationTimestamp(location);
  const { coords } = location;
  const timestampMs = timestamp.getTime();
  const last = await loadLastPersistedFix();

  if (
    isExactDuplicatePersist(
      last,
      timestampMs,
      coords.latitude,
      coords.longitude,
    )
  ) {
    return false;
  }

  if (
    !options?.allowRapidMotion &&
    (source === 'motion' ||
      source.startsWith('motion') ||
      source.startsWith('headless:motion')) &&
    shouldSkipMotionPersist(
      last,
      { lat: coords.latitude, lng: coords.longitude },
      timestampMs,
    )
  ) {
    return false;
  }

  void nativePersistLocation(location, source).catch(() => undefined);

  await insertLocationPoint(
    {
      timestamp,
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy >= 0 ? coords.accuracy : null,
      altitude: coords.altitude,
      speed: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
      source,
      ...sdkLocationExtras(location),
    },
    { dedupe: options?.dedupe },
  );
  return true;
}

let drainNativeLocationQueueInFlight: Promise<number> | null = null;

export async function drainNativeLocationQueue(): Promise<number> {
  if (drainNativeLocationQueueInFlight != null) {
    return drainNativeLocationQueueInFlight;
  }
  drainNativeLocationQueueInFlight = drainNativeLocationQueueImpl().finally(
    () => {
      drainNativeLocationQueueInFlight = null;
    },
  );
  return drainNativeLocationQueueInFlight;
}

async function drainNativeLocationQueueImpl(): Promise<number> {
  const nativeImported = await nativeDrainTransistorQueue();
  const pending = (await BackgroundGeolocation.getLocations()) as Location[];
  if (pending.length === 0) {
    return nativeImported;
  }

  let imported = nativeImported;
  for (const item of pending) {
    if (!isLocationLike(item) || isSampleLocation(item)) {
      continue;
    }
    const source = toLocationSource('native_queue', item.event);
    try {
      const saved = await persistLocationFromSdk(item, source, {
        dedupe: true,
      });
      if (saved) {
        imported += 1;
      }
    } catch {
      // Best-effort — continue draining remaining queue items.
    }
  }
  await BackgroundGeolocation.destroyLocations();
  return imported;
}

async function forceMovingMode(): Promise<void> {
  if (!shouldApplyDepartureWake(departureWakeGuard)) {
    return;
  }

  try {
    await BackgroundGeolocation.changePace(true);
  } catch {
    resetDepartureWake(departureWakeGuard);
  }
}

export async function runLocationHeartbeat(
  maxReliability: boolean,
): Promise<number | null> {
  await drainNativeLocationQueue();

  const last = await loadLastPersistedFix();
  const sinceLastSaveMs =
    last == null ? Number.POSITIVE_INFINITY : Date.now() - last.timestampMs;
  const stationaryPingMinMs = maxReliability
    ? STATIONARY_PING_MIN_MS_MAX_RELIABILITY
    : STATIONARY_PING_MIN_MS;
  const departureWatchdogMinMs = maxReliability
    ? DEPARTURE_WATCHDOG_MIN_MS_MAX_RELIABILITY
    : DEPARTURE_WATCHDOG_MIN_MS;

  if (sinceLastSaveMs >= departureWatchdogMinMs) {
    await forceMovingMode();
  }

  try {
    const location = await BackgroundGeolocation.getCurrentPosition(
      HEARTBEAT_CURRENT_POSITION_REQUEST,
    );
    if (!isLocationLike(location) || isSampleLocation(location)) {
      return null;
    }

    const { coords } = location;
    const evaluation = evaluateDepartureWatchdog({
      sinceLastSaveMs,
      lastSaved: last,
      fresh: {
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy >= 0 ? coords.accuracy : null,
        speed: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
      },
      stationaryPingMinMs,
      departureWatchdogMinMs,
    });

    if (evaluation.forceMoving) {
      await forceMovingMode();
    }

    if (evaluation.shouldPersist) {
      const saved = await persistLocationFromSdk(location, evaluation.source, {
        dedupe: true,
        allowRapidMotion: true,
      });
      if (saved) {
        return locationTimestamp(location).getTime();
      }
      return null;
    }

    return null;
  } catch {
    await drainNativeLocationQueue();
    return null;
  }
}

export async function handleMotionChangePersist(
  isMoving: boolean,
  location: Location | null | undefined,
): Promise<void> {
  if (!location || !isLocationLike(location) || isSampleLocation(location)) {
    return;
  }

  if (isMoving) {
    await forceMovingMode();
    await persistLocationFromSdk(location, 'motion_departure', {
      dedupe: true,
      allowRapidMotion: true,
    });
    return;
  }

  resetDepartureWake(departureWakeGuard);

  await persistLocationFromSdk(location, 'motion_arrival', {
    dedupe: true,
    allowRapidMotion: true,
  });
}
