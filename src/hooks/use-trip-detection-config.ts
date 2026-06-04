import {useMemo} from 'react';

import {
  buildTripDetectionConfigFromPreferences,
  normalizeTripDwellMinutes,
  normalizeTripRadiusMeters,
  type TripDetectionConfig,
} from '@/lib/trip-settings';
import {useAppStore} from '@/stores/app-store';

export function useTripDetectionConfig(): TripDetectionConfig {
  const dwellMinutes = useAppStore(state =>
    normalizeTripDwellMinutes(state.tripDwellMinutes),
  );
  const dwellRadiusMeters = useAppStore(state =>
    normalizeTripRadiusMeters(state.tripDwellRadiusMeters),
  );

  return useMemo(
    () => buildTripDetectionConfigFromPreferences(dwellMinutes, dwellRadiusMeters),
    [dwellMinutes, dwellRadiusMeters],
  );
}
