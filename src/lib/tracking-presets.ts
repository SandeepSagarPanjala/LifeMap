import BackgroundGeolocation from 'react-native-background-geolocation';

import {HEARTBEAT_CHECK_INTERVAL_SEC} from '@/lib/motion-tracking-policy';

/** Fixed SDK distance filter — every fix the SDK sends is saved. */
export const TRACKING_DISTANCE_FILTER_METERS = 25;

export const SETTINGS_KEY_TRACKING_ENABLED = 'tracking_enabled';

/**
 * Reserved for a future "Maximum reliability" toggle (`disableStopDetection`).
 * Not wired yet — enable only if departure watchdog still misses drives in testing.
 */
export const SETTINGS_KEY_TRACKING_MAX_RELIABILITY = 'tracking_max_reliability';

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
    /** iOS grace period before stop-detection engages (ms). */
    stopDetectionDelay: 5 * 60_000,
    heartbeatInterval: HEARTBEAT_CHECK_INTERVAL_SEC,
    preventSuspend: true,
    pausesLocationUpdatesAutomatically: false,
  };
}
