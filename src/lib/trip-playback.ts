import type {LocationPointRow} from '@/db/repositories/location-days';
import {
  bearingDegrees,
  distanceKm,
  toMapCoordinates,
  type LocationPointLike,
  type MapCoordinate,
} from '@/lib/location-geo';

/** Default cap; actual playback uses `getTripPlaybackDurationMs`. */
export const TRIP_PLAYBACK_DURATION_MS = 13_000;

/** Wall-clock playback length (accelerated, not real-time). */
export function getTripPlaybackDurationMs(_tripDurationMs: number): number {
  return TRIP_PLAYBACK_DURATION_MS;
}
/** Native marker tween between React frames (~30fps updates). */
export const PLAYBACK_MARKER_FRAME_MS = 40;
const DENSE_STEP_METERS = 5;
const MAX_DENSE_SAMPLES = 900;

export type DensePlaybackSample = {
  coordinate: MapCoordinate;
  timestampMs: number;
  segmentIndex: number;
};

export type PlaybackLabelPlacement = 'top' | 'bottom' | 'left' | 'right';

export type TripPlaybackFrame = {
  coordinate: MapCoordinate;
  pointIndex: number;
  interpolatedAt: Date;
  progress: number;
  labelPlacement: PlaybackLabelPlacement;
  pathCoordinates: MapCoordinate[];
};

export type PlaybackLabelOffset = {
  x: number;
  y: number;
};

/** Dot is 24px; chip ~28px tall; gap between them. */
const PLAYBACK_DOT_RADIUS_PX = 12;
const PLAYBACK_CHIP_GAP_PX = 10;
const PLAYBACK_CHIP_HALF_HEIGHT_PX = 14;
const PLAYBACK_CHIP_HALF_WIDTH_PX = 38;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function buildCumulativeDistanceKm(points: LocationPointRow[]): number[] {
  const cumulative: number[] = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(
      cumulative[index - 1]! + distanceKm(points[index - 1]!, points[index]!),
    );
  }
  return cumulative;
}

type ResolvedPlayback = {
  coordinate: MapCoordinate;
  pointIndex: number;
  interpolatedAt: Date;
};

/** Progress 0–1 moves at constant speed along the path (not wall-clock time). */
function resolvePlaybackPosition(
  points: LocationPointRow[],
  progress: number,
): ResolvedPlayback | null {
  if (points.length === 0) {
    return null;
  }

  const clamped = Math.min(1, Math.max(0, progress));
  if (points.length === 1) {
    const point = points[0]!;
    return {
      coordinate: {latitude: point.lat, longitude: point.lng},
      pointIndex: 0,
      interpolatedAt: point.timestamp,
    };
  }

  const cumulative = buildCumulativeDistanceKm(points);
  const totalKm = cumulative[cumulative.length - 1] ?? 0;

  if (totalKm <= 0) {
    const point = points[0]!;
    return {
      coordinate: {latitude: point.lat, longitude: point.lng},
      pointIndex: 0,
      interpolatedAt: point.timestamp,
    };
  }

  const targetKm = clamped * totalKm;

  for (let index = 0; index < points.length - 1; index += 1) {
    const startKm = cumulative[index]!;
    const endKm = cumulative[index + 1]!;
    if (targetKm > endKm) {
      continue;
    }

    const segmentKm = Math.max(endKm - startKm, 0);
    const t = segmentKm > 0 ? (targetKm - startKm) / segmentKm : 0;
    const a = points[index]!;
    const b = points[index + 1]!;
    const aMs = a.timestamp.getTime();
    const bMs = b.timestamp.getTime();

    return {
      coordinate: {
        latitude: lerp(a.lat, b.lat, t),
        longitude: lerp(a.lng, b.lng, t),
      },
      pointIndex: index,
      interpolatedAt: new Date(lerp(aMs, bMs, t)),
    };
  }

  const last = points[points.length - 1]!;
  return {
    coordinate: {latitude: last.lat, longitude: last.lng},
    pointIndex: points.length - 1,
    interpolatedAt: last.timestamp,
  };
}

/** Horizontal travel → top/bottom; vertical travel → left/right. */
export function getPlaybackLabelPlacement(
  a: LocationPointLike,
  b: LocationPointLike,
): PlaybackLabelPlacement {
  const dLat = Math.abs(b.lat - a.lat);
  const dLng = Math.abs(b.lng - a.lng);

  if (dLng >= dLat) {
    const bearing = bearingDegrees(a, b);
    return bearing > 45 && bearing < 135 ? 'top' : 'bottom';
  }

  const bearing = bearingDegrees(a, b);
  return bearing >= 0 && bearing <= 180 ? 'right' : 'left';
}

/** Pixel offset for the time chip so the dot stays centered on the route. */
export function getPlaybackLabelCenterOffset(
  placement: PlaybackLabelPlacement,
): PlaybackLabelOffset {
  const fromDot =
    PLAYBACK_DOT_RADIUS_PX + PLAYBACK_CHIP_GAP_PX + PLAYBACK_CHIP_HALF_HEIGHT_PX;
  const fromDotHorizontal =
    PLAYBACK_DOT_RADIUS_PX + PLAYBACK_CHIP_GAP_PX + PLAYBACK_CHIP_HALF_WIDTH_PX;

  switch (placement) {
    case 'top':
      return {x: 0, y: -fromDot};
    case 'bottom':
      return {x: 0, y: fromDot};
    case 'left':
      return {x: -fromDotHorizontal, y: 0};
    case 'right':
      return {x: fromDotHorizontal, y: 0};
  }
}

/** Evenly spaced samples along the route for smooth motion and line growth. */
export function buildDensePlaybackSamples(
  points: LocationPointRow[],
): DensePlaybackSample[] {
  if (points.length === 0) {
    return [];
  }

  if (points.length === 1) {
    const point = points[0]!;
    return [
      {
        coordinate: {latitude: point.lat, longitude: point.lng},
        timestampMs: point.timestamp.getTime(),
        segmentIndex: 0,
      },
    ];
  }

  const cumulative = buildCumulativeDistanceKm(points);
  const totalMeters = (cumulative[cumulative.length - 1] ?? 0) * 1000;
  const stepMeters = Math.max(
    DENSE_STEP_METERS,
    totalMeters / MAX_DENSE_SAMPLES,
  );

  const samples: DensePlaybackSample[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]!;
    const b = points[index + 1]!;
    const segmentMeters = distanceKm(a, b) * 1000;
    const steps = Math.max(1, Math.ceil(segmentMeters / stepMeters));

    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      samples.push({
        coordinate: {
          latitude: lerp(a.lat, b.lat, t),
          longitude: lerp(a.lng, b.lng, t),
        },
        timestampMs: lerp(a.timestamp.getTime(), b.timestamp.getTime(), t),
        segmentIndex: index,
      });
    }
  }

  const last = points[points.length - 1]!;
  samples.push({
    coordinate: {latitude: last.lat, longitude: last.lng},
    timestampMs: last.timestamp.getTime(),
    segmentIndex: Math.max(0, points.length - 2),
  });

  return samples;
}

export function getTripPlaybackFrame(
  points: LocationPointRow[],
  progress: number,
  denseSamples?: DensePlaybackSample[],
): TripPlaybackFrame | null {
  const samples = denseSamples ?? buildDensePlaybackSamples(points);
  if (samples.length === 0) {
    return null;
  }

  const clamped = Math.min(1, Math.max(0, progress));

  if (samples.length === 1) {
    const only = samples[0]!;
    return {
      coordinate: only.coordinate,
      pointIndex: 0,
      interpolatedAt: new Date(only.timestampMs),
      progress: clamped,
      labelPlacement: 'top',
      pathCoordinates: [only.coordinate],
    };
  }

  const floatIndex = clamped * (samples.length - 1);
  const startIndex = Math.floor(floatIndex);
  const endIndex = Math.min(startIndex + 1, samples.length - 1);
  const segmentT = floatIndex - startIndex;
  const start = samples[startIndex]!;
  const end = samples[endIndex]!;

  const coordinate: MapCoordinate = {
    latitude: lerp(start.coordinate.latitude, end.coordinate.latitude, segmentT),
    longitude: lerp(
      start.coordinate.longitude,
      end.coordinate.longitude,
      segmentT,
    ),
  };

  const pathCoordinates = samples
    .slice(0, startIndex + 1)
    .map(sample => sample.coordinate);
  if (segmentT > 0.0001) {
    pathCoordinates.push(coordinate);
  }

  const segmentEnd = points[start.segmentIndex + 1];
  const segmentStart = points[start.segmentIndex]!;
  const labelPlacement =
    segmentEnd != null
      ? getPlaybackLabelPlacement(segmentStart, segmentEnd)
      : ('top' as PlaybackLabelPlacement);

  return {
    coordinate,
    pointIndex: start.segmentIndex,
    interpolatedAt: new Date(lerp(start.timestampMs, end.timestampMs, segmentT)),
    progress: clamped,
    labelPlacement,
    pathCoordinates,
  };
}

export function getPlaybackCoordinates(
  points: LocationPointRow[],
  progress: number,
  denseSamples?: DensePlaybackSample[],
): MapCoordinate[] {
  return (
    getTripPlaybackFrame(points, progress, denseSamples)?.pathCoordinates ?? []
  );
}
