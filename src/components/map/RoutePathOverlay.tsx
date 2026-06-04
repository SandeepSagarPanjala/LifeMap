import {Polyline} from 'react-native-maps';

import type {LocationPointRow} from '@/db/repositories/location-days';
import {toMapCoordinates} from '@/lib/location-geo';
import {
  ROUTE_PATH_BORDER,
  ROUTE_PATH_BORDER_WIDTH,
  ROUTE_PATH_FILL,
  ROUTE_PATH_FILL_WIDTH,
} from '@/lib/route-map-style';

type RoutePathOverlayProps = {
  points: LocationPointRow[];
};

/** Continuous path through saved GPS points — gray fill, white border, no mid-line dots. */
export function RoutePathOverlay({points}: RoutePathOverlayProps) {
  const coordinates = toMapCoordinates(points);

  if (coordinates.length < 2) {
    return null;
  }

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
