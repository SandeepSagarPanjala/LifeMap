import type { LocationPointRow } from '@/db/repositories/location-days';
import { type MapCoordinate } from '@/lib/location-geo';
import {
  splitTravelModeRuns,
  type TravelModePathKind,
  type TravelModeStyle,
} from '@lifemap/segmentation';

export type TravelModeLeg = {
  style: TravelModeStyle;
  coordinates: MapCoordinate[];
};

function toCoordinates(points: readonly LocationPointRow[]): MapCoordinate[] {
  return points.map(point => ({
    latitude: point.lat,
    longitude: point.lng,
  }));
}

/**
 * Drive path legs: solid vehicle + dashed closed on-foot walks.
 * Pass `pathKind: 'stay'` to force solid (never dash inside a visit).
 */
export function buildTravelModeLegs(
  points: readonly LocationPointRow[],
  options?: { pathKind?: TravelModePathKind },
): TravelModeLeg[] {
  return splitTravelModeRuns(points, {
    pathKind: options?.pathKind ?? 'drive',
  }).map(run => ({
    style: run.style,
    coordinates: toCoordinates(run.points),
  }));
}
