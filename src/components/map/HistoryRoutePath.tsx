import {memo, useMemo} from 'react';
import {Polyline} from 'react-native-maps';

import type {LocationPointRow} from '@/db/repositories/location-days';
import {toDisplayMapCoordinates} from '@/lib/location-geo';
import {isSparseTravelRoute} from '@/lib/trip-detection';
import {
  HISTORY_FUTURE_ROUTE_BORDER,
  HISTORY_FUTURE_ROUTE_FILL,
  HISTORY_GHOST_ROUTE_BORDER_WIDTH,
  HISTORY_GHOST_ROUTE_FILL_WIDTH,
  HISTORY_PAST_ROUTE_BORDER,
  HISTORY_PAST_ROUTE_FILL,
} from '@/lib/app-constants';

type HistoryRoutePathProps = {
  points: LocationPointRow[];
  tone: 'past' | 'future';
  pathKey: string;
};

export const HistoryRoutePath = memo(function HistoryRoutePath({
  points,
  tone,
  pathKey,
}: HistoryRoutePathProps) {
  const coordinates = useMemo(
    () => toDisplayMapCoordinates(points),
    [points],
  );

  if (coordinates.length < 2 || isSparseTravelRoute(points)) {
    return null;
  }

  const routeBorder =
    tone === 'past' ? HISTORY_PAST_ROUTE_BORDER : HISTORY_FUTURE_ROUTE_BORDER;
  const routeFill =
    tone === 'past' ? HISTORY_PAST_ROUTE_FILL : HISTORY_FUTURE_ROUTE_FILL;
  const zBase = tone === 'past' ? 0 : 1;

  return (
    <>
      <Polyline
        key={`${pathKey}-border`}
        coordinates={coordinates}
        strokeColor={routeBorder}
        strokeWidth={HISTORY_GHOST_ROUTE_BORDER_WIDTH}
        lineCap="round"
        lineJoin="round"
        zIndex={zBase}
      />
      <Polyline
        key={`${pathKey}-fill`}
        coordinates={coordinates}
        strokeColor={routeFill}
        strokeWidth={HISTORY_GHOST_ROUTE_FILL_WIDTH}
        lineCap="round"
        lineJoin="round"
        zIndex={zBase + 1}
      />
    </>
  );
});
