import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {PLACE_LOOKUP_VENUE_RADIUS_M} from '@/lib/place-lookup-venue';
import type {
  PlaceLookupRow,
  VisitPlaceDisplay,
  VisitPlaceDisplayCandidate,
} from '@/lib/place-lookup-types';

const EMPTY_DISPLAY_BASE = {
  customLabel: null,
  venueRadiusMeters: PLACE_LOOKUP_VENUE_RADIUS_M,
} as const;

export function buildVisitPlaceCandidates(
  row: PlaceLookupRow,
): VisitPlaceDisplayCandidate[] {
  const candidates = [...row.candidates];
  if (
    row.addressLine &&
    !candidates.some(
      c =>
        c.name.trim().toLowerCase() === row.addressLine!.trim().toLowerCase(),
    )
  ) {
    candidates.push({
      id: `address-${row.id}`,
      name: row.addressLine,
      kind: 'address',
      distanceM: 0,
    });
  }
  return candidates.map(c => ({name: c.name, kind: c.kind}));
}

export function resolveVisitPlaceDisplay(
  row: PlaceLookupRow | null,
  options?: {
    loading?: boolean;
    selectedIndexOverride?: number | null;
    isTripLabel?: boolean;
    customLabel?: string | null;
  },
): VisitPlaceDisplay {
  if (!row || row.lookupStatus === 'pending') {
    return {
      source: 'none',
      primaryLabel: null,
      candidates: [],
      selectedIndex: 0,
      cacheId: row?.id ?? null,
      materializedTripId: null,
      loading: options?.loading ?? row?.lookupStatus === 'pending',
      isAreaDefault: false,
      isTripLabel: false,
      ...EMPTY_DISPLAY_BASE,
      venueRadiusMeters: row?.venueRadiusMeters ?? PLACE_LOOKUP_VENUE_RADIUS_M,
    };
  }

  if (row.lookupStatus === 'failed') {
    return {
      source: 'none',
      primaryLabel: null,
      candidates: [],
      selectedIndex: 0,
      cacheId: row.id,
      materializedTripId: null,
      loading: false,
      isAreaDefault: false,
      isTripLabel: false,
      ...EMPTY_DISPLAY_BASE,
      venueRadiusMeters: row.venueRadiusMeters,
    };
  }

  const candidates = buildVisitPlaceCandidates(row);
  const customLabel = options?.customLabel?.trim() || null;

  if (customLabel) {
    return {
      source: 'lookup',
      primaryLabel: customLabel,
      customLabel,
      candidates,
      selectedIndex: 0,
      cacheId: row.id,
      materializedTripId: null,
      loading: false,
      isAreaDefault: false,
      isTripLabel: true,
      venueRadiusMeters: row.venueRadiusMeters,
    };
  }

  if (candidates.length === 0) {
    return {
      source: 'none',
      primaryLabel: null,
      candidates: [],
      selectedIndex: 0,
      cacheId: row.id,
      materializedTripId: null,
      loading: false,
      isAreaDefault: false,
      isTripLabel: false,
      ...EMPTY_DISPLAY_BASE,
      venueRadiusMeters: row.venueRadiusMeters,
    };
  }

  const hasTripOverride =
    options?.selectedIndexOverride != null &&
    options.selectedIndexOverride >= 0 &&
    options.selectedIndexOverride < candidates.length;

  const selectedIndex = hasTripOverride
    ? options!.selectedIndexOverride!
    : row.selectedCandidateIndex != null &&
        row.selectedCandidateIndex >= 0 &&
        row.selectedCandidateIndex < candidates.length
      ? row.selectedCandidateIndex
      : 0;

  return {
    source: 'lookup',
    primaryLabel: candidates[selectedIndex]?.name ?? null,
    customLabel: null,
    candidates,
    selectedIndex,
    cacheId: row.id,
    materializedTripId: null,
    loading: false,
    isAreaDefault: !hasTripOverride && row.selectedCandidateIndex != null,
    isTripLabel: options?.isTripLabel === true && hasTripOverride,
    venueRadiusMeters: row.venueRadiusMeters,
  };
}

export function savedPlaceVisitDisplay(
  place: SavedPlaceRow,
): VisitPlaceDisplay {
  return {
    source: 'saved',
    primaryLabel: place.label,
    customLabel: null,
    candidates: [{name: place.label, kind: 'poi'}],
    selectedIndex: 0,
    cacheId: null,
    materializedTripId: null,
    loading: false,
    isAreaDefault: false,
    isTripLabel: false,
    venueRadiusMeters: PLACE_LOOKUP_VENUE_RADIUS_M,
  };
}
