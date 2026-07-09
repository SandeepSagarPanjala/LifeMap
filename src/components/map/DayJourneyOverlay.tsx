import type { LocationPointRow } from '@/db/repositories/location-days';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import type { DetectedTrip } from '@/lib/trip-detection';
import type { TripDetectionConfig } from '@/lib/trip-settings';

import { RoutePathOverlay } from '@/components/map/RoutePathOverlay';
import { StayAreasOverlay } from '@/components/map/StayAreasOverlay';

type DayJourneyOverlayProps = {
  travels: DetectedTrip[];
  stays: DetectedTrip[];
  tripConfig: TripDetectionConfig;
  savedPlaces?: readonly SavedPlaceRow[];
  /** Raw GPS fallback only before trip detection has produced any stays or drives. */
  fallbackPoints?: LocationPointRow[];
};

/** Default map: blue drive paths + orange visit areas (same data story as History). */
export function DayJourneyOverlay({
  travels,
  stays,
  tripConfig,
  savedPlaces = [],
  fallbackPoints = [],
}: DayJourneyOverlayProps) {
  return (
    <>
      <StayAreasOverlay
        stays={stays}
        tripConfig={tripConfig}
        savedPlaces={savedPlaces}
      />
      {travels.length > 0 ? (
        travels.map(travel => (
          <RoutePathOverlay
            key={travel.id}
            points={travel.points}
            tripConfig={tripConfig}
          />
        ))
      ) : stays.length === 0 && fallbackPoints.length > 0 ? (
        <RoutePathOverlay points={fallbackPoints} tripConfig={tripConfig} />
      ) : null}
    </>
  );
}
