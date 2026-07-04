import {primaryLabelFromPlaceLookup} from './place-lookup';
import type {PlaceLookupRow, SavedPlaceRow} from './types';

export type PlaceKind = 'saved' | 'cache';

export type ResolvedPlace = {
  placeLabel: string;
  placeId: number;
  placeKind: PlaceKind;
};

export function resolvedPlaceFromSaved(place: SavedPlaceRow): ResolvedPlace {
  return {
    placeLabel: place.label,
    placeId: place.id,
    placeKind: 'saved',
  };
}

export function resolvedPlaceFromCache(
  cache: PlaceLookupRow,
): ResolvedPlace | null {
  const placeLabel = primaryLabelFromPlaceLookup(cache);
  if (placeLabel == null) {
    return null;
  }
  return {
    placeLabel,
    placeId: cache.id,
    placeKind: 'cache',
  };
}

export function applyResolvedPlace(
  target: {
    placeLabel?: string;
    placeId?: number;
    placeKind?: PlaceKind;
  },
  resolved: ResolvedPlace,
): void {
  target.placeLabel = resolved.placeLabel;
  target.placeId = resolved.placeId;
  target.placeKind = resolved.placeKind;
}

export function clearResolvedPlace(target: {
  placeLabel?: string;
  placeId?: number;
  placeKind?: PlaceKind;
}): void {
  target.placeLabel = undefined;
  target.placeId = undefined;
  target.placeKind = undefined;
}
