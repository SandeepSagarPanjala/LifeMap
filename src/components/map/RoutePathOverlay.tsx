import {Polyline} from 'react-native-maps';

import type {LocationPointRow} from '@/db/repositories/location-days';
import {buildDrawableRouteSegments} from '@/lib/route-segments';
import {
  ROUTE_PATH_BORDER,
  ROUTE_PATH_BORDER_WIDTH,
  ROUTE_PATH_FILL,
  ROUTE_PATH_FILL_WIDTH,
} from '@/lib/route-map-style';
import type {TripDetectionConfig} from '@/lib/trip-settings';

type RoutePathOverlayProps = {
  points: LocationPointRow[];
  tripConfig: TripDetectionConfig;
};

/** Draws only plausible drive segments — no misleading lines across long same-place gaps. */
export function RoutePathOverlay({points, tripConfig}: RoutePathOverlayProps) {
  const segments = buildDrawableRouteSegments(points, tripConfig);

  if (segments.length === 0) {
    return null;
  }

  return (
    <>
      {segments.map((coordinates, index) => (
        <RouteSegmentPolylines key={`route-seg-${index}`} coordinates={coordinates} />
      ))}
    </>
  );
}

function RouteSegmentPolylines({
  coordinates,
}: {
  coordinates: {latitude: number; longitude: number}[];
}) {
  return (
    <>
      <Polyline
        coordinates={coordinates}
        strokeColor={ROUTE_PATH_BORDER}
        strokeWidth={ROUTE_PATH_BORDER_WIDTH}
        lineCap="round"
        lineJoin="round"
        zIndex={1}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor={ROUTE_PATH_FILL}
        strokeWidth={ROUTE_PATH_FILL_WIDTH}
        lineCap="round"
        lineJoin="round"
        zIndex={2}
      />
    </>
  );
}
