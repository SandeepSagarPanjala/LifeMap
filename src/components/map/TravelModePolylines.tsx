import { memo, useMemo } from 'react';
import { Polyline } from 'react-native-maps';

import {
  MAX_MAP_POLYLINE_POINTS,
  TRAVEL_MODE_DASH_PATTERN,
} from '@/lib/app-constants';
import { downsampleMapCoordinates } from '@/lib/location-geo';
import type { TravelModeLeg } from '@/lib/travel-mode-legs';

type TravelModePolylinesProps = {
  legs: readonly TravelModeLeg[];
  fill: string;
  border: string;
  fillWidth: number;
  borderWidth: number;
  zBase?: number;
  keyPrefix?: string;
  /** Point budget — downsample only here (callers must not pre-downsample). */
  maxPoints?: number;
};

/** Renders travel legs with solid vehicle strokes and dashed on-foot strokes. */
export const TravelModePolylines = memo(function TravelModePolylines({
  legs,
  fill,
  border,
  fillWidth,
  borderWidth,
  zBase = 1,
  keyPrefix = 'travel-mode',
  maxPoints = MAX_MAP_POLYLINE_POINTS,
}: TravelModePolylinesProps) {
  return (
    <>
      {legs.map((leg, index) => (
        <ModeLegPolylines
          key={`${keyPrefix}-${index}-${leg.style}`}
          leg={leg}
          fill={fill}
          border={border}
          fillWidth={fillWidth}
          borderWidth={borderWidth}
          zBase={zBase}
          maxPoints={maxPoints}
        />
      ))}
    </>
  );
});

const ModeLegPolylines = memo(function ModeLegPolylines({
  leg,
  fill,
  border,
  fillWidth,
  borderWidth,
  zBase,
  maxPoints,
}: {
  leg: TravelModeLeg;
  fill: string;
  border: string;
  fillWidth: number;
  borderWidth: number;
  zBase: number;
  maxPoints: number;
}) {
  const coordinates = useMemo(
    () => downsampleMapCoordinates(leg.coordinates, maxPoints),
    [leg.coordinates, maxPoints],
  );
  const dashPattern =
    leg.style === 'dashed' ? [...TRAVEL_MODE_DASH_PATTERN] : undefined;

  if (coordinates.length < 2) {
    return null;
  }

  return (
    <>
      <Polyline
        coordinates={coordinates}
        strokeColor={border}
        strokeWidth={borderWidth}
        lineCap="round"
        lineJoin="round"
        lineDashPattern={dashPattern}
        zIndex={zBase}
      />
      <Polyline
        coordinates={coordinates}
        strokeColor={fill}
        strokeWidth={fillWidth}
        lineCap="round"
        lineJoin="round"
        lineDashPattern={dashPattern}
        zIndex={zBase + 1}
      />
    </>
  );
});
