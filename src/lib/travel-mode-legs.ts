import {
  TRAVEL_MODE_DASH_MIN_DURATION_MS,
  TRAVEL_MODE_DASH_MIN_PATH_M,
} from '@/lib/app-constants';
import { distanceKm, type MapCoordinate } from '@/lib/location-geo';
import type { LocationPointRow } from '@/db/repositories/location-days';
import {
  travelStrokeForActivity,
  type TravelStrokeStyle,
} from '@lifemap/segmentation';

export type TravelModeLeg = {
  style: TravelStrokeStyle;
  coordinates: MapCoordinate[];
};

type StrokeRun = {
  style: TravelStrokeStyle;
  points: LocationPointRow[];
};

function pathLengthM(points: readonly LocationPointRow[]): number {
  let pathM = 0;
  for (let i = 1; i < points.length; i += 1) {
    pathM += distanceKm(points[i - 1]!, points[i]!) * 1000;
  }
  return pathM;
}

function durationMs(points: readonly LocationPointRow[]): number {
  if (points.length < 2) {
    return 0;
  }
  return (
    points[points.length - 1]!.timestamp.getTime() -
    points[0]!.timestamp.getTime()
  );
}

function toCoordinates(points: readonly LocationPointRow[]): MapCoordinate[] {
  return points.map(point => ({
    latitude: point.lat,
    longitude: point.lng,
  }));
}

function splitStrokeRuns(points: readonly LocationPointRow[]): StrokeRun[] {
  if (points.length === 0) {
    return [];
  }
  const runs: StrokeRun[] = [];
  let currentStyle = travelStrokeForActivity(points[0]!.activityType);
  let current: LocationPointRow[] = [points[0]!];

  for (let i = 1; i < points.length; i += 1) {
    const point = points[i]!;
    const style = travelStrokeForActivity(point.activityType);
    if (style === currentStyle) {
      current.push(point);
      continue;
    }
    runs.push({ style: currentStyle, points: current });
    // Share boundary vertex so polylines connect.
    currentStyle = style;
    current = [points[i - 1]!, point];
  }
  runs.push({ style: currentStyle, points: current });
  return runs;
}

function applyDashGates(runs: readonly StrokeRun[]): StrokeRun[] {
  return runs.map(run => {
    if (run.style !== 'dashed') {
      return run;
    }
    const pathM = pathLengthM(run.points);
    const ms = durationMs(run.points);
    if (
      pathM < TRAVEL_MODE_DASH_MIN_PATH_M ||
      ms < TRAVEL_MODE_DASH_MIN_DURATION_MS
    ) {
      return { style: 'solid', points: run.points };
    }
    return run;
  });
}

function mergeAdjacentSameStyle(runs: readonly StrokeRun[]): StrokeRun[] {
  if (runs.length === 0) {
    return [];
  }
  const merged: StrokeRun[] = [{ ...runs[0]!, points: [...runs[0]!.points] }];
  for (let i = 1; i < runs.length; i += 1) {
    const run = runs[i]!;
    const last = merged[merged.length - 1]!;
    if (run.style === last.style) {
      const nextPoints = run.points.slice(1);
      last.points.push(...nextPoints);
      continue;
    }
    merged.push({ style: run.style, points: [...run.points] });
  }
  return merged;
}

/**
 * Split a travel path into solid (vehicle/bike/unknown) and dashed (foot)
 * legs. Short foot hops stay solid.
 */
export function buildTravelModeLegs(
  points: readonly LocationPointRow[],
): TravelModeLeg[] {
  if (points.length < 2) {
    return points.length === 1
      ? [
          {
            style: travelStrokeForActivity(points[0]!.activityType),
            coordinates: toCoordinates(points),
          },
        ]
      : [];
  }

  const sorted = [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.id - b.id,
  );
  const gated = applyDashGates(splitStrokeRuns(sorted));
  const merged = mergeAdjacentSameStyle(gated);

  return merged
    .filter(run => run.points.length >= 2)
    .map(run => ({
      style: run.style,
      coordinates: toCoordinates(run.points),
    }));
}
