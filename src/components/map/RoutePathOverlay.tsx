import { memo, useMemo } from 'react';

import { TravelModePolylines } from '@/components/map/TravelModePolylines';
import type { LocationPointRow } from '@/db/repositories/location-days';
import { buildDrawableRouteModeLegs } from '@/lib/route-segments';
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
  /** Day-story origin visit color (hex). When set with soft, tints the path. */
  color?: string | null;
};

/** Draws only plausible drive segments — no misleading lines across long same-place gaps. */
export const RoutePathOverlay = memo(function RoutePathOverlay({
  points,
  tripConfig,
  soft = false,
  color = null,
}: RoutePathOverlayProps) {
  const legs = useMemo(
    () => buildDrawableRouteModeLegs(points, tripConfig),
    [points, tripConfig],
  );

  if (legs.length === 0) {
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
    <TravelModePolylines
      legs={legs}
      fill={fill}
      border={border}
      fillWidth={ROUTE_PATH_FILL_WIDTH}
      borderWidth={ROUTE_PATH_BORDER_WIDTH}
    />
  );
});
