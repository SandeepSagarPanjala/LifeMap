import {Circle} from 'react-native-maps';

import {buildStayMapCircles} from '@/lib/stay-map';
import type {DetectedTrip} from '@/lib/trip-detection';
import {
  STAY_AREA_FILL,
  STAY_AREA_FILL_EMPHASIS,
  STAY_AREA_STROKE,
  STAY_AREA_STROKE_EMPHASIS,
  STAY_AREA_STROKE_WIDTH,
} from '@/lib/route-map-style';
import type {TripDetectionConfig} from '@/lib/trip-settings';

type StayAreasOverlayProps = {
  stays: DetectedTrip[];
  tripConfig: TripDetectionConfig;
  /** History scrub — single selected visit. */
  emphasized?: boolean;
};

/** Orange translucent visit areas — no labels (details live in History). */
export function StayAreasOverlay({
  stays,
  tripConfig,
  emphasized = false,
}: StayAreasOverlayProps) {
  const circles = buildStayMapCircles(stays, tripConfig.dwellRadiusMeters);
  const fillColor = emphasized ? STAY_AREA_FILL_EMPHASIS : STAY_AREA_FILL;
  const strokeColor = emphasized ? STAY_AREA_STROKE_EMPHASIS : STAY_AREA_STROKE;

  if (circles.length === 0) {
    return null;
  }

  return (
    <>
      {circles.map(circle => (
        <Circle
          key={circle.key}
          center={circle.center}
          radius={circle.radiusMeters}
          fillColor={fillColor}
          strokeColor={strokeColor}
          strokeWidth={STAY_AREA_STROKE_WIDTH}
          zIndex={emphasized ? 2 : 0}
        />
      ))}
    </>
  );
}
