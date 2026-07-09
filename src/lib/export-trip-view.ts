import {TZDate} from '@date-fns/tz';
import {format} from 'date-fns';

import type {TripPointRow} from '@/db/repositories/trip-points';
import type {TripRow} from '@/db/repositories/trips';
import {parseDateKey} from '@/lib/day-utils';
import {formatDistance, type DistanceUnit} from '@/lib/location-geo';
import {visitDisplayLabel} from '@/lib/place-lookup-types';
import {APP_TIMEZONE} from '@/lib/timezone';
import {formatTripDuration} from '@/lib/trip-format';

export type ExportTripTimeField = {
  iso: string;
  local: string;
  utc: string;
};

export type ExportTripPointView = {
  id: number;
  seq: number;
  lat: number;
  lng: number;
  recordedAt: ExportTripTimeField | null;
  locationPointId: number | null;
  source: string | null;
  momentId: number | null;
};

export type ExportTripView = {
  id: number;
  eventKey: string;
  kind: TripRow['kind'];
  dateKey: string;
  segmentOrder: number;
  startAt: ExportTripTimeField;
  endAt: ExportTripTimeField;
  closedAt: ExportTripTimeField;
  duration: string;
  durationMs: number;
  distance: string;
  distanceKm: number;
  centroid: {lat: number; lng: number};
  placeLabel: string | null;
  placeId: number | null;
  placeKind: TripRow['placeKind'];
  poiId: number | null;
  poiLabel: string | null;
  inferred: boolean;
  detectionVersion: number;
  momentRefs: TripRow['momentRefs'];
  pointCount: number;
  points: ExportTripPointView[];
};

export function formatExportDateKeyLabel(dateKey: string): string {
  return format(parseDateKey(dateKey), 'EEEE, MMM d, yyyy');
}

export function formatExportDateTime(date: Date): ExportTripTimeField {
  const zoned = new TZDate(date, APP_TIMEZONE);
  return {
    iso: date.toISOString(),
    local: format(zoned, 'EEE, MMM d, yyyy · h:mm:ss a'),
    utc: date.toISOString(),
  };
}

export function buildExportTripView(
  trip: TripRow,
  points: readonly TripPointRow[],
  distanceUnit: DistanceUnit = 'km',
): ExportTripView {
  return {
    id: trip.id,
    eventKey: trip.eventKey,
    kind: trip.kind,
    dateKey: trip.dateKey,
    segmentOrder: trip.segmentOrder,
    startAt: formatExportDateTime(trip.startAt),
    endAt: formatExportDateTime(trip.endAt),
    closedAt: formatExportDateTime(trip.closedAt),
    duration: formatTripDuration(trip.durationMs),
    durationMs: trip.durationMs,
    distance: formatDistance(trip.distanceKm, distanceUnit),
    distanceKm: trip.distanceKm,
    centroid: {lat: trip.centroidLat, lng: trip.centroidLng},
    placeLabel: trip.placeLabel,
    placeId: trip.placeId,
    placeKind: trip.placeKind,
    poiId: trip.poiId,
    poiLabel: trip.poiLabel,
    inferred: trip.inferred,
    detectionVersion: trip.detectionVersion,
    momentRefs: trip.momentRefs,
    pointCount: points.length,
    points: points.map(point => ({
      id: point.id,
      seq: point.seq,
      lat: point.lat,
      lng: point.lng,
      recordedAt:
        point.recordedAt != null
          ? formatExportDateTime(point.recordedAt)
          : null,
      locationPointId: point.locationPointId,
      source: point.source,
      momentId: point.momentId,
    })),
  };
}

export function exportTripViewJson(view: ExportTripView): string {
  return JSON.stringify(view, null, 2);
}

export function exportTripKindLabel(kind: TripRow['kind']): string {
  switch (kind) {
    case 'stay':
      return 'Stay';
    case 'travel':
      return 'Drive';
    case 'missing':
      return 'Missing';
  }
}

export function exportTripKindSummary(
  stayCount: number,
  travelCount: number,
  missingCount: number,
): string {
  const parts: string[] = [];
  if (stayCount > 0) {
    parts.push(`${stayCount} stay${stayCount === 1 ? '' : 's'}`);
  }
  if (travelCount > 0) {
    parts.push(`${travelCount} drive${travelCount === 1 ? '' : 's'}`);
  }
  if (missingCount > 0) {
    parts.push(`${missingCount} missing`);
  }
  return parts.join(' · ');
}

export function labelFromTripRow(
  row: Pick<TripRow, 'placeLabel' | 'placeKind' | 'poiLabel'>,
): string | null {
  return visitDisplayLabel({
    placeKind: row.placeKind,
    placeLabel: row.placeLabel,
    poiLabel: row.poiLabel,
  });
}

export function adjacentStaysForTrip(
  trips: readonly TripRow[],
  tripIndex: number,
): {from: TripRow | null; to: TripRow | null} {
  let from: TripRow | null = null;
  for (let index = tripIndex - 1; index >= 0; index -= 1) {
    const candidate = trips[index];
    if (candidate?.kind === 'stay') {
      from = candidate;
      break;
    }
  }
  let to: TripRow | null = null;
  for (let index = tripIndex + 1; index < trips.length; index += 1) {
    const candidate = trips[index];
    if (candidate?.kind === 'stay') {
      to = candidate;
      break;
    }
  }
  return {from, to};
}

/** Drive titles come from neighboring stays — not the travel row's place columns. */
export function driveRouteLabelsFromDayTrips(
  trips: readonly TripRow[],
  tripIndex: number,
): {fromLabel: string | null; toLabel: string | null; routeTitle: string | null} {
  const {from, to} = adjacentStaysForTrip(trips, tripIndex);
  const fromLabel = from != null ? labelFromTripRow(from) : null;
  const toLabel = to != null ? labelFromTripRow(to) : null;
  if (fromLabel && toLabel) {
    return {fromLabel, toLabel, routeTitle: `${fromLabel} → ${toLabel}`};
  }
  return {
    fromLabel,
    toLabel,
    routeTitle: fromLabel ?? toLabel,
  };
}
