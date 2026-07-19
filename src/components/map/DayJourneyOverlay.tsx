import { memo, useMemo } from 'react';
import { Polyline } from 'react-native-maps';

import type { LocationPointRow } from '@/db/repositories/location-days';
import type { MomentRow } from '@/db/repositories/moments';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import type { DayTimelineEntry, DetectedTrip } from '@/lib/trip-detection';
import type { TripDetectionConfig } from '@/lib/trip-settings';
import type { DayStoryStop } from '@/lib/day-story-stops';
import {
  chronologicalStayVisitNumbers,
  originVisitNumberForTravel,
} from '@/lib/day-story-stops';
import {
  dayStoryColorForVisit,
  dayStoryRouteBorder,
  dayStoryRouteFill,
} from '@/lib/day-story-colors';
import { buildDayStoryStayConnectors } from '@/lib/day-story-stay-connectors';
import { travelDisplayPointsForTimeline } from '@/lib/history-map-plan';
import type { MomentCountType } from '@/lib/moments/moment-counts';
import {
  VISIT_CONNECTOR_DASH_PATTERN,
  VISIT_CONNECTOR_STROKE_WIDTH,
} from '@/lib/app-constants';

import { DayStoryStopsOverlay } from '@/components/map/DayStoryStopsOverlay';
import { RoutePathOverlay } from '@/components/map/RoutePathOverlay';

type DayJourneyOverlayProps = {
  travels: DetectedTrip[];
  stops: readonly DayStoryStop[];
  tripConfig: TripDetectionConfig;
  savedPlaces?: readonly SavedPlaceRow[];
  fallbackPoints?: LocationPointRow[];
  dayMoments?: readonly MomentRow[];
  historyEntries?: readonly DayTimelineEntry[];
  hideSavedPlaceId?: number | null;
  showDirectionArrows?: boolean;
  mapLatitudeDelta?: number;
  onPressStoryMomentType?: (
    stop: DayStoryStop,
    type: MomentCountType,
  ) => void;
  onPressStoryStay?: (stay: DetectedTrip) => void;
};

/**
 * History-closed day browse: History drive edges + numbered stops + dashed
 * pin connectors (core start→pin, pin→core end).
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
  const visitByStayId = useMemo(() => {
    const stays = historyEntries.filter(
      (e): e is DetectedTrip => e.kind === 'stay',
    );
    return chronologicalStayVisitNumbers(
      stays.length > 0 ? stays : stops.flatMap(s => s.stays),
    );
  }, [historyEntries, stops]);

  const travelPaths = useMemo(
    () =>
      travels.map(travel => {
        const originVisit = originVisitNumberForTravel(
          historyEntries,
          travel.id,
          visitByStayId,
        );
        return {
          travel,
          points: travelDisplayPointsForTimeline(
            travel,
            historyEntries,
            tripConfig,
          ),
          color:
            originVisit != null ? dayStoryColorForVisit(originVisit) : null,
        };
      }),
    [travels, historyEntries, tripConfig, visitByStayId],
  );

  const connectors = useMemo(
    () => buildDayStoryStayConnectors(stops, historyEntries),
    [stops, historyEntries],
  );
  const dash = useMemo(() => [...VISIT_CONNECTOR_DASH_PATTERN], []);

  return (
    <>
      {travelPaths.length > 0 ? (
        travelPaths.map(({ travel, points, color }) => (
          <RoutePathOverlay
            key={travel.id}
            points={points}
            tripConfig={tripConfig}
            soft
            continuous
            showDirectionArrows={showDirectionArrows}
            mapLatitudeDelta={mapLatitudeDelta}
            color={color}
          />
        ))
      ) : stops.length === 0 && fallbackPoints.length > 0 ? (
        <RoutePathOverlay
          points={fallbackPoints}
          tripConfig={tripConfig}
          soft
        />
      ) : null}

      {connectors.map(connector => (
        <Polyline
          key={`${connector.key}-border`}
          coordinates={connector.coordinates}
          strokeColor={dayStoryRouteBorder(0.55)}
          strokeWidth={VISIT_CONNECTOR_STROKE_WIDTH + 2.5}
          lineCap="round"
          lineJoin="round"
          lineDashPattern={dash}
          zIndex={2}
        />
      ))}
      {connectors.map(connector => (
        <Polyline
          key={`${connector.key}-fill`}
          coordinates={connector.coordinates}
          strokeColor={dayStoryRouteFill(connector.color, 0.85)}
          strokeWidth={VISIT_CONNECTOR_STROKE_WIDTH}
          lineCap="round"
          lineJoin="round"
          lineDashPattern={dash}
          zIndex={3}
        />
      ))}

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
