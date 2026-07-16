import { Fragment, memo, useMemo } from 'react';
import { Polyline } from 'react-native-maps';

import {
  MAX_MAP_POLYLINE_POINTS,
  ROUTE_DIRECTION_ARROW_COLOR,
  ROUTE_DIRECTION_ARROW_REF_ZOOM_DELTA,
  ROUTE_DIRECTION_ARROW_STROKE_WIDTH,
  TRAVEL_MODE_DASH_PATTERN,
} from '@/lib/app-constants';
import { downsampleMapCoordinates } from '@/lib/location-geo';
import {
  routeDirectionArrowSizeForZoom,
  routeDirectionArrowSpacingForZoom,
  sampleRouteDirectionArrows,
} from '@/lib/route-direction-arrows';
import type { TravelModeLeg } from '@/lib/travel-mode-legs';

type TravelModePolylinesProps = {
  legs: readonly TravelModeLeg[];
  fill: string;
  border: string;
  fillWidth: number;
  borderWidth: number;
  zBase?: number;
  keyPrefix?: string;
  /** Point budget — downsample only here (callers must not pre-downsample). */
  maxPoints?: number;
  /** Always on for detected travels; size scales with mapLatitudeDelta. */
  showDirectionArrows?: boolean;
  /** Current map latitudeDelta — scales arrow ground size with zoom. */
  mapLatitudeDelta?: number;
};

/** Renders travel legs with solid vehicle strokes and dashed on-foot strokes. */
export const TravelModePolylines = memo(function TravelModePolylines({
  legs,
  fill,
  border,
  fillWidth,
  borderWidth,
  zBase = 1,
  keyPrefix = 'travel-mode',
  maxPoints = MAX_MAP_POLYLINE_POINTS,
  showDirectionArrows = false,
  mapLatitudeDelta = ROUTE_DIRECTION_ARROW_REF_ZOOM_DELTA,
}: TravelModePolylinesProps) {
  return (
    <>
      {legs.map((leg, index) => (
        <ModeLegPolylines
          key={`${keyPrefix}-${index}-${leg.style}`}
          leg={leg}
          fill={fill}
          border={border}
          fillWidth={fillWidth}
          borderWidth={borderWidth}
          zBase={zBase}
          maxPoints={maxPoints}
          showDirectionArrows={showDirectionArrows}
          mapLatitudeDelta={mapLatitudeDelta}
          keyPrefix={`${keyPrefix}-${index}`}
        />
      ))}
    </>
  );
});

const ModeLegPolylines = memo(function ModeLegPolylines({
  leg,
  fill,
  border,
  fillWidth,
  borderWidth,
  zBase,
  maxPoints,
  showDirectionArrows,
  mapLatitudeDelta,
  keyPrefix,
}: {
  leg: TravelModeLeg;
  fill: string;
  border: string;
  fillWidth: number;
  borderWidth: number;
  zBase: number;
  maxPoints: number;
  showDirectionArrows: boolean;
  mapLatitudeDelta: number;
  keyPrefix: string;
}) {
  const coordinates = useMemo(
    () => downsampleMapCoordinates(leg.coordinates, maxPoints),
    [leg.coordinates, maxPoints],
  );
  const dashPattern =
    leg.style === 'dashed' ? [...TRAVEL_MODE_DASH_PATTERN] : undefined;
  const arrows = useMemo(() => {
    if (!showDirectionArrows) {
      return [];
    }
    return sampleRouteDirectionArrows(coordinates, {
      arrowSizeM: routeDirectionArrowSizeForZoom(mapLatitudeDelta),
      spacingM: routeDirectionArrowSpacingForZoom(mapLatitudeDelta),
    });
  }, [coordinates, mapLatitudeDelta, showDirectionArrows]);

  if (coordinates.length < 2) {
    return null;
  }

  return (
    <>
      <Polyline
        coordinates={coordinates}
        strokeColor={border}
        strokeWidth={borderWidth}
        lineCap="round"
        lineJoin="round"
        lineDashPattern={dashPattern}
        zIndex={zBase}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor={fill}
        strokeWidth={fillWidth}
        lineCap="round"
        lineJoin="round"
        lineDashPattern={dashPattern}
        zIndex={zBase + 1}
      />
      {arrows.map((arrow, arrowIndex) => (
        <Fragment key={`${keyPrefix}-arrow-${arrowIndex}`}>
          <Polyline
            coordinates={arrow.shaft}
            strokeColor={ROUTE_DIRECTION_ARROW_COLOR}
            strokeWidth={ROUTE_DIRECTION_ARROW_STROKE_WIDTH}
            lineCap="butt"
            lineJoin="miter"
            zIndex={zBase + 2}
          />
          <Polyline
            coordinates={arrow.chevron}
            strokeColor={ROUTE_DIRECTION_ARROW_COLOR}
            strokeWidth={ROUTE_DIRECTION_ARROW_STROKE_WIDTH}
            lineCap="butt"
            lineJoin="miter"
            zIndex={zBase + 2}
          />
        </Fragment>
      ))}
    </>
  );
});
