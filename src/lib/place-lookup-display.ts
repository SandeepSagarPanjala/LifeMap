import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import type {PlacePoiRow} from '@/lib/place-lookup-types';
import {PLACE_LOOKUP_VENUE_RADIUS_M} from '@/lib/app-constants';
import {
  visitDisplayLabel,
  type VisitPlaceDisplay,
} from '@/lib/place-lookup-types';

export function savedPlaceVisitDisplay(
  place: SavedPlaceRow,
): VisitPlaceDisplay {
  return {
    source: 'saved',
    addressLabel: null,
    primaryLabel: place.label,
    candidates: [],
    selectedPoiId: null,
    cacheId: null,
    materializedTripId: null,
    loading: false,
    venueRadiusMeters: PLACE_LOOKUP_VENUE_RADIUS_M,
  };
}

export function resolveVisitPlaceDisplay(input: {
  placeKind?: 'saved' | 'cache' | null;
  placeLabel?: string | null;
  poiId?: number | null;
  poiLabel?: string | null;
  cacheId?: number | null;
  pois?: readonly PlacePoiRow[];
  materializedTripId?: number | null;
  loading?: boolean;
  venueRadiusMeters?: number;
}): VisitPlaceDisplay {
  if (input.placeKind === 'saved') {
    return {
      source: 'saved',
      addressLabel: null,
      primaryLabel: input.placeLabel?.trim() || null,
      candidates: [],
      selectedPoiId: null,
      cacheId: null,
      materializedTripId: input.materializedTripId ?? null,
      loading: false,
      venueRadiusMeters:
        input.venueRadiusMeters ?? PLACE_LOOKUP_VENUE_RADIUS_M,
    };
  }

  if (input.placeKind === 'cache') {
    const candidates = (input.pois ?? []).map(poi => ({
      id: poi.id,
      name: poi.name,
      source: poi.source,
    }));
    const primaryLabel = visitDisplayLabel({
      placeKind: 'cache',
      placeLabel: input.placeLabel,
      poiLabel: input.poiLabel,
    });

    return {
      source: 'lookup',
      addressLabel: input.placeLabel?.trim() || null,
      primaryLabel,
      candidates,
      selectedPoiId: input.poiId ?? null,
      cacheId: input.cacheId ?? null,
      materializedTripId: input.materializedTripId ?? null,
      loading: input.loading ?? false,
      venueRadiusMeters:
        input.venueRadiusMeters ?? PLACE_LOOKUP_VENUE_RADIUS_M,
    };
  }

  return {
    source: 'none',
    addressLabel: null,
    primaryLabel: input.placeLabel?.trim() || null,
    candidates: [],
    selectedPoiId: null,
    cacheId: null,
    materializedTripId: input.materializedTripId ?? null,
    loading: input.loading ?? false,
    venueRadiusMeters: PLACE_LOOKUP_VENUE_RADIUS_M,
  };
}
