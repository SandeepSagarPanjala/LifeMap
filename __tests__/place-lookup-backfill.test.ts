import {
  isStayMissingPlaceLabel,
  listStaysNeedingPlaceLookup,
  mergeTripPlaceLabelAfterLookup,
  tripLookupAnchorFromRow,
  tripRowToBackfillStay,
} from '@/lib/place-lookup-backfill';
import type { PlaceLookupRow } from '@/lib/place-lookup-types';
import { PLACE_LOOKUP_VENUE_RADIUS_M } from '@/lib/app-constants';
import type { PersistedTripLabel } from '@/lib/trip-materialization';
import { getDefaultTripDetectionConfig } from '@/lib/trip-materialization';
import type { TripRow } from '@/db/repositories/trips';

function tripRow(overrides: Partial<TripRow> = {}): TripRow {
  return {
    id: 1,
    eventKey: 'stay:1710000000000:1710003600000',
    kind: 'stay',
    dateKey: '2026-03-09',
    startAt: new Date('2026-03-09T12:00:00.000Z'),
    endAt: new Date('2026-03-09T13:00:00.000Z'),
    durationMs: 60 * 60_000,
    distanceKm: 0,
    centroidLat: 37.7749,
    centroidLng: -122.4194,
    segmentOrder: 1,
    placeLabel: null,
    placeId: null,
    placeKind: null,
    poiId: null,
    poiLabel: null,
    inferred: false,
    selectedCandidateIndex: null,
    detectionVersion: 1,
    closedAt: new Date('2026-03-09T13:00:00.000Z'),
    momentRefs: [],
    ...overrides,
  };
}

function cacheRow(overrides: Partial<PlaceLookupRow> = {}): PlaceLookupRow {
  return {
    id: 9,
    anchorLat: 37.7749,
    anchorLng: -122.4194,
    venueRadiusMeters: PLACE_LOOKUP_VENUE_RADIUS_M,
    addressLine: '123 Main St',
    lookupStatus: 'complete',
    fetchedAt: new Date(),
    ...overrides,
  };
}

describe('place-lookup-backfill', () => {
  it('uses sealed trip centroid as lookup anchor', () => {
    const row = tripRow({ centroidLat: 40.1, centroidLng: -74.2 });
    expect(tripLookupAnchorFromRow(row)).toEqual({ lat: 40.1, lng: -74.2 });
  });

  it('detects stays missing any place label', () => {
    expect(isStayMissingPlaceLabel(tripRow())).toBe(true);
    expect(
      isStayMissingPlaceLabel(tripRow({ placeId: 2, placeKind: 'saved' })),
    ).toBe(false);
    expect(
      isStayMissingPlaceLabel(tripRow({ placeId: 3, placeKind: 'cache' })),
    ).toBe(false);
    expect(
      isStayMissingPlaceLabel(tripRow({ poiId: 42, poiLabel: 'Walmart' })),
    ).toBe(false);
    expect(isStayMissingPlaceLabel(tripRow({ placeLabel: 'Walmart' }))).toBe(
      false,
    );
    expect(isStayMissingPlaceLabel(tripRow({ kind: 'travel' }))).toBe(false);
  });

  it('lists qualifying unlabeled stays only', () => {
    const config = { ...getDefaultTripDetectionConfig(), gapMinutes: 15 };
    const rows = [
      tripRow(),
      tripRow({
        id: 2,
        eventKey: 'stay:2',
        durationMs: 60_000,
      }),
      tripRow({
        id: 3,
        eventKey: 'stay:3',
        placeLabel: 'Home',
        placeKind: 'saved',
        placeId: 1,
      }),
    ];
    expect(listStaysNeedingPlaceLookup(rows, config)).toHaveLength(1);
    expect(listStaysNeedingPlaceLookup(rows, config)[0]!.id).toBe(1);
  });

  it('builds backfill stay with anchor from trip row', () => {
    const row = tripRow();
    const stay = tripRowToBackfillStay(row);
    expect(stay.anchorLat).toBe(row.centroidLat);
    expect(stay.anchorLng).toBe(row.centroidLng);
    expect(stay.durationMs).toBe(row.durationMs);
  });

  it('preserves user POI selection on rebuild merge by eventKey', () => {
    const eventKey = 'stay:1710000000000:1710003600000';
    const existing = new Map<string, PersistedTripLabel>([
      [
        eventKey,
        {
          placeLabel: '123 Main St',
          placeId: 5,
          placeKind: 'cache',
          poiId: 10,
          poiLabel: 'Walmart',
        },
      ],
    ]);

    const merged = mergeTripPlaceLabelAfterLookup(
      eventKey,
      existing,
      cacheRow({ id: 9 }),
    );

    expect(merged.placeLabel).toBe('123 Main St');
    expect(merged.poiId).toBe(10);
    expect(merged.poiLabel).toBe('Walmart');
    expect(merged.placeId).toBe(5);
  });
});
