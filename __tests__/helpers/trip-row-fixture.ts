import type {TripRow} from '@/db/repositories/trips';

export function makeTripRow(
  partial: Partial<TripRow> & Pick<TripRow, 'id' | 'eventKey' | 'kind' | 'startAt' | 'endAt'>,
): TripRow {
  return {
    dateKey: '2026-06-14',
    durationMs: partial.endAt.getTime() - partial.startAt.getTime(),
    distanceKm: partial.kind === 'travel' ? 1 : 0,
    centroidLat: 33.2,
    centroidLng: -97.1,
    segmentOrder: 0,
    savedPlaceLabel: null,
    savedPlaceId: null,
    inferred: false,
    placeLookupCacheId: null,
    selectedCandidateIndex: null,
    detectionVersion: 14,
    closedAt: partial.endAt,
    ...partial,
  };
}
