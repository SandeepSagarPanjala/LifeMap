import type { PlaceLookupRow } from './types';

export type PlaceKind = 'saved' | 'cache';

export type ResolvedPlace = {
  placeLabel: string;
  placeId: number;
  placeKind: PlaceKind;
  poiId?: number;
  poiLabel?: string;
};

export function resolvedPlaceFromSaved(place: {
  id: number;
  label: string;
}): ResolvedPlace {
  return {
    placeLabel: place.label,
    placeId: place.id,
    placeKind: 'saved',
  };
}

/** Cache match — placeLabel is the street address only. */
export function resolvedPlaceFromCache(
  cache: PlaceLookupRow,
): ResolvedPlace | null {
  const address = cache.addressLine?.trim();
  if (!address) {
    return null;
  }
  return {
    placeLabel: address,
    placeId: cache.id,
    placeKind: 'cache',
  };
}

export function applyResolvedPlace(
  target: {
    placeLabel?: string;
    placeId?: number;
    placeKind?: PlaceKind;
    poiId?: number;
    poiLabel?: string;
  },
  resolved: ResolvedPlace,
): void {
  target.placeLabel = resolved.placeLabel;
  target.placeId = resolved.placeId;
  target.placeKind = resolved.placeKind;
  target.poiId = resolved.poiId;
  target.poiLabel = resolved.poiLabel;
}

export function clearResolvedPlace(target: {
  placeLabel?: string;
  placeId?: number;
  placeKind?: PlaceKind;
  poiId?: number;
  poiLabel?: string;
}): void {
  target.placeLabel = undefined;
  target.placeId = undefined;
  target.placeKind = undefined;
  target.poiId = undefined;
  target.poiLabel = undefined;
}

export function applyResolvedPoi(
  target: { poiId?: number; poiLabel?: string; poiCategory?: string | null },
  poi: { id: number; name: string; category?: string | null },
): void {
  target.poiId = poi.id;
  target.poiLabel = poi.name;
  target.poiCategory = poi.category ?? null;
}

export function clearResolvedPoi(target: {
  poiId?: number;
  poiLabel?: string;
  poiCategory?: string | null;
}): void {
  target.poiId = undefined;
  target.poiLabel = undefined;
  target.poiCategory = undefined;
}
