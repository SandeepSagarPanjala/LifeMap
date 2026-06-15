import {
  buildTripDetectionConfig,
  DEFAULT_TRIP_DWELL_MINUTES,
  DEFAULT_TRIP_GAP_MINUTES,
  HISTORY_SAME_PLACE_RADIUS_METERS,
} from '@/lib/trip-settings';

import type {TripDetectionConfig} from '@/lib/trip-settings';

/** Trip detection config (safe outside React — matches useTripDetectionConfig). */
export function getCurrentTripDetectionConfig(): TripDetectionConfig {
  return buildTripDetectionConfig(
    DEFAULT_TRIP_GAP_MINUTES,
    DEFAULT_TRIP_DWELL_MINUTES,
    HISTORY_SAME_PLACE_RADIUS_METERS,
  );
}
