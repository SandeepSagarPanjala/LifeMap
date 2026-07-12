import { memo, useMemo } from 'react';
import { Polyline } from 'react-native-maps';

import type { LocationPointRow } from '@/db/repositories/location-days';
import { buildDrawableRouteSegments } from '@/lib/route-segments';
import {
  downsampleMapCoordinates,
  type MapCoordinate,
} from '@/lib/location-geo';
import {
  ROUTE_PATH_BORDER,
  ROUTE_PATH_BORDER_WIDTH,
  ROUTE_PATH_FILL,
  ROUTE_PATH_FILL_WIDTH,
  ROUTE_PATH_STORY_BORDER,
  ROUTE_PATH_STORY_FILL,
} from '@/lib/app-constants';
import {
  dayStoryRouteBorder,
  dayStoryRouteFill,
} from '@/lib/day-story-colors';
import type { TripDetectionConfig } from '@/lib/trip-settings';

type RoutePathOverlayProps = {
  points: LocationPointRow[];
  tripConfig: TripDetectionConfig;
  /** Softer stroke for day-story browse under numbered stops. */
  soft?: boolean;
  /** Day-story destination color (hex). When set with soft, tints the path. */
  color?: string | null;
};

/** Draws only plausible drive segments — no misleading lines across long same-place gaps. */
export const RoutePathOverlay = memo(function RoutePathOverlay({
  points,
  tripConfig,
  soft = false,
  color = null,
}: RoutePathOverlayProps) {
  const segments = useMemo(
    () => buildDrawableRouteSegments(points, tripConfig),
    [points, tripConfig],
  );

  if (segments.length === 0) {
    return null;
  }

  const fill =
    soft && color != null
      ? dayStoryRouteFill(color)
      : soft
        ? ROUTE_PATH_STORY_FILL
        : ROUTE_PATH_FILL;
  const border =
    soft && color != null
      ? dayStoryRouteBorder()
      : soft
        ? ROUTE_PATH_STORY_BORDER
        : ROUTE_PATH_BORDER;

  return (
    <>
      {segments.map((coordinates, index) => (
        <RouteSegmentPolylines
          key={`route-seg-${index}`}
          coordinates={coordinates}
          fill={fill}
          border={border}
        />
      ))}
    </>
  );
});

const RouteSegmentPolylines = memo(function RouteSegmentPolylines({
  coordinates,
  fill,
  border,
}: {
  coordinates: MapCoordinate[];
  fill: string;
  border: string;
}) {
  const displayCoordinates = useMemo(
    () => downsampleMapCoordinates(coordinates),
    [coordinates],
  );

  return (
    <>
      <Polyline
        coordinates={displayCoordinates}
        strokeColor={border}
        strokeWidth={ROUTE_PATH_BORDER_WIDTH}
        lineCap="round"
        lineJoin="round"
        zIndex={1}
      />
      <Polyline
        coordinates={displayCoordinates}
        strokeColor={fill}
        strokeWidth={ROUTE_PATH_FILL_WIDTH}
        lineCap="round"
        lineJoin="round"
        zIndex={2}
      />
    </>
  );
});
