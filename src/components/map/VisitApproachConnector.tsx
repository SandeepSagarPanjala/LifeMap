import {memo, useMemo} from 'react';
import {Polyline} from 'react-native-maps';

import type {LocationPointRow} from '@/db/repositories/location-days';
import type {DetectedTrip} from '@/lib/trip-detection';
import {visitApproachConnectorCoordinates} from '@/lib/trip-detection';
import {
  VISIT_CONNECTOR_DASH_PATTERN,
  VISIT_CONNECTOR_STROKE,
  VISIT_CONNECTOR_STROKE_WIDTH,
} from '@/lib/route-map-style';

type VisitApproachConnectorProps = {
  routePoints: LocationPointRow[];
  visit: DetectedTrip;
};

export const VisitApproachConnector = memo(function VisitApproachConnector({
  routePoints,
  visit,
}: VisitApproachConnectorProps) {
  const coordinates = useMemo(
    () => visitApproachConnectorCoordinates(routePoints, visit),
    [routePoints, visit],
  );

  if (coordinates == null) {
    return null;
  }

  return (
    <Polyline
      coordinates={coordinates}
      strokeColor={VISIT_CONNECTOR_STROKE}
      strokeWidth={VISIT_CONNECTOR_STROKE_WIDTH}
      lineCap="butt"
      lineJoin="round"
      lineDashPattern={[...VISIT_CONNECTOR_DASH_PATTERN]}
      zIndex={5}
    />
  );
});
