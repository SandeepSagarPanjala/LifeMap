import type { Location } from 'react-native-background-geolocation';
import {
  isFootMotionActivity,
  isWheeledMotionActivity,
  normalizeMotionActivity,
} from '@lifemap/segmentation';

import {
  ON_FOOT_TRACKING_EXIT_HOLD_MS,
  ON_FOOT_WALK_SPEED_MAX_MS,
  TRAVEL_MODE_ACTIVITY_CONFIDENCE_MIN,
} from '@/lib/app-constants';

type FootTrackingState = {
  inFootMode: boolean;
  lastFootSignalAtMs: number | null;
};

const state: FootTrackingState = {
  inFootMode: false,
  lastFootSignalAtMs: null,
};

function locationTimestampMs(location: Location): number {
  if (location.timestamp != null) {
    return new Date(location.timestamp).getTime();
  }
  return Date.now();
}

function isLikelyWalkingSpeed(speed: number | null | undefined): boolean {
  if (speed == null || !Number.isFinite(speed) || speed < 0) {
    return true;
  }
  return speed < ON_FOOT_WALK_SPEED_MAX_MS;
}

/**
 * Classify whether denser on-foot GPS should stay active.
 * SDK activity flips between on_foot and unknown during walks — hold foot mode
 * through brief unknown/still blips while speed stays walk-like.
 */
export function updateFootTrackingMode(location: Location): boolean {
  const now = locationTimestampMs(location);
  const activity = normalizeMotionActivity(location.activity?.type);
  const confidence = location.activity?.confidence;
  const confident =
    confidence != null && confidence >= TRAVEL_MODE_ACTIVITY_CONFIDENCE_MIN;
  const speed = location.coords.speed;
  const moving = location.is_moving === true;

  if (confident && isWheeledMotionActivity(activity)) {
    state.inFootMode = false;
    state.lastFootSignalAtMs = null;
    return false;
  }

  if (confident && isFootMotionActivity(activity)) {
    state.inFootMode = true;
    state.lastFootSignalAtMs = now;
    return true;
  }

  if (activity === 'still' && confident) {
    state.inFootMode = false;
    state.lastFootSignalAtMs = null;
    return false;
  }

  if (state.inFootMode && state.lastFootSignalAtMs != null) {
    const holdElapsed = now - state.lastFootSignalAtMs;
    if (holdElapsed <= ON_FOOT_TRACKING_EXIT_HOLD_MS) {
      if (
        moving &&
        isLikelyWalkingSpeed(speed) &&
        (activity == null || activity === 'unknown' || isFootMotionActivity(activity))
      ) {
        return true;
      }
    } else {
      state.inFootMode = false;
      state.lastFootSignalAtMs = null;
    }
  }

  return state.inFootMode;
}

export function resetFootTrackingMode(): void {
  state.inFootMode = false;
  state.lastFootSignalAtMs = null;
}

export function isFootTrackingModeActive(): boolean {
  return state.inFootMode;
}
