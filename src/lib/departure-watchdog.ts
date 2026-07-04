import {distanceKm, type LocationPointLike} from '@/lib/location-geo';
import {
  DEPARTURE_WATCHDOG_MIN_MS,
  HEARTBEAT_DEPARTURE_DISTANCE_METERS,
  MAX_DEPARTURE_ACCURACY_METERS,
  MIN_DEPARTURE_SPEED_MS,
  STATIONARY_PING_MIN_MS,
} from '@/lib/app-constants';

export type FreshLocationSample = LocationPointLike & {
  accuracy: number | null;
  speed: number | null;
};

export type DepartureWatchdogInput = {
  sinceLastSaveMs: number;
  lastSaved: LocationPointLike | null;
  fresh: FreshLocationSample;
  stationaryPingMinMs?: number;
  departureWatchdogMinMs?: number;
};

export type DepartureWatchdogResult = {
  forceMoving: boolean;
  shouldPersist: boolean;
  source: string;
  reason:
    | 'distance_threshold'
    | 'speed_watchdog'
    | 'stationary_ping'
    | 'recent_save'
    | 'no_baseline';
  distanceMeters: number | null;
};

function distanceMeters(
  lastSaved: LocationPointLike,
  fresh: LocationPointLike,
): number {
  return distanceKm(lastSaved, fresh) * 1000;
}

function suggestsMovement(fresh: FreshLocationSample): boolean {
  if (fresh.speed == null || fresh.speed < MIN_DEPARTURE_SPEED_MS) {
    return false;
  }
  if (fresh.accuracy != null && fresh.accuracy > MAX_DEPARTURE_ACCURACY_METERS) {
    return false;
  }
  return true;
}

/** Decide whether heartbeat should wake GPS and/or persist a fresh fix. */
export function evaluateDepartureWatchdog(
  input: DepartureWatchdogInput,
): DepartureWatchdogResult {
  const {sinceLastSaveMs, lastSaved, fresh} = input;
  const stationaryPingMinMs =
    input.stationaryPingMinMs ?? STATIONARY_PING_MIN_MS;
  const departureWatchdogMinMs =
    input.departureWatchdogMinMs ?? DEPARTURE_WATCHDOG_MIN_MS;

  if (lastSaved == null) {
    return {
      forceMoving: false,
      shouldPersist: sinceLastSaveMs >= stationaryPingMinMs,
      source: 'heartbeat_ping',
      reason: 'no_baseline',
      distanceMeters: null,
    };
  }

  const driftMeters = distanceMeters(lastSaved, fresh);

  if (driftMeters >= HEARTBEAT_DEPARTURE_DISTANCE_METERS) {
    return {
      forceMoving: true,
      shouldPersist: true,
      source: 'heartbeat_departure',
      reason: 'distance_threshold',
      distanceMeters: driftMeters,
    };
  }

  if (sinceLastSaveMs >= departureWatchdogMinMs && suggestsMovement(fresh)) {
    return {
      forceMoving: true,
      shouldPersist: true,
      source: 'heartbeat_departure',
      reason: 'speed_watchdog',
      distanceMeters: driftMeters,
    };
  }

  if (sinceLastSaveMs >= stationaryPingMinMs) {
    return {
      forceMoving: false,
      shouldPersist: true,
      source: 'heartbeat_ping',
      reason: 'stationary_ping',
      distanceMeters: driftMeters,
    };
  }

  return {
    forceMoving: false,
    shouldPersist: false,
    source: 'heartbeat_checked',
    reason: 'recent_save',
    distanceMeters: driftMeters,
  };
}
