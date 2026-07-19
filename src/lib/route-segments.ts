import type { LocationPointRow } from '@/db/repositories/location-days';
import { distanceKm, type MapCoordinate } from '@/lib/location-geo';
import {
  MAX_PLAUSIBLE_SPEED_MS,
  SAME_PLACE_LINE_BREAK_MS,
} from '@/lib/app-constants';
import type { TripDetectionConfig } from '@/lib/trip-settings';
import { isStoredRoutePoints } from '@/lib/trip-geometry';
import {
  buildTravelModeLegs,
  type TravelModeLeg,
} from '@/lib/travel-mode-legs';

function shouldConnectPoints(
  a: LocationPointRow,
  b: LocationPointRow,
  dwellRadiusMeters: number,
  tripGapMs: number,
): boolean {
  const dtMs = b.timestamp.getTime() - a.timestamp.getTime();
  if (dtMs <= 0) {
    return false;
  }

  const distM = distanceKm(a, b) * 1000;

  if (distM > dwellRadiusMeters) {
    const speedMs = distM / (dtMs / 1000);
    return speedMs >= 1.2 && speedMs <= MAX_PLAUSIBLE_SPEED_MS;
  }

  if (dtMs >= tripGapMs) {
    return false;
  }

  if (dtMs >= SAME_PLACE_LINE_BREAK_MS && distM < 50) {
    return false;
  }

  const speedMs = distM / (dtMs / 1000);
  return speedMs <= MAX_PLAUSIBLE_SPEED_MS;
}

function splitDrawablePointGroups(
  points: LocationPointRow[],
  config: TripDetectionConfig,
): LocationPointRow[][] {
  if (points.length < 2) {
    return points.length === 1 ? [points] : [];
  }

  // trip_points use evenly spaced fake timestamps — speed heuristics break the line.
  if (isStoredRoutePoints(points)) {
    return [points];
  }

  const sorted = [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const tripGapMs = config.gapMinutes * 60_000;
  const groups: LocationPointRow[][] = [];
  let current: LocationPointRow[] = [sorted[0]!];

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const point = sorted[index]!;

    if (
      shouldConnectPoints(previous, point, config.dwellRadiusMeters, tripGapMs)
    ) {
      current.push(point);
    } else {
      if (current.length >= 1) {
        groups.push(current);
      }
      current = [point];
    }
  }

  if (current.length >= 1) {
    groups.push(current);
  }

  return groups.filter(group => group.length >= 2);
}

/** Split today's points into polylines that should not mislead (no 4 hr line for 25 m). */
export function buildDrawableRouteSegments(
  points: LocationPointRow[],
  config: TripDetectionConfig,
): MapCoordinate[][] {
  return splitDrawablePointGroups(points, config).map(group =>
    group.map(point => ({
      latitude: point.lat,
      longitude: point.lng,
    })),
  );
}

/** Gap-safe groups, then solid travel-mode legs within each. */
export function buildDrawableRouteModeLegs(
  points: LocationPointRow[],
  config: TripDetectionConfig,
): TravelModeLeg[] {
  const groups = splitDrawablePointGroups(points, config);
  const legs: TravelModeLeg[] = [];
  for (const group of groups) {
    legs.push(...buildTravelModeLegs(group));
  }
  return legs.filter(leg => leg.coordinates.length >= 2);
}
