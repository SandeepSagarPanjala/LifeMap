import BackgroundGeolocation, {type Config} from 'react-native-background-geolocation';

import {HEARTBEAT_CHECK_INTERVAL_SEC} from '@/lib/motion-tracking-policy';

/** SDK distance filter while MOVING — every qualifying fix is saved. */
export const TRACKING_DISTANCE_FILTER_METERS = 10;

export const SETTINGS_KEY_TRACKING_ENABLED = 'tracking_enabled';
export const SETTINGS_KEY_TRACKING_MAX_RELIABILITY = 'tracking_max_reliability';

/** @deprecated Legacy settings key; all installs now use the fixed config. */
export const SETTINGS_KEY_TRACKING_PRESET = 'tracking_preset';

const STOP_TIMEOUT_MINUTES = 5;
const STOP_DETECTION_DELAY_MS = 60_000;

const NOTIFICATION = {
  title: 'LifeMap',
  text: 'Recording your day privately on this device',
};

const BACKGROUND_PERMISSION_RATIONALE = {
  title: 'Allow LifeMap to track in the background?',
  message:
    'LifeMap needs always-on location so your timeline stays complete when the app is closed. Everything stays encrypted on your phone.',
  positiveAction: 'Change to Always',
  negativeAction: 'Cancel',
};

/** v5 compound config for ready() / setConfig(). */
export function getTrackingConfig(maxReliability: boolean): Config {
  return {
    geolocation: {
      desiredAccuracy: BackgroundGeolocation.DesiredAccuracy.High,
      distanceFilter: TRACKING_DISTANCE_FILTER_METERS,
      disableElasticity: false,
      stopTimeout: STOP_TIMEOUT_MINUTES,
      pausesLocationUpdatesAutomatically: !maxReliability,
      locationAuthorizationRequest: BackgroundGeolocation.LocationRequest.Always,
      locationUpdateInterval: 60_000,
      fastestLocationUpdateInterval: 60_000,
    },
    activity: {
      disableStopDetection: maxReliability,
      disableMotionActivityUpdates: false,
      stopDetectionDelay: STOP_DETECTION_DELAY_MS,
      minimumActivityRecognitionConfidence: 55,
      activityRecognitionInterval: 5000,
      motionTriggerDelay: 0,
    },
    app: {
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      preventSuspend: maxReliability,
      heartbeatInterval: HEARTBEAT_CHECK_INTERVAL_SEC,
      foregroundService: true,
      notification: NOTIFICATION,
      backgroundPermissionRationale: BACKGROUND_PERMISSION_RATIONALE,
    },
    http: {
      autoSync: false,
      batchSync: false,
    },
    persistence: {
      maxRecordsToPersist: -1,
    },
    logger: {
      debug: false,
      logLevel: BackgroundGeolocation.LogLevel.Warning,
    },
  };
}

/** @deprecated Use getTrackingConfig(maxReliability) */
export function getTrackingPresetConfig(): Record<string, unknown> {
  return getTrackingConfig(true) as Record<string, unknown>;
}
