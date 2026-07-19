import { Fragment, memo, useMemo } from 'react';
import { Polyline } from 'react-native-maps';

import {
  MAX_MAP_POLYLINE_POINTS,
  ROUTE_DIRECTION_ARROW_COLOR,
  ROUTE_DIRECTION_ARROW_REF_ZOOM_DELTA,
  ROUTE_DIRECTION_ARROW_STROKE_WIDTH,
  TRAVEL_FOOT_BORDER_WIDTH,
  TRAVEL_FOOT_DASH_PATTERN,
  TRAVEL_FOOT_FILL_WIDTH,
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

/** Renders travel path polylines (solid drive, dashed closed walks). */
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

  const isDashed = leg.style === 'dashed';
  // Walks: thin fine dashes (not the thick dual-stroke drive casing).
  const strokeFillWidth = isDashed ? TRAVEL_FOOT_FILL_WIDTH : fillWidth;
  const strokeBorderWidth = isDashed ? TRAVEL_FOOT_BORDER_WIDTH : borderWidth;
  const dashPattern = isDashed ? [...TRAVEL_FOOT_DASH_PATTERN] : undefined;
  const lineCap = isDashed ? 'butt' : 'round';

  return (
    <>
      <Polyline
        coordinates={coordinates}
        strokeColor={border}
        strokeWidth={strokeBorderWidth}
        lineCap={lineCap}
        lineJoin="round"
        lineDashPattern={dashPattern}
        zIndex={zBase}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor={fill}
        strokeWidth={strokeFillWidth}
        lineCap={lineCap}
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
