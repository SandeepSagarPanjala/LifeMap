import {
  VISIT_LABEL_OVERRIDE_START_MATCH_MS,
  matchVisitLabelOverride,
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

  it('returns nearest start within the match window', () => {
    const rows = [override({ startAtMs: 1_000, poiId: 9 })];
    const near = 1_000 + VISIT_LABEL_OVERRIDE_START_MATCH_MS - 1;
    expect(matchVisitLabelOverride(rows, near)?.poiId).toBe(9);
  });

  it('returns null when start is outside the match window', () => {
    const rows = [override({ startAtMs: 1_000, poiId: 9 })];
    const far = 1_000 + VISIT_LABEL_OVERRIDE_START_MATCH_MS + 1;
    expect(matchVisitLabelOverride(rows, far)).toBeNull();
  });

  it('still matches when algorithm shifts stay start by more than five minutes', () => {
    const rows = [override({ startAtMs: 1_000, poiId: 9 })];
    const tenMinutes = 1_000 + 10 * 60 * 1000;
    expect(matchVisitLabelOverride(rows, tenMinutes)?.poiId).toBe(9);
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

  it('finds overrides when sealed start drifts slightly from open start', () => {
    const rows = [override({ startAtMs: 1_000, poiId: 99 })];
    expect(findVisitLabelOverrideForStart(rows, 1_000 + 30_000)?.poiId).toBe(
      99,
    );
  });

  it('consumes an override so a later nearby stay cannot reuse it', () => {
    const rows = [override({ id: 7, startAtMs: 1_000, poiId: 99 })];
    expect(takeVisitLabelOverrideForStart(rows, 1_000 + 30_000)?.poiId).toBe(
      99,
    );
    expect(rows).toHaveLength(0);
    expect(takeVisitLabelOverrideForStart(rows, 1_000 + 60_000)).toBeNull();
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
