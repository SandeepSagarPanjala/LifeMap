import type {LocationPointRow} from '@/db/repositories/location-days';
import type {DetectedTrip} from '@/lib/trip-detection';
import type {TripDetectionConfig} from '@/lib/trip-settings';

import {RoutePathOverlay} from '@/components/map/RoutePathOverlay';
import {StayAreasOverlay} from '@/components/map/StayAreasOverlay';

type DayJourneyOverlayProps = {
  points: LocationPointRow[];
  stays: DetectedTrip[];
  tripConfig: TripDetectionConfig;
};

/** Default map: blue drive paths + orange visit areas (same data story as History). */
export function DayJourneyOverlay({
  points,
  stays,
  tripConfig,
}: DayJourneyOverlayProps) {
  return (
    <>
      <StayAreasOverlay stays={stays} tripConfig={tripConfig} />
      <RoutePathOverlay points={points} tripConfig={tripConfig} />
    </>
  );
}
