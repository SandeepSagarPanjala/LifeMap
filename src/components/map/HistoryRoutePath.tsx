import { memo, useMemo } from 'react';

import { useOnFootDetectionEnabled } from '@/hooks/use-on-foot-detection-enabled';
import { TravelModePolylines } from '@/components/map/TravelModePolylines';
import type { LocationPointRow } from '@/db/repositories/location-days';
import { buildTravelModeLegs } from '@/lib/travel-mode-legs';
import { isSparseTravelRoute } from '@/lib/trip-detection';
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
  const onFootDetection = useOnFootDetectionEnabled();
  const legs = useMemo(
    () => buildTravelModeLegs(points, { onFootDetection }),
    [onFootDetection, points],
  );

  if (legs.length === 0 || isSparseTravelRoute(points)) {
    return null;
  }

  const routeBorder =
    tone === 'past' ? HISTORY_PAST_ROUTE_BORDER : HISTORY_FUTURE_ROUTE_BORDER;
  const routeFill =
    tone === 'past' ? HISTORY_PAST_ROUTE_FILL : HISTORY_FUTURE_ROUTE_FILL;
  const zBase = tone === 'past' ? 0 : 1;

  return (
    <TravelModePolylines
      keyPrefix={pathKey}
      legs={legs}
      fill={routeFill}
      border={routeBorder}
      fillWidth={HISTORY_GHOST_ROUTE_FILL_WIDTH}
      borderWidth={HISTORY_GHOST_ROUTE_BORDER_WIDTH}
      zBase={zBase}
    />
  );
});
