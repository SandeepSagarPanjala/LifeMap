import type {TripRow} from '@/db/repositories/trips';
import type {DetectedTrip, PlaceKind} from '@/lib/trip-detection';

export type {PlaceKind};

export type ResolvedPlaceFields = {
  placeLabel: string | null;
  placeId: number | null;
  placeKind: PlaceKind | null;
  poiId: number | null;
  poiLabel: string | null;
};

export function tripPlaceFieldsFromResolved(
  resolved: ResolvedPlaceFields,
): ResolvedPlaceFields {
  return {
    placeLabel: resolved.placeLabel?.trim() || null,
    placeId: resolved.placeId,
    placeKind: resolved.placeKind,
    poiId: resolved.poiId,
    poiLabel: resolved.poiLabel?.trim() || null,
  };
}

export function tripPlaceFieldsFromDetected(
  entry: Pick<
    DetectedTrip,
    | 'kind'
    | 'placeLabel'
    | 'placeId'
    | 'placeKind'
    | 'poiId'
    | 'poiLabel'
  >,
): ResolvedPlaceFields {
  if (entry.kind !== 'stay') {
    return {
      placeLabel: null,
      placeId: null,
      placeKind: null,
      poiId: null,
      poiLabel: null,
    };
  }
  return tripPlaceFieldsFromResolved({
    placeLabel: entry.placeLabel ?? null,
    placeId: entry.placeId ?? null,
    placeKind: entry.placeKind ?? null,
    poiId: entry.poiId ?? null,
    poiLabel: entry.poiLabel ?? null,
  });
}

export function resolvedPlaceFromTripRow(
  row: Pick<
    TripRow,
    'placeLabel' | 'placeId' | 'placeKind' | 'poiId' | 'poiLabel'
  >,
): ResolvedPlaceFields {
  return {
    placeLabel: row.placeLabel?.trim() || null,
    placeId: row.placeId,
    placeKind: row.placeKind,
    poiId: row.poiId,
    poiLabel: row.poiLabel?.trim() || null,
  };
}

export function applyResolvedPlaceToDetected(
  trip: DetectedTrip,
  resolved: ResolvedPlaceFields,
): DetectedTrip {
  return {
    ...trip,
    placeLabel: resolved.placeLabel ?? undefined,
    placeId: resolved.placeId ?? undefined,
    placeKind: resolved.placeKind ?? undefined,
    poiId: resolved.poiId ?? undefined,
    poiLabel: resolved.poiLabel ?? undefined,
  };
}
