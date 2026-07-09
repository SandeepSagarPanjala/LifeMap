import BackgroundGeolocation, {
  type Config,
} from 'react-native-background-geolocation';

import {
  HEARTBEAT_CHECK_INTERVAL_SEC,
  HEARTBEAT_CHECK_INTERVAL_SEC_MAX_RELIABILITY,
  TRACKING_ACTIVITY_RECOGNITION_INTERVAL_MS,
  TRACKING_DISTANCE_FILTER_METERS,
  TRACKING_LOCATION_UPDATE_INTERVAL_MS_BALANCED,
  TRACKING_LOCATION_UPDATE_INTERVAL_MS_MAX_RELIABILITY,
  TRACKING_MIN_ACTIVITY_RECOGNITION_CONFIDENCE,
  TRACKING_STOP_DETECTION_DELAY_MS_BALANCED,
  TRACKING_STOP_DETECTION_DELAY_MS_MAX_RELIABILITY,
  TRACKING_STOP_TIMEOUT_MINUTES_BALANCED,
  TRACKING_STATIONARY_RADIUS_M_BALANCED,
  TRACKING_STATIONARY_RADIUS_M_MAX_RELIABILITY,
} from '@/lib/app-constants';
import { APP_COPY } from '@/lib/app-copy';

const NOTIFICATION = {
  title: APP_COPY.tracking.notificationTitle,
  text: APP_COPY.tracking.notificationText,
};

const BACKGROUND_PERMISSION_RATIONALE = {
  title: APP_COPY.tracking.backgroundPermissionTitle,
  message: APP_COPY.tracking.backgroundPermissionMessage,
  positiveAction: APP_COPY.tracking.backgroundPermissionPositive,
  negativeAction: APP_COPY.tracking.backgroundPermissionNegative,
};

/** v5 compound config for ready() / setConfig(). */
export function getTrackingConfig(maxReliability: boolean): Config {
  return {
    geolocation: {
      desiredAccuracy: BackgroundGeolocation.DesiredAccuracy.High,
      distanceFilter: TRACKING_DISTANCE_FILTER_METERS,
      disableElasticity: maxReliability,
      stopTimeout: maxReliability ? 1 : TRACKING_STOP_TIMEOUT_MINUTES_BALANCED,
      pausesLocationUpdatesAutomatically: !maxReliability,
      locationAuthorizationRequest:
        BackgroundGeolocation.LocationRequest.Always,
      locationUpdateInterval: maxReliability
        ? TRACKING_LOCATION_UPDATE_INTERVAL_MS_MAX_RELIABILITY
        : TRACKING_LOCATION_UPDATE_INTERVAL_MS_BALANCED,
      fastestLocationUpdateInterval: maxReliability
        ? TRACKING_LOCATION_UPDATE_INTERVAL_MS_MAX_RELIABILITY
        : TRACKING_LOCATION_UPDATE_INTERVAL_MS_BALANCED,
      stationaryRadius: maxReliability
        ? TRACKING_STATIONARY_RADIUS_M_MAX_RELIABILITY
        : TRACKING_STATIONARY_RADIUS_M_BALANCED,
    },
    activity: {
      disableStopDetection: maxReliability,
      disableMotionActivityUpdates: false,
      stopDetectionDelay: maxReliability
        ? TRACKING_STOP_DETECTION_DELAY_MS_MAX_RELIABILITY
        : TRACKING_STOP_DETECTION_DELAY_MS_BALANCED,
      minimumActivityRecognitionConfidence:
        TRACKING_MIN_ACTIVITY_RECOGNITION_CONFIDENCE,
      activityRecognitionInterval: TRACKING_ACTIVITY_RECOGNITION_INTERVAL_MS,
      motionTriggerDelay: 0,
    },
    app: {
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      preventSuspend: maxReliability,
      heartbeatInterval: maxReliability
        ? HEARTBEAT_CHECK_INTERVAL_SEC_MAX_RELIABILITY
        : HEARTBEAT_CHECK_INTERVAL_SEC,
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
      // Debug soundFX fire on every GPS/motion/heartbeat event — unusable while walking.
      debug: false,
      logLevel: maxReliability
        ? BackgroundGeolocation.LogLevel.Info
        : BackgroundGeolocation.LogLevel.Warning,
    },
  } as Config;
}

/** @deprecated Use getTrackingConfig(maxReliability) */
export function getTrackingPresetConfig(): Record<string, unknown> {
  return getTrackingConfig(true) as Record<string, unknown>;
}
