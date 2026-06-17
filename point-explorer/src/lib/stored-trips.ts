import {dateKeyForTimestamp} from './export';
import type {Stop} from './stops';
import type {
  TripResult,
  TripSegment,
} from './trips';
import type {ParsedPoint, SavedPlaceRow} from '../types';

export type StoredTripRow = {
  id: number;
  kind: 'stay' | 'travel' | 'missing';
  dateKey: string;
  startAt: string;
  endAt: string;
  durationMs: number;
  distanceKm: number;
  centroidLat: number;
  centroidLng: number;
  segmentOrder: number;
  savedPlaceLabel: string | null;
  savedPlaceId: number | null;
  inferred: boolean;
};

export type StoredTripPointRow = {
  tripId: number;
  seq: number;
  lat: number;
  lng: number;
  recordedAt: string | null;
  locationPointId: number | null;
  source: string | null;
};

export type StoredTripExport = {
  trips: StoredTripRow[];
  tripPointsByTripId: Map<number, StoredTripPointRow[]>;
  savedPlaces: SavedPlaceRow[];
};

type ExplorerSegmentJson = {
  kind: 'stay' | 'drive' | 'missing';
  order: number;
  startAt?: string;
  endAt?: string;
  arrivedAt?: string;
  leftAt?: string;
  durationMs: number;
  distanceM?: number;
  savedPlaceLabel?: string | null;
  savedPlaceId?: number | null;
  stopId?: string;
  center?: {lat: number; lng: number};
  spreadM?: number;
  pointCount?: number;
  fromKind?: 'stay' | 'drive';
  toKind?: 'stay' | 'drive';
  from?: {lat: number; lng: number};
  to?: {lat: number; lng: number};
  path?: Array<{
    id: number;
    timestamp: string;
    lat: number;
    lng: number;
    speed: number | null;
    source: string;
  }>;
};

const EARTH_RADIUS_M = 6_371_000;

function haversineM(
  a: {lat: number; lng: number},
  b: {lat: number; lng: number},
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function pathLengthM(points: ParsedPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineM(points[index - 1]!, points[index]!);
  }
  return total;
}

function spreadM(points: ParsedPoint[], center: {lat: number; lng: number}): number {
  let max = 0;
  for (const point of points) {
    max = Math.max(max, haversineM(center, point));
  }
  return max;
}

function tripPointsToParsed(
  trip: StoredTripRow,
  rows: readonly StoredTripPointRow[],
): ParsedPoint[] {
  if (rows.length === 0) {
    return [];
  }
  const startMs = new Date(trip.startAt).getTime();
  const endMs = new Date(trip.endAt).getTime();
  const spanMs = Math.max(1, endMs - startMs);
  return rows.map((row, index) => {
    const timestamp =
      row.recordedAt ??
      new Date(
        startMs + (spanMs * index) / Math.max(1, rows.length - 1),
      ).toISOString();
    const at = new Date(timestamp);
    return {
      id: row.locationPointId ?? -(trip.id * 10_000 + row.seq),
      timestamp,
      lat: row.lat,
      lng: row.lng,
      accuracy: null,
      altitude: null,
      speed: null,
      source: row.source ?? 'trip',
      at,
      dateKey: dateKeyForTimestamp(timestamp),
    };
  });
}

function makeStopFromStay(
  trip: StoredTripRow,
  points: ParsedPoint[],
  stopId: string,
): Stop {
  const center = {
    lat: trip.centroidLat,
    lng: trip.centroidLng,
  };
  const arrivedAt = new Date(trip.startAt);
  const leftAt = new Date(trip.endAt);
  return {
    id: stopId,
    lat: center.lat,
    lng: center.lng,
    arrivedAt,
    leftAt,
    durationMs: trip.durationMs,
    pointCount: points.length,
    spreadM: points.length > 0 ? spreadM(points, center) : 0,
    pointIds: points.map(point => point.id),
    inferred: trip.inferred,
  };
}

function normalizeStoredTripRow(raw: Record<string, unknown>): StoredTripRow | null {
  const id = raw.id;
  const kind = raw.kind;
  const dateKey = raw.dateKey ?? raw.date_key;
  const startAt = raw.startAt ?? raw.start_at;
  const endAt = raw.endAt ?? raw.end_at;
  if (
    typeof id !== 'number' ||
    (kind !== 'stay' && kind !== 'travel' && kind !== 'missing') ||
    typeof dateKey !== 'string' ||
    typeof startAt !== 'string' ||
    typeof endAt !== 'string'
  ) {
    return null;
  }
  return {
    id,
    kind,
    dateKey,
    startAt,
    endAt,
    durationMs: Number(raw.durationMs ?? raw.duration_ms ?? 0),
    distanceKm: Number(raw.distanceKm ?? raw.distance_km ?? 0),
    centroidLat: Number(raw.centroidLat ?? raw.centroid_lat ?? 0),
    centroidLng: Number(raw.centroidLng ?? raw.centroid_lng ?? 0),
    segmentOrder: Number(raw.segmentOrder ?? raw.segment_order ?? 0),
    savedPlaceLabel:
      (raw.savedPlaceLabel as string | null | undefined) ??
      (raw.saved_place_label as string | null | undefined) ??
      null,
    savedPlaceId:
      (raw.savedPlaceId as number | null | undefined) ??
      (raw.saved_place_id as number | null | undefined) ??
      null,
    inferred: Boolean(raw.inferred),
  };
}

function normalizeTripPointRow(
  raw: Record<string, unknown>,
): StoredTripPointRow | null {
  const tripId = raw.tripId ?? raw.trip_id;
  const seq = raw.seq;
  const lat = raw.lat;
  const lng = raw.lng;
  if (
    typeof tripId !== 'number' ||
    typeof seq !== 'number' ||
    typeof lat !== 'number' ||
    typeof lng !== 'number'
  ) {
    return null;
  }
  const recordedAt = raw.recordedAt ?? raw.recorded_at;
  const locationPointId = raw.locationPointId ?? raw.location_point_id;
  const source = raw.source;
  return {
    tripId,
    seq,
    lat,
    lng,
    recordedAt: typeof recordedAt === 'string' ? recordedAt : null,
    locationPointId: typeof locationPointId === 'number' ? locationPointId : null,
    source: typeof source === 'string' ? source : null,
  };
}

export function parseStoredTripExport(raw: unknown): StoredTripExport | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const root = raw as Record<string, unknown>;
  const tables = root.tables as Record<string, unknown> | undefined;
  const tripRows = Array.isArray(tables?.trips)
    ? tables!.trips
    : Array.isArray(root.trips)
      ? root.trips
      : null;
  if (tripRows == null) {
    return null;
  }

  const trips: StoredTripRow[] = [];
  for (const row of tripRows) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const parsed = normalizeStoredTripRow(row as Record<string, unknown>);
    if (parsed != null) {
      trips.push(parsed);
    }
  }
  if (trips.length === 0) {
    return null;
  }

  const tripPointsByTripId = new Map<number, StoredTripPointRow[]>();
  const pointRows = Array.isArray(tables?.trip_points)
    ? tables!.trip_points
    : Array.isArray(root.trip_points)
      ? root.trip_points
      : [];
  for (const row of pointRows) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const parsed = normalizeTripPointRow(row as Record<string, unknown>);
    if (parsed == null) {
      continue;
    }
    const bucket = tripPointsByTripId.get(parsed.tripId);
    if (bucket) {
      bucket.push(parsed);
    } else {
      tripPointsByTripId.set(parsed.tripId, [parsed]);
    }
  }
  for (const bucket of tripPointsByTripId.values()) {
    bucket.sort((a, b) => a.seq - b.seq);
  }

  const savedPlaces = Array.isArray(tables?.saved_places)
    ? (tables!.saved_places as SavedPlaceRow[])
    : [];

  return {trips, tripPointsByTripId, savedPlaces};
}

function parseExplorerSegmentsExport(
  raw: Record<string, unknown>,
): StoredTripExport | null {
  const segments = raw.segments;
  if (!Array.isArray(segments) || segments.length === 0) {
    return null;
  }
  const dateFilter =
    typeof raw.dateFilter === 'string' ? raw.dateFilter : 'imported';
  const trips: StoredTripRow[] = [];
  const tripPointsByTripId = new Map<number, StoredTripPointRow[]>();

  segments.forEach((segmentRaw, index) => {
    if (!segmentRaw || typeof segmentRaw !== 'object') {
      return;
    }
    const segment = segmentRaw as ExplorerSegmentJson;
    const tripId = index + 1;
    const startAt =
      segment.kind === 'stay'
        ? segment.arrivedAt ?? segment.startAt
        : segment.startAt;
    const endAt =
      segment.kind === 'stay' ? segment.leftAt ?? segment.endAt : segment.endAt;
    if (!startAt || !endAt) {
      return;
    }
    const center = segment.center ?? segment.from ?? {lat: 0, lng: 0};
    trips.push({
      id: tripId,
      kind:
        segment.kind === 'drive'
          ? 'travel'
          : segment.kind === 'missing'
            ? 'missing'
            : 'stay',
      dateKey: dateFilter,
      startAt,
      endAt,
      durationMs: segment.durationMs,
      distanceKm: (segment.distanceM ?? 0) / 1000,
      centroidLat: center.lat,
      centroidLng: center.lng,
      segmentOrder: segment.order,
      savedPlaceLabel: segment.savedPlaceLabel ?? null,
      savedPlaceId: segment.savedPlaceId ?? null,
      inferred: false,
    });
    const path = segment.path ?? [];
    if (path.length > 0) {
      tripPointsByTripId.set(
        tripId,
        path.map((point, seq) => ({
          tripId,
          seq,
          lat: point.lat,
          lng: point.lng,
          recordedAt: point.timestamp,
          locationPointId: point.id > 0 ? point.id : null,
          source: point.source,
        })),
      );
    }
  });

  if (trips.length === 0) {
    return null;
  }
  return {trips, tripPointsByTripId, savedPlaces: []};
}

export function buildTripResultForDay(
  stored: StoredTripExport,
  dateKey: string,
): TripResult {
  const dayTrips = stored.trips
    .filter(trip => trip.dateKey === dateKey)
    .sort(
      (a, b) =>
        a.segmentOrder - b.segmentOrder ||
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );

  const segments: TripSegment[] = [];
  const stops: Stop[] = [];
  const points: ParsedPoint[] = [];
  const stopById = new Map<string, Stop>();

  for (const [index, trip] of dayTrips.entries()) {
    const routePoints = tripPointsToParsed(
      trip,
      stored.tripPointsByTripId.get(trip.id) ?? [],
    );
    points.push(...routePoints);

    if (trip.kind === 'missing') {
      const from = routePoints[0] ?? {
        lat: trip.centroidLat,
        lng: trip.centroidLng,
      };
      const to = routePoints[routePoints.length - 1] ?? from;
      segments.push({
        kind: 'missing',
        id: `missing-${trip.id}`,
        order: trip.segmentOrder || index + 1,
        startAt: new Date(trip.startAt),
        endAt: new Date(trip.endAt),
        durationMs: trip.durationMs,
        distanceM: trip.distanceKm * 1000,
        fromKind: 'stay',
        toKind: 'stay',
        fromLat: from.lat,
        fromLng: from.lng,
        toLat: to.lat,
        toLng: to.lng,
        points: [],
      });
      continue;
    }

    if (trip.kind === 'stay') {
      const stopId = `stop-${trip.id}`;
      const stop = makeStopFromStay(trip, routePoints, stopId);
      stops.push(stop);
      stopById.set(stopId, stop);
      segments.push({
        kind: 'stay',
        id: `stay-${trip.id}`,
        order: trip.segmentOrder || index + 1,
        stop,
        startAt: stop.arrivedAt,
        endAt: stop.leftAt,
        durationMs: trip.durationMs,
        points: routePoints,
        savedPlaceLabel: trip.savedPlaceLabel ?? undefined,
        savedPlaceId: trip.savedPlaceId ?? undefined,
      });
      continue;
    }

    const prevStay = [...segments]
      .reverse()
      .find(segment => segment.kind === 'stay');
    const nextStay = dayTrips
      .slice(index + 1)
      .find(row => row.kind === 'stay');
    segments.push({
      kind: 'drive',
      id: `drive-${trip.id}`,
      order: trip.segmentOrder || index + 1,
      startAt: new Date(trip.startAt),
      endAt: new Date(trip.endAt),
      durationMs: trip.durationMs,
      distanceM:
        routePoints.length >= 2
          ? pathLengthM(routePoints)
          : trip.distanceKm * 1000,
      points: routePoints,
      fromStop:
        prevStay?.kind === 'stay'
          ? prevStay.stop
          : null,
      toStop:
        nextStay != null
          ? makeStopFromStay(
              nextStay,
              tripPointsToParsed(
                nextStay,
                stored.tripPointsByTripId.get(nextStay.id) ?? [],
              ),
              `stop-${nextStay.id}`,
            )
          : null,
      fromSavedPlaceLabel: prevStay?.kind === 'stay' ? prevStay.savedPlaceLabel : undefined,
      fromSavedPlaceId: prevStay?.kind === 'stay' ? prevStay.savedPlaceId : undefined,
      toSavedPlaceLabel: nextStay?.savedPlaceLabel ?? undefined,
      toSavedPlaceId: nextStay?.savedPlaceId ?? undefined,
    });
  }

  const uniquePoints = new Map<number, ParsedPoint>();
  for (const point of points) {
    uniquePoints.set(point.id, point);
  }

  return {
    points: [...uniquePoints.values()].sort(
      (a, b) => a.at.getTime() - b.at.getTime(),
    ),
    stops,
    segments,
  };
}

export function uniqueTripDateKeys(stored: StoredTripExport): string[] {
  return [...new Set(stored.trips.map(trip => trip.dateKey))].sort();
}

export function collectAllStoredTripPoints(stored: StoredTripExport): ParsedPoint[] {
  const byId = new Map<number, ParsedPoint>();
  for (const dateKey of uniqueTripDateKeys(stored)) {
    for (const point of buildTripResultForDay(stored, dateKey).points) {
      byId.set(point.id, point);
    }
  }
  return [...byId.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function loadStoredTripExport(raw: unknown): StoredTripExport {
  const fromTables = parseStoredTripExport(raw);
  if (fromTables != null) {
    return fromTables;
  }
  if (raw && typeof raw === 'object') {
    const fromSegments = parseExplorerSegmentsExport(raw as Record<string, unknown>);
    if (fromSegments != null) {
      return fromSegments;
    }
  }
  throw new Error(
    'Plot mode needs trips + trip_points (mobile export) or segments with paths (explorer JSON).',
  );
}
