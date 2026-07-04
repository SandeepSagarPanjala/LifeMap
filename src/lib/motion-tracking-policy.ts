import {HEARTBEAT_DESIRED_ACCURACY_METERS} from '@/lib/app-constants';

/** Stopping threshold for heartbeat getCurrentPosition — see CurrentPositionRequest. */
export const HEARTBEAT_CURRENT_POSITION_REQUEST = {
  desiredAccuracy: HEARTBEAT_DESIRED_ACCURACY_METERS,
  timeout: 30,
  maximumAge: 0,
  samples: 1,
  persist: false,
} as const;
