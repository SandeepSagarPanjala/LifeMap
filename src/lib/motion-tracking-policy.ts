import {
  HEARTBEAT_DESIRED_ACCURACY_METERS,
  RECENTER_DESIRED_ACCURACY_METERS,
} from '@/lib/app-constants';

/** Stopping threshold for heartbeat getCurrentPosition — see CurrentPositionRequest. */
export const HEARTBEAT_CURRENT_POSITION_REQUEST = {
  desiredAccuracy: HEARTBEAT_DESIRED_ACCURACY_METERS,
  timeout: 30,
  maximumAge: 0,
  samples: 1,
  persist: false,
} as const;

/**
 * On-demand fix for the "go to current location" button. Forces a fresh,
 * high-accuracy GPS read (maximumAge 0) so recenter never lands on a stale
 * near-home fix while the user is driving.
 */
export const RECENTER_CURRENT_POSITION_REQUEST = {
  desiredAccuracy: RECENTER_DESIRED_ACCURACY_METERS,
  timeout: 15,
  maximumAge: 0,
  samples: 2,
  persist: false,
} as const;
