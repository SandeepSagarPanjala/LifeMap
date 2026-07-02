import {displayPointsForSegment} from '@lifemap/segmentation';
import type {Stop} from '@lifemap/segmentation';
import type {TripSegment} from '@lifemap/segmentation';
import type {MomentRow, ParsedPoint} from '../types';

export type TripExportGeometry = 'raw' | 'canonical';

export type TripExportPayload = {
  exportedAt: string;
  source: string | null;
  dateFilter: string;
  geometry: TripExportGeometry;
  canonicalizeStayGeometry: boolean;
  canonicalizeDriveGeometry: boolean;
  segmentCount: number;
  stops: Array<{
    id: string;
    arrivedAt: string;
    leftAt: string;
    durationMs: number;
    center: {lat: number; lng: number};
    spreadM: number;
    pointCount: number;
  }>;
  segments: Array<Record<string, unknown>>;
};

function serializePath(points: readonly ParsedPoint[]) {
  return points.map(p => ({
    id: p.id,
    timestamp: p.timestamp,
    lat: p.lat,
    lng: p.lng,
    speed: p.speed,
    source: p.source,
  }));
}

function pathForExport(
  segment: TripSegment,
  geometry: TripExportGeometry,
  canonicalizeStayGeometry: boolean,
  canonicalizeDriveGeometry: boolean,
  moments: readonly MomentRow[],
): ParsedPoint[] {
  if (segment.kind === 'missing') {
    return [];
  }
  if (geometry === 'raw') {
    return segment.points;
  }
  return displayPointsForSegment(
    segment,
    canonicalizeStayGeometry,
    moments,
    canonicalizeDriveGeometry,
  );
}

function serializeSegment(
  segment: TripSegment,
  geometry: TripExportGeometry,
  canonicalizeStayGeometry: boolean,
  canonicalizeDriveGeometry: boolean,
  moments: readonly MomentRow[],
): Record<string, unknown> {
  const path = pathForExport(
    segment,
    geometry,
    canonicalizeStayGeometry,
    canonicalizeDriveGeometry,
    moments,
  );
  const pathSerialized = serializePath(path);

  if (segment.kind === 'missing') {
    return {
      kind: 'missing',
      order: segment.order,
      startAt: segment.startAt.toISOString(),
      endAt: segment.endAt.toISOString(),
      durationMs: segment.durationMs,
      distanceM: Math.round(segment.distanceM),
      fromKind: segment.fromKind,
      toKind: segment.toKind,
      from: {lat: segment.fromLat, lng: segment.fromLng},
      to: {lat: segment.toLat, lng: segment.toLng},
      pointCount: 0,
      pathPointCount: 0,
      path: pathSerialized,
    };
  }

  const rawPointCount = segment.points.length;

  if (segment.kind === 'stay') {
    return {
      kind: 'stay',
      order: segment.order,
      stopId: segment.stop.id,
      savedPlaceLabel: segment.savedPlaceLabel ?? null,
      savedPlaceId: segment.savedPlaceId ?? null,
      arrivedAt: segment.startAt.toISOString(),
      leftAt: segment.endAt.toISOString(),
      durationMs: segment.durationMs,
      center: {lat: segment.stop.lat, lng: segment.stop.lng},
      spreadM: Math.round(segment.stop.spreadM),
      pointCount: segment.stop.pointCount,
      rawPathPointCount: rawPointCount,
      pathPointCount: pathSerialized.length,
      path: pathSerialized,
    };
  }

  return {
    kind: 'drive',
    order: segment.order,
    startAt: segment.startAt.toISOString(),
    endAt: segment.endAt.toISOString(),
    durationMs: segment.durationMs,
    distanceM: Math.round(segment.distanceM),
    fromStopId: segment.fromStop?.id ?? null,
    toStopId: segment.toStop?.id ?? null,
    fromSavedPlaceLabel: segment.fromSavedPlaceLabel ?? null,
    fromSavedPlaceId: segment.fromSavedPlaceId ?? null,
    toSavedPlaceLabel: segment.toSavedPlaceLabel ?? null,
    toSavedPlaceId: segment.toSavedPlaceId ?? null,
    rawPathPointCount: rawPointCount,
    pathPointCount: pathSerialized.length,
    path: pathSerialized,
  };
}

export function buildTripExportPayload(args: {
  source: string | null;
  dateFilter: string;
  geometry: TripExportGeometry;
  canonicalizeStayGeometry: boolean;
  canonicalizeDriveGeometry: boolean;
  segments: readonly TripSegment[];
  stops: readonly Stop[];
  moments: readonly MomentRow[];
}): TripExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    source: args.source,
    dateFilter: args.dateFilter,
    geometry: args.geometry,
    canonicalizeStayGeometry: args.canonicalizeStayGeometry,
    canonicalizeDriveGeometry: args.canonicalizeDriveGeometry,
    segmentCount: args.segments.length,
    stops: args.stops.map(stop => ({
      id: stop.id,
      arrivedAt: stop.arrivedAt.toISOString(),
      leftAt: stop.leftAt.toISOString(),
      durationMs: stop.durationMs,
      center: {lat: stop.lat, lng: stop.lng},
      spreadM: Math.round(stop.spreadM),
      pointCount: stop.pointCount,
    })),
    segments: args.segments.map(segment =>
      serializeSegment(
        segment,
        args.geometry,
        args.canonicalizeStayGeometry,
        args.canonicalizeDriveGeometry,
        args.moments,
      ),
    ),
  };
}

export function downloadTripExportJson(
  payload: TripExportPayload,
  dateKey: string,
): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = dateKey === 'all' ? 'all-dates' : dateKey;
  const suffix = payload.geometry === 'canonical' ? '-canonical' : '';
  anchor.href = url;
  anchor.download = `trips-${stamp}${suffix}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
