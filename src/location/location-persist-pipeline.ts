import BackgroundGeolocation, {type Location} from 'react-native-background-geolocation';

import {
  nativeDrainTransistorQueue,
  nativePersistLocation,
} from '@/location/native-location-persist';

import {
  getLatestLocationPoint,
  insertLocationPoint,
} from '@/db/repositories/location-points';
import {evaluateDepartureWatchdog} from '@/lib/departure-watchdog';
import {
  isExactDuplicatePersist,
  shouldSkipMotionPersist,
  type LastPersistedFix,
} from '@/lib/location-save-guard';
import {
  DEPARTURE_WATCHDOG_MIN_MS,
  HEARTBEAT_CURRENT_POSITION_REQUEST,
  STATIONARY_PING_MIN_MS,
  STATIONARY_PING_MIN_MS_MAX_RELIABILITY,
} from '@/lib/motion-tracking-policy';
import {recordTrackingDiagnostic} from '@/lib/tracking-diagnostics';

export function locationTimestamp(location: Location): Date {
  const value = location.timestamp as string | number | Date;
  return value instanceof Date ? value : new Date(value);
}

export function isSampleLocation(location: Location): boolean {
  return (location as Location & {sample?: boolean}).sample === true;
}

export function isLocationLike(value: unknown): value is Location {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as {coords?: {latitude?: number; longitude?: number}};
  return (
    candidate.coords?.latitude != null &&
    candidate.coords?.longitude != null
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
  options?: {dedupe?: boolean; allowRapidMotion?: boolean},
): Promise<boolean> {
  const timestamp = locationTimestamp(location);
  const {coords} = location;
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
    shouldSkipMotionPersist(last, coords, timestampMs)
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
    },
    {dedupe: options?.dedupe},
  );
  return true;
}

export async function drainNativeLocationQueue(): Promise<number> {
  const nativeImported = await nativeDrainTransistorQueue();
  const pending = (await BackgroundGeolocation.getLocations()) as Location[];
  if (pending.length === 0) {
    if (nativeImported > 0) {
      await recordTrackingDiagnostic('native_queue_drained', {
        queuedCount: 0,
        importedCount: nativeImported,
        nativeSwiftDrain: nativeImported,
      });
    }
    return nativeImported;
  }

  let imported = nativeImported;
  for (const item of pending) {
    if (!isLocationLike(item) || isSampleLocation(item)) {
      continue;
    }
    const source = toLocationSource('native_queue', item.event);
    const saved = await persistLocationFromSdk(item, source, {dedupe: true});
    if (saved) {
      imported += 1;
    }
  }
  await BackgroundGeolocation.destroyLocations();
  await recordTrackingDiagnostic('native_queue_drained', {
    queuedCount: pending.length,
    importedCount: imported,
    nativeSwiftDrain: nativeImported,
  });
  return imported;
}

async function forceMovingMode(
  reason: string,
  details: Record<string, unknown>,
): Promise<void> {
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

  if (maxReliability && sinceLastSaveMs >= DEPARTURE_WATCHDOG_MIN_MS) {
    await forceMovingMode('heartbeat_stale_wake', {sinceLastSaveMs});
  }

  try {
    const location = await BackgroundGeolocation.getCurrentPosition(
      HEARTBEAT_CURRENT_POSITION_REQUEST,
    );
    if (!isLocationLike(location) || isSampleLocation(location)) {
      return null;
    }

    const {coords} = location;
    const evaluation = evaluateDepartureWatchdog(
      {
        sinceLastSaveMs,
        lastSaved: last,
        fresh: {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy >= 0 ? coords.accuracy : null,
          speed: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
        },
      },
      {stationaryPingMinMs},
    );

    if (evaluation.forceMoving) {
      await forceMovingMode(evaluation.reason, {
        distanceMeters: evaluation.distanceMeters,
        sinceLastSaveMs,
        speed: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
      });
    }

    if (evaluation.shouldPersist) {
      const saved = await persistLocationFromSdk(location, evaluation.source, {
        dedupe: true,
        allowRapidMotion: true,
      });
      if (saved) {
        await recordTrackingDiagnostic(
          evaluation.source === 'heartbeat_ping'
            ? 'heartbeat_saved'
            : 'heartbeat_departure_saved',
          {
            reason: evaluation.reason,
            distanceMeters: evaluation.distanceMeters,
            timestamp: locationTimestamp(location).toISOString(),
            maxReliability,
          },
        );
        return locationTimestamp(location).getTime();
      }
      return null;
    }

    await recordTrackingDiagnostic('heartbeat_checked', {
      reason: evaluation.reason,
      distanceMeters: evaluation.distanceMeters,
      sinceLastSaveMs,
      maxReliability,
    });
    return null;
  } catch (error) {
    const imported = await drainNativeLocationQueue();
    await recordTrackingDiagnostic('heartbeat_error', {
      message: error instanceof Error ? error.message : 'unknown',
      nativeQueueImported: imported,
      sinceLastSaveMs,
      maxReliability,
    });
    return null;
  }
}

export async function handleMotionChangePersist(
  isMoving: boolean,
  location: Location | null | undefined,
): Promise<void> {
  if (!location || !isLocationLike(location) || isSampleLocation(location)) {
    await recordTrackingDiagnostic('motion_change', {
      isMoving,
      hasLocation: location != null,
    });
    return;
  }

  await recordTrackingDiagnostic('motion_change', {
    isMoving,
    hasLocation: true,
    timestamp: locationTimestamp(location).toISOString(),
  });

  if (isMoving) {
    await forceMovingMode('motion_departure', {
      speed: location.coords.speed,
      accuracy: location.coords.accuracy,
    });
    const saved = await persistLocationFromSdk(location, 'motion_departure', {
      dedupe: true,
      allowRapidMotion: true,
    });
    if (saved) {
      await recordTrackingDiagnostic('motion_departure_saved', {
        timestamp: locationTimestamp(location).toISOString(),
      });
    }
    return;
  }

  const saved = await persistLocationFromSdk(location, 'motion_arrival', {
    dedupe: true,
    allowRapidMotion: true,
  });
  if (saved) {
    await recordTrackingDiagnostic('motion_arrival_saved', {
      timestamp: locationTimestamp(location).toISOString(),
    });
  }
}
