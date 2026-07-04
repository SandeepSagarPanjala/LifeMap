import {useMemo} from 'react';

import {
  DEFAULT_TRIP_DWELL_MINUTES,
  DEFAULT_TRIP_GAP_MINUTES,
  HISTORY_SAME_PLACE_RADIUS_METERS,
} from '@/lib/app-constants';
import {buildTripDetectionConfig, type TripDetectionConfig} from '@/lib/trip-settings';

/** Fixed visit/drive rules for map history (not user-configurable in Settings). */
export function useTripDetectionConfig(): TripDetectionConfig {
  return useMemo(
    () =>
      buildTripDetectionConfig(
        DEFAULT_TRIP_GAP_MINUTES,
        DEFAULT_TRIP_DWELL_MINUTES,
        HISTORY_SAME_PLACE_RADIUS_METERS,
      ),
    [],
  );
}
