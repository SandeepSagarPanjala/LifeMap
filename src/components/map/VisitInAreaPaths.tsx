import {memo, useMemo} from 'react';
import {Polyline} from 'react-native-maps';

import type {DetectedTrip} from '@/lib/trip-detection';
import {visitInAreaRouteSegments} from '@/lib/trip-detection';
import {
  VISIT_CONNECTOR_DASH_PATTERN,
  VISIT_CONNECTOR_STROKE,
  VISIT_CONNECTOR_STROKE_WIDTH,
} from '@/lib/route-map-style';
import type {TripDetectionConfig} from '@/lib/trip-settings';

type VisitInAreaPathsProps = {
  visit: DetectedTrip;
  tripConfig: TripDetectionConfig;
};

/** Dashed paths for movement inside the orange visit area — not the inbound drive. */
export const VisitInAreaPaths = memo(function VisitInAreaPaths({
  visit,
  tripConfig,
}: VisitInAreaPathsProps) {
  const segments = useMemo(
    () => visitInAreaRouteSegments(visit, tripConfig),
    [visit, tripConfig],
  );

  if (segments.length === 0) {
    return null;
  }

  return (
    <>
      {segments.map((coordinates, index) => (
        <Polyline
          key={`visit-in-area-${visit.id}-${index}`}
          coordinates={coordinates}
          strokeColor={VISIT_CONNECTOR_STROKE}
          strokeWidth={VISIT_CONNECTOR_STROKE_WIDTH}
          lineCap="round"
          lineJoin="round"
          lineDashPattern={[...VISIT_CONNECTOR_DASH_PATTERN]}
          zIndex={5}
        />
      ))}
    </>
  );
});
