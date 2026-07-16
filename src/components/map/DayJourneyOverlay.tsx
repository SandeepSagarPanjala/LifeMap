import { memo, useMemo } from 'react';

import type { LocationPointRow } from '@/db/repositories/location-days';
import type { MomentRow } from '@/db/repositories/moments';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import type { DayTimelineEntry, DetectedTrip } from '@/lib/trip-detection';
import type { TripDetectionConfig } from '@/lib/trip-settings';
import type { DayStoryStop } from '@/lib/day-story-stops';
import { originVisitNumberForTravel } from '@/lib/day-story-stops';
import { dayStoryColorForVisit } from '@/lib/day-story-colors';
import type { MomentCountType } from '@/lib/moments/moment-counts';

import { DayStoryStopsOverlay } from '@/components/map/DayStoryStopsOverlay';
import { RoutePathOverlay } from '@/components/map/RoutePathOverlay';

type DayJourneyOverlayProps = {
  travels: DetectedTrip[];
  /** Prebuilt day-story stops from the map controller. */
  stops: readonly DayStoryStop[];
  tripConfig: TripDetectionConfig;
  savedPlaces?: readonly SavedPlaceRow[];
  /** Raw GPS fallback only before trip detection has produced any stays or drives. */
  fallbackPoints?: LocationPointRow[];
  dayMoments?: readonly MomentRow[];
  historyEntries?: readonly DayTimelineEntry[];
  hideSavedPlaceId?: number | null;
  /** Zoom-gated direction chevrons on detected travels. */
  showDirectionArrows?: boolean;
  mapLatitudeDelta?: number;
  onPressStoryMomentType?: (
    stop: DayStoryStop,
    type: MomentCountType,
  ) => void;
  onPressStoryStay?: (stay: DetectedTrip) => void;
};

function visitNumbersByStayId(
  stops: readonly DayStoryStop[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const stop of stops) {
    for (let i = 0; i < stop.stayIds.length; i += 1) {
      const stayId = stop.stayIds[i];
      const visitNumber = stop.visitNumbers[i];
      if (stayId != null && visitNumber != null) {
        map.set(stayId, visitNumber);
      }
    }
  }
  return map;
}

/**
 * History-closed day browse: soft drive paths + numbered story stops.
 * Drive tint matches the origin visit number color (leave stop 1 → path uses 1's color).
 */
export const DayJourneyOverlay = memo(function DayJourneyOverlay({
  travels,
  stops,
  tripConfig,
  savedPlaces = [],
  fallbackPoints = [],
  dayMoments = [],
  historyEntries = [],
  hideSavedPlaceId = null,
  showDirectionArrows = false,
  mapLatitudeDelta,
  onPressStoryMomentType,
  onPressStoryStay,
}: DayJourneyOverlayProps) {
  const visitByStayId = useMemo(() => visitNumbersByStayId(stops), [stops]);

  const travelColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const travel of travels) {
      const originVisit = originVisitNumberForTravel(
        historyEntries,
        travel.id,
        visitByStayId,
      );
      if (originVisit != null) {
        map.set(travel.id, dayStoryColorForVisit(originVisit));
      }
    }
    return map;
  }, [travels, historyEntries, visitByStayId]);

  return (
    <>
      {travels.length > 0 ? (
        travels.map(travel => (
          <RoutePathOverlay
            key={travel.id}
            points={travel.points}
            tripConfig={tripConfig}
            soft
            continuous
            showDirectionArrows={showDirectionArrows}
            mapLatitudeDelta={mapLatitudeDelta}
            color={travelColors.get(travel.id) ?? null}
          />
        ))
      ) : stops.length === 0 && fallbackPoints.length > 0 ? (
        <RoutePathOverlay
          points={fallbackPoints}
          tripConfig={tripConfig}
          soft
        />
      ) : null}
      <DayStoryStopsOverlay
        stops={stops}
        savedPlaces={savedPlaces}
        dayMoments={dayMoments}
        historyPoints={fallbackPoints}
        historyEntries={historyEntries}
        dwellRadiusMeters={tripConfig.dwellRadiusMeters}
        hideSavedPlaceId={hideSavedPlaceId}
        onPressMomentType={onPressStoryMomentType}
        onPressStay={onPressStoryStay}
      />
    </>
  );
});
