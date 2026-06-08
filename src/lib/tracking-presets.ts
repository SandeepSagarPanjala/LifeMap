import BackgroundGeolocation from 'react-native-background-geolocation';

import {HEARTBEAT_CHECK_INTERVAL_SEC} from '@/lib/motion-tracking-policy';

/** Fixed SDK distance filter — every fix the SDK sends is saved. */
export const TRACKING_DISTANCE_FILTER_METERS = 25;

export const SETTINGS_KEY_TRACKING_ENABLED = 'tracking_enabled';

/** @deprecated Legacy settings key; all installs now use the fixed 25 m config. */
export const SETTINGS_KEY_TRACKING_PRESET = 'tracking_preset';

export function getTrackingPresetConfig(): Record<string, unknown> {
  return {
    desiredAccuracy: BackgroundGeolocation.DesiredAccuracy.High,
    distanceFilter: TRACKING_DISTANCE_FILTER_METERS,
    locationUpdateInterval: 60_000,
    fastestLocationUpdateInterval: 60_000,
    disableElasticity: false,
    stopTimeout: 30,
    disableStopDetection: false,
    disableMotionActivityUpdates: false,
    heartbeatInterval: HEARTBEAT_CHECK_INTERVAL_SEC,
    preventSuspend: true,
    pausesLocationUpdatesAutomatically: false,
  };
}
