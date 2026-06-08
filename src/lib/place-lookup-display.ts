import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import type {
  PlaceLookupRow,
  VisitPlaceDisplay,
  VisitPlaceDisplayCandidate,
} from '@/lib/place-lookup-types';

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
  options?: {loading?: boolean},
): VisitPlaceDisplay {
  if (!row || row.lookupStatus === 'pending') {
    return {
      source: 'none',
      primaryLabel: null,
      candidates: [],
      selectedIndex: 0,
      cacheId: row?.id ?? null,
      loading: options?.loading ?? row?.lookupStatus === 'pending',
    };
  }

  if (row.lookupStatus === 'failed') {
    return {
      source: 'none',
      primaryLabel: null,
      candidates: [],
      selectedIndex: 0,
      cacheId: row.id,
      loading: false,
    };
  }

  const candidates = buildVisitPlaceCandidates(row);
  if (candidates.length === 0) {
    return {
      source: 'none',
      primaryLabel: null,
      candidates: [],
      selectedIndex: 0,
      cacheId: row.id,
      loading: false,
    };
  }

  const selectedIndex =
    row.selectedCandidateIndex != null &&
    row.selectedCandidateIndex >= 0 &&
    row.selectedCandidateIndex < candidates.length
      ? row.selectedCandidateIndex
      : 0;

  return {
    source: 'lookup',
    primaryLabel: candidates[selectedIndex]?.name ?? null,
    candidates,
    selectedIndex,
    cacheId: row.id,
    loading: false,
  };
}

export function savedPlaceVisitDisplay(
  place: SavedPlaceRow,
): VisitPlaceDisplay {
  return {
    source: 'saved',
    primaryLabel: place.label,
    candidates: [{name: place.label, kind: 'poi'}],
    selectedIndex: 0,
    cacheId: null,
    loading: false,
  };
}
