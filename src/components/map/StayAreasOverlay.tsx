import {Circle} from 'react-native-maps';

import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {buildStayMapCircles} from '@/lib/stay-map';
import type {DetectedTrip} from '@/lib/trip-detection';
import {
  HISTORY_FUTURE_STAY_FILL,
  HISTORY_FUTURE_STAY_STROKE,
  HISTORY_PAST_STAY_FILL,
  HISTORY_PAST_STAY_STROKE,
  STAY_AREA_FILL,
  STAY_AREA_FILL_EMPHASIS,
  STAY_AREA_STROKE,
  STAY_AREA_STROKE_EMPHASIS,
  STAY_AREA_STROKE_WIDTH,
} from '@/lib/app-constants';
import type {TripDetectionConfig} from '@/lib/trip-settings';

export type StayAreasTone = 'default' | 'emphasized' | 'past' | 'future';

type StayAreasOverlayProps = {
  stays: DetectedTrip[];
  tripConfig: TripDetectionConfig;
  savedPlaces?: readonly SavedPlaceRow[];
  /** History scrub — single selected visit. */
  emphasized?: boolean;
  tone?: StayAreasTone;
};

const STAY_TONE_COLORS: Record<
  StayAreasTone,
  {fill: string; stroke: string; zIndex: number}
> = {
  default: {
    fill: STAY_AREA_FILL,
    stroke: STAY_AREA_STROKE,
    zIndex: 0,
  },
  emphasized: {
    fill: STAY_AREA_FILL_EMPHASIS,
    stroke: STAY_AREA_STROKE_EMPHASIS,
    zIndex: 2,
  },
  past: {
    fill: HISTORY_PAST_STAY_FILL,
    stroke: HISTORY_PAST_STAY_STROKE,
    zIndex: 0,
  },
  future: {
    fill: HISTORY_FUTURE_STAY_FILL,
    stroke: HISTORY_FUTURE_STAY_STROKE,
    zIndex: 1,
  },
};

/** Orange translucent visit areas — no labels (details live in History). */
export function StayAreasOverlay({
  stays,
  tripConfig,
  savedPlaces = [],
  emphasized = false,
  tone,
}: StayAreasOverlayProps) {
  const circles = buildStayMapCircles(
    stays,
    tripConfig.dwellRadiusMeters,
    savedPlaces,
  );
  const resolvedTone = tone ?? (emphasized ? 'emphasized' : 'default');
  const {fill: fillColor, stroke: strokeColor, zIndex} =
    STAY_TONE_COLORS[resolvedTone];

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
          zIndex={zIndex}
        />
      ))}
    </>
  );
}
