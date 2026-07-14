import type { Location } from 'react-native-background-geolocation';

import type { NewLocationPoint } from '@/db/repositories/location-points';

function nonNegative(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

function finiteOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

/** Map Transistor Soft Location extras we persist for future travel-mode work. */
export function sdkLocationExtras(
  location: Location,
): Pick<
  NewLocationPoint,
  | 'heading'
  | 'headingAccuracy'
  | 'speedAccuracy'
  | 'altitudeAccuracy'
  | 'activityType'
  | 'activityConfidence'
  | 'isMoving'
  | 'isMock'
  | 'uuid'
  | 'batteryLevel'
  | 'batteryIsCharging'
> {
  const { coords } = location;
  const activity = location.activity;
  const battery = location.battery;

  return {
    heading: finiteOrNull(coords.heading),
    headingAccuracy: nonNegative(coords.heading_accuracy),
    speedAccuracy: nonNegative(coords.speed_accuracy),
    altitudeAccuracy: nonNegative(coords.altitude_accuracy),
    activityType: activity?.type?.trim() ? activity.type.trim() : null,
    activityConfidence:
      activity?.confidence != null && Number.isFinite(activity.confidence)
        ? Math.round(activity.confidence)
        : null,
    isMoving: typeof location.is_moving === 'boolean' ? location.is_moving : null,
    isMock: typeof location.mock === 'boolean' ? location.mock : null,
    uuid: location.uuid?.trim() ? location.uuid.trim() : null,
    batteryLevel: nonNegative(battery?.level),
    batteryIsCharging:
      typeof battery?.is_charging === 'boolean' ? battery.is_charging : null,
  };
}
