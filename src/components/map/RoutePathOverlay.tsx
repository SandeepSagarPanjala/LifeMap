import { memo, useMemo } from 'react';

import { TravelModePolylines } from '@/components/map/TravelModePolylines';
import { useOnFootDetectionEnabled } from '@/hooks/use-on-foot-detection-enabled';
import type { LocationPointRow } from '@/db/repositories/location-days';
import { buildDrawableRouteModeLegs } from '@/lib/route-segments';
import { buildTravelModeLegs } from '@/lib/travel-mode-legs';
import {
  ROUTE_DIRECTION_ARROW_REF_ZOOM_DELTA,
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
  /**
   * Detected travel paths: draw the full point sequence (same as History).
   * Raw GPS fallback keeps gap filtering so idle spans are not connected.
   */
  continuous?: boolean;
  /** Zoom-gated direction chevrons (day-story travels when zoomed in). */
  showDirectionArrows?: boolean;
  /** Map latitudeDelta for zoom-scaled arrow size. */
  mapLatitudeDelta?: number;
};

/** Drive path overlay — continuous for known travels, gap-safe for raw GPS. */
export const RoutePathOverlay = memo(function RoutePathOverlay({
  points,
  tripConfig,
  soft = false,
  color = null,
  continuous = false,
  showDirectionArrows = false,
  mapLatitudeDelta = ROUTE_DIRECTION_ARROW_REF_ZOOM_DELTA,
}: RoutePathOverlayProps) {
  const onFootDetection = useOnFootDetectionEnabled();
  const legs = useMemo(() => {
    const options = { onFootDetection };
    if (continuous) {
      return buildTravelModeLegs(points, options);
    }
    return buildDrawableRouteModeLegs(points, tripConfig, options);
  }, [continuous, onFootDetection, points, tripConfig]);

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
      showDirectionArrows={showDirectionArrows && continuous}
      mapLatitudeDelta={mapLatitudeDelta}
    />
  );
});
