import {
  ROUTE_DIRECTION_ARROW_MAX_ZOOM_DELTA,
  ROUTE_DIRECTION_ARROW_MIN_ZOOM_DELTA,
  ROUTE_DIRECTION_ARROW_REF_ZOOM_DELTA,
  ROUTE_DIRECTION_ARROWS_MIN_PATH_M,
  ROUTE_DIRECTION_ARROWS_MIN_SEGMENT_M,
  ROUTE_DIRECTION_ARROWS_PERF_MAX,
  ROUTE_DIRECTION_ARROW_SIZE_M,
  ROUTE_DIRECTION_ARROW_SPACING_M,
} from '@/lib/app-constants';
import {
  bearingDegrees,
  distanceKm,
  type MapCoordinate,
} from '@/lib/location-geo';

export type RouteDirectionArrow = {
  coordinate: MapCoordinate;
  /** Degrees clockwise from north along travel. */
  bearing: number;
  /** Shaft back → tip (the "-" of "->"). */
  shaft: MapCoordinate[];
  /** Head left → tip → right (the ">" of "->"). */
  chevron: MapCoordinate[];
};

export type SampleRouteDirectionArrowsOptions = {
  spacingM?: number;
  minPathM?: number;
  minSegmentM?: number;
  /** Safety ceiling only — not a design density target. */
  perfMax?: number;
  /** @deprecated use perfMax */
  maxArrows?: number;
  /** Chevron size in meters (tip to wing). */
  arrowSizeM?: number;
};

function clampZoomDelta(latitudeDelta: number): number {
  return Math.min(
    ROUTE_DIRECTION_ARROW_MAX_ZOOM_DELTA,
    Math.max(ROUTE_DIRECTION_ARROW_MIN_ZOOM_DELTA, latitudeDelta),
  );
}

/**
 * Ground size that keeps arrows roughly constant on screen at any zoom.
 * Smaller latitudeDelta (zoomed in) → smaller meters → same pixel size.
 */
export function routeDirectionArrowSizeForZoom(
  latitudeDelta: number,
): number {
  const delta = clampZoomDelta(latitudeDelta);
  return (
    (delta / ROUTE_DIRECTION_ARROW_REF_ZOOM_DELTA) * ROUTE_DIRECTION_ARROW_SIZE_M
  );
}

/** Spacing scales with zoom so density stays similar on screen. */
export function routeDirectionArrowSpacingForZoom(
  latitudeDelta: number,
): number {
  const delta = clampZoomDelta(latitudeDelta);
  return (
    (delta / ROUTE_DIRECTION_ARROW_REF_ZOOM_DELTA) *
    ROUTE_DIRECTION_ARROW_SPACING_M
  );
}

function interpolateCoordinate(
  a: MapCoordinate,
  b: MapCoordinate,
  t: number,
): MapCoordinate {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

/** Move `distanceM` from origin along bearing (degrees clockwise from north). */
export function destinationPoint(
  origin: MapCoordinate,
  bearingDeg: number,
  distanceM: number,
): MapCoordinate {
  const radiusM = 6_371_000;
  const angular = distanceM / radiusM;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin.latitude * Math.PI) / 180;
  const lng1 = (origin.longitude * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    latitude: (lat2 * 180) / Math.PI,
    longitude: (lng2 * 180) / Math.PI,
  };
}

/**
 * Geographic "->" arrow: thin shaft + open chevron head, tip facing `bearing`.
 */
export function buildArrowChevron(
  center: MapCoordinate,
  bearing: number,
  sizeM = ROUTE_DIRECTION_ARROW_SIZE_M,
): { shaft: MapCoordinate[]; chevron: MapCoordinate[] } {
  const tip = destinationPoint(center, bearing, sizeM * 0.6);
  const back = destinationPoint(center, bearing + 180, sizeM * 0.5);
  // Narrow wings so the head reads as ">" not a thick diamond.
  const left = destinationPoint(tip, bearing + 155, sizeM * 0.45);
  const right = destinationPoint(tip, bearing - 155, sizeM * 0.45);
  return {
    shaft: [back, tip],
    chevron: [left, tip, right],
  };
}

/**
 * Place direction arrows evenly along the full path by length.
 * Longer paths get more arrows (spacing-driven); only a high perf ceiling applies.
 */
export function sampleRouteDirectionArrows(
  coordinates: readonly MapCoordinate[],
  options: SampleRouteDirectionArrowsOptions = {},
): RouteDirectionArrow[] {
  const spacingM = options.spacingM ?? ROUTE_DIRECTION_ARROW_SPACING_M;
  const minPathM = options.minPathM ?? ROUTE_DIRECTION_ARROWS_MIN_PATH_M;
  const minSegmentM =
    options.minSegmentM ?? ROUTE_DIRECTION_ARROWS_MIN_SEGMENT_M;
  const perfMax =
    options.perfMax ?? options.maxArrows ?? ROUTE_DIRECTION_ARROWS_PERF_MAX;
  const arrowSizeM = options.arrowSizeM ?? ROUTE_DIRECTION_ARROW_SIZE_M;

  if (coordinates.length < 2 || spacingM <= 0 || perfMax <= 0) {
    return [];
  }

  const segmentEnds: number[] = [0];
  let pathM = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    pathM +=
      distanceKm(
        {
          lat: coordinates[i - 1]!.latitude,
          lng: coordinates[i - 1]!.longitude,
        },
        { lat: coordinates[i]!.latitude, lng: coordinates[i]!.longitude },
      ) * 1000;
    segmentEnds.push(pathM);
  }
  if (pathM < minPathM) {
    return [];
  }

  const idealCount = Math.max(1, Math.floor(pathM / spacingM));
  const count = Math.min(perfMax, idealCount);
  const arrows: RouteDirectionArrow[] = [];

  for (let n = 1; n <= count; n += 1) {
    const targetM = (pathM * n) / (count + 1);
    // Find segment containing targetM.
    let segIdx = 1;
    while (
      segIdx < segmentEnds.length - 1 &&
      segmentEnds[segIdx]! < targetM
    ) {
      segIdx += 1;
    }
    const a = coordinates[segIdx - 1]!;
    const b = coordinates[segIdx]!;
    const segmentStartM = segmentEnds[segIdx - 1]!;
    const segmentEndM = segmentEnds[segIdx]!;
    const segmentM = segmentEndM - segmentStartM;
    if (segmentM < minSegmentM) {
      continue;
    }
    const t = (targetM - segmentStartM) / segmentM;
    const bearing = bearingDegrees(
      { lat: a.latitude, lng: a.longitude },
      { lat: b.latitude, lng: b.longitude },
    );
    const coordinate = interpolateCoordinate(
      a,
      b,
      Math.min(1, Math.max(0, t)),
    );
    const shape = buildArrowChevron(coordinate, bearing, arrowSizeM);
    arrows.push({
      coordinate,
      bearing,
      shaft: shape.shaft,
      chevron: shape.chevron,
    });
  }

  return arrows;
}
