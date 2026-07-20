import {
  matchVisitLabelOverride,
  matchVisitLabelOverrideForStay,
  type VisitLabelOverrideRow,
} from '@/db/repositories/visit-label-overrides';
import {
  existingTripLabelsByEventKey,
  tripEventKey,
  tripLabelForPersist,
} from '@/lib/trip-materialization';
import {
  findVisitLabelOverrideForStart,
  mergeOverrideIntoPersistLabel,
  shouldApplyVisitLabelOverride,
  takeVisitLabelOverrideForStart,
  takeVisitLabelOverrideForStay,
  visitLabelOverrideToResolved,
} from '@/lib/visit-label-override';
import type { DetectedTrip } from '@/lib/trip-detection';
import { makeTripRow } from './helpers/trip-row-fixture';

function stay(
  startMs: number,
  endMs: number,
  openThroughNow?: boolean,
): DetectedTrip {
  return {
    id: `stay-${startMs}`,
    kind: 'stay',
    points: [],
    startAt: new Date(startMs),
    endAt: new Date(endMs),
    durationMs: endMs - startMs,
    distanceKm: 0,
    openThroughNow,
  };
}

function override(
  partial: Partial<VisitLabelOverrideRow> & {
    startAtMs: number;
    poiId: number;
  },
): VisitLabelOverrideRow {
  return {
    id: partial.id ?? 1,
    dateKey: partial.dateKey ?? '2026-07-12',
    startAtMs: partial.startAtMs,
    endAtMs: partial.endAtMs ?? null,
    anchorLat: partial.anchorLat ?? null,
    anchorLng: partial.anchorLng ?? null,
    poiId: partial.poiId,
    poiLabel: partial.poiLabel ?? 'Chili\'s',
    placeId: partial.placeId ?? 42,
    placeKind: partial.placeKind ?? 'cache',
    updatedAt: partial.updatedAt ?? new Date(),
  };
}

describe('matchVisitLabelOverride', () => {
  it('returns exact start match', () => {
    const rows = [
      override({ id: 1, startAtMs: 1_000, poiId: 2 }),
      override({ id: 2, startAtMs: 2_000, poiId: 3, poiLabel: 'Other' }),
    ];
    expect(matchVisitLabelOverride(rows, 1_000)?.poiId).toBe(2);
  });

  it('does not match a different stay start even within 45 minutes', () => {
    const rows = [override({ startAtMs: 1_000, poiId: 9 })];
    const eighteenMinutes = 1_000 + 18 * 60 * 1000;
    expect(matchVisitLabelOverride(rows, eighteenMinutes)).toBeNull();
  });

  it('does not match when start drifts by ten minutes', () => {
    const rows = [override({ startAtMs: 1_000, poiId: 9 })];
    const tenMinutes = 1_000 + 10 * 60 * 1000;
    expect(matchVisitLabelOverride(rows, tenMinutes)).toBeNull();
  });
});

describe('matchVisitLabelOverrideForStay', () => {
  const VISHNU = { lat: 33.2, lng: -97.13 };

  it('prefers an exact start match', () => {
    const rows = [
      override({
        id: 1,
        startAtMs: 1_000,
        poiId: 2,
        anchorLat: VISHNU.lat,
        anchorLng: VISHNU.lng,
      }),
    ];
    expect(
      matchVisitLabelOverrideForStay(rows, {
        startAtMs: 1_000,
        anchorLat: VISHNU.lat,
        anchorLng: VISHNU.lng,
      })?.poiId,
    ).toBe(2);
  });

  it('re-attaches by place when the start drifts', () => {
    const rows = [
      override({
        id: 1,
        startAtMs: 1_000,
        poiId: 7,
        anchorLat: VISHNU.lat,
        anchorLng: VISHNU.lng,
      }),
    ];
    // Same spot, start shifted by 12 minutes on rebuild.
    const shifted = 1_000 + 12 * 60 * 1000;
    expect(
      matchVisitLabelOverrideForStay(rows, {
        startAtMs: shifted,
        anchorLat: VISHNU.lat + 0.0002,
        anchorLng: VISHNU.lng - 0.0002,
      })?.poiId,
    ).toBe(7);
  });

  it('never re-attaches to a different venue', () => {
    const rows = [
      override({
        id: 1,
        startAtMs: 1_000,
        poiId: 7,
        anchorLat: VISHNU.lat,
        anchorLng: VISHNU.lng,
      }),
    ];
    // A stop ~1.5 km away must not steal the pick, even minutes later.
    expect(
      matchVisitLabelOverrideForStay(rows, {
        startAtMs: 1_000 + 5 * 60 * 1000,
        anchorLat: VISHNU.lat + 0.014,
        anchorLng: VISHNU.lng,
      }),
    ).toBeNull();
  });

  it('does not spatially match legacy rows without an anchor', () => {
    const rows = [override({ id: 1, startAtMs: 1_000, poiId: 7 })];
    expect(
      matchVisitLabelOverrideForStay(rows, {
        startAtMs: 2_000,
        anchorLat: VISHNU.lat,
        anchorLng: VISHNU.lng,
      }),
    ).toBeNull();
  });

  it('picks the nearest start among same-place revisits', () => {
    const rows = [
      override({
        id: 1,
        startAtMs: 1_000,
        poiId: 7,
        anchorLat: VISHNU.lat,
        anchorLng: VISHNU.lng,
      }),
      override({
        id: 2,
        startAtMs: 100_000,
        poiId: 8,
        anchorLat: VISHNU.lat,
        anchorLng: VISHNU.lng,
      }),
    ];
    expect(
      matchVisitLabelOverrideForStay(rows, {
        startAtMs: 95_000,
        anchorLat: VISHNU.lat,
        anchorLng: VISHNU.lng,
      })?.poiId,
    ).toBe(8);
  });

  it('consumes a stay match so a revisit cannot reuse it', () => {
    const rows = [
      override({
        id: 7,
        startAtMs: 1_000,
        poiId: 99,
        anchorLat: VISHNU.lat,
        anchorLng: VISHNU.lng,
      }),
    ];
    expect(
      takeVisitLabelOverrideForStay(rows, {
        startAtMs: 1_000 + 60_000,
        anchorLat: VISHNU.lat,
        anchorLng: VISHNU.lng,
      })?.poiId,
    ).toBe(99);
    expect(rows).toHaveLength(0);
    expect(
      takeVisitLabelOverrideForStay(rows, {
        startAtMs: 1_000 + 60_000,
        anchorLat: VISHNU.lat,
        anchorLng: VISHNU.lng,
      }),
    ).toBeNull();
  });
});

describe('shouldApplyVisitLabelOverride', () => {
  it('applies for open visits even when a poi is already present', () => {
    expect(
      shouldApplyVisitLabelOverride({
        materializedTripId: null,
        poiId: 1,
        openThroughNow: true,
      }),
    ).toBe(true);
  });

  it('applies when there is no materialized trip', () => {
    expect(
      shouldApplyVisitLabelOverride({
        materializedTripId: null,
        poiId: null,
      }),
    ).toBe(true);
  });

  it('skips when a sealed trip already has a poi', () => {
    expect(
      shouldApplyVisitLabelOverride({
        materializedTripId: 7,
        poiId: 3,
      }),
    ).toBe(false);
  });
});

describe('mergeOverrideIntoPersistLabel', () => {
  it('lets the user override win over detection when sealing', () => {
    const entry = stay(1_000, 2_000);
    const eventKey = tripEventKey(entry);
    const detected = tripLabelForPersist(eventKey, new Map(), {
      placeKind: 'cache',
      placeId: 12,
      placeLabel: '123 Main St',
      poiId: 1,
      poiLabel: "It's Just Wings",
      poiCategory: null,
    });

    expect(
      mergeOverrideIntoPersistLabel(
        detected,
        override({
          startAtMs: 1_000,
          poiId: 99,
          poiLabel: "Chili's",
          placeId: 12,
        }),
      ),
    ).toEqual({
      placeLabel: '123 Main St',
      placeId: 12,
      placeKind: 'cache',
      poiId: 99,
      poiLabel: "Chili's",
      poiCategory: null,
    });
  });

  it('still prefers existing trip labels, then applies override poi', () => {
    const entry = stay(1_000, 2_000);
    const eventKey = tripEventKey(entry);
    const existing = existingTripLabelsByEventKey([
      makeTripRow({
        id: 3,
        eventKey,
        kind: 'stay',
        startAt: new Date(1_000),
        endAt: new Date(2_000),
        placeId: 12,
        placeKind: 'cache',
        poiId: 2,
        poiLabel: 'Custom POI',
      }),
    ]);
    const base = tripLabelForPersist(eventKey, existing, {
      placeKind: 'cache',
      placeId: 12,
      placeLabel: null,
      poiId: 0,
      poiLabel: 'Other',
      poiCategory: null,
    });

    expect(
      mergeOverrideIntoPersistLabel(
        base,
        override({
          startAtMs: 1_000,
          poiId: 99,
          poiLabel: "Chili's",
          placeId: 12,
        }),
      ).poiId,
    ).toBe(99);
  });

  it('only finds overrides at the exact sealed start', () => {
    const rows = [override({ startAtMs: 1_000, poiId: 99 })];
    expect(findVisitLabelOverrideForStart(rows, 1_000)?.poiId).toBe(99);
    expect(findVisitLabelOverrideForStart(rows, 1_000 + 30_000)).toBeNull();
  });

  it('consumes an exact override so it cannot apply twice', () => {
    const rows = [override({ id: 7, startAtMs: 1_000, poiId: 99 })];
    expect(takeVisitLabelOverrideForStart(rows, 1_000)?.poiId).toBe(99);
    expect(rows).toHaveLength(0);
    expect(takeVisitLabelOverrideForStart(rows, 1_000)).toBeNull();
  });
});

describe('visitLabelOverrideToResolved', () => {
  it('keeps address fallback while applying the selected poi', () => {
    expect(
      visitLabelOverrideToResolved(override({ startAtMs: 1, poiId: 5 }), {
        placeLabel: '123 Main St',
        placeId: 12,
        placeKind: 'cache',
        poiId: 1,
        poiLabel: "It's Just Wings",
        poiCategory: 'MKPOICategoryRestaurant',
      }),
    ).toEqual({
      placeLabel: '123 Main St',
      placeId: 42,
      placeKind: 'cache',
      poiId: 5,
      poiLabel: "Chili's",
      poiCategory: 'MKPOICategoryRestaurant',
    });
  });
});
