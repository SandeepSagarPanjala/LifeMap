import { TZDate } from '@date-fns/tz';

import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import type { TripRow } from '@/db/repositories/trips';
import {
  buildMapInsightsSummary,
  mapInsightPreviousPeriodBounds,
} from '@/lib/map/map-insights';
import { APP_TIMEZONE } from '@/lib/timezone';

function trip(
  partial: Partial<TripRow> & Pick<TripRow, 'kind' | 'dateKey'>,
): TripRow {
  const startAt = partial.startAt ?? new Date('2026-08-02T12:00:00Z');
  return {
    id: partial.id ?? 1,
    eventKey: partial.eventKey ?? `e-${partial.dateKey}-${partial.kind}`,
    kind: partial.kind,
    dateKey: partial.dateKey,
    startAt,
    endAt: partial.endAt ?? new Date(startAt.getTime() + 3_600_000),
    durationMs: partial.durationMs ?? 3_600_000,
    distanceKm: partial.distanceKm ?? 0,
    centroidLat: 0,
    centroidLng: 0,
    segmentOrder: partial.segmentOrder ?? 0,
    placeLabel: partial.placeLabel ?? null,
    placeId: partial.placeId ?? null,
    placeKind: partial.placeKind ?? null,
    poiId: partial.poiId ?? null,
    poiLabel: partial.poiLabel ?? null,
    poiCategory: null,
    inferred: false,
    detectionVersion: 1,
    closedAt: startAt,
    momentRefs: [],
  };
}

function saved(
  partial: Pick<SavedPlaceRow, 'id' | 'kind' | 'label'>,
): SavedPlaceRow {
  return {
    id: partial.id,
    kind: partial.kind,
    label: partial.label,
    lat: 0,
    lng: 0,
    radiusMeters: 80,
    addressLine: null,
    active: true,
    createdAt: new Date(),
  };
}

describe('buildMapInsightsSummary', () => {
  it('adjusts home for sleep and ranks frequent travels', () => {
    const now = new TZDate(2026, 7, 2, 18, 0, 0, 0, APP_TIMEZONE);
    const homeStart = new Date('2026-08-02T02:00:00Z');
    const homeEnd = new Date('2026-08-02T14:00:00Z'); // 12h
    const summary = buildMapInsightsSummary({
      period: 'week',
      now,
      sleepEnabled: true,
      sleepSessions: [
        {
          startAt: new Date('2026-08-02T05:00:00Z'),
          endAt: new Date('2026-08-02T12:00:00Z'), // 7h overlap
        },
      ],
      savedPlaces: [
        saved({ id: 1, kind: 'home', label: 'Home' }),
        saved({ id: 2, kind: 'work', label: 'Office' }),
        saved({ id: 3, kind: 'favorite', label: 'Gym' }),
      ],
      trips: [
        trip({
          kind: 'stay',
          dateKey: '2026-08-02',
          placeId: 1,
          placeKind: 'saved',
          placeLabel: 'Home',
          startAt: homeStart,
          endAt: homeEnd,
          durationMs: homeEnd.getTime() - homeStart.getTime(),
          segmentOrder: 0,
        }),
        trip({
          kind: 'travel',
          dateKey: '2026-08-02',
          distanceKm: 10,
          durationMs: 20 * 60_000,
          startAt: homeEnd,
          endAt: new Date(homeEnd.getTime() + 20 * 60_000),
          segmentOrder: 1,
        }),
        trip({
          kind: 'stay',
          dateKey: '2026-08-02',
          placeId: 2,
          placeKind: 'saved',
          placeLabel: 'Office',
          startAt: new Date(homeEnd.getTime() + 20 * 60_000),
          endAt: new Date(homeEnd.getTime() + 5 * 3_600_000),
          durationMs: 5 * 3_600_000 - 20 * 60_000,
          segmentOrder: 2,
        }),
        trip({
          kind: 'travel',
          dateKey: '2026-08-02',
          distanceKm: 10,
          durationMs: 25 * 60_000,
          startAt: new Date(homeEnd.getTime() + 5 * 3_600_000),
          endAt: new Date(homeEnd.getTime() + 5 * 3_600_000 + 25 * 60_000),
          segmentOrder: 3,
        }),
        trip({
          kind: 'stay',
          dateKey: '2026-08-02',
          placeId: 1,
          placeKind: 'saved',
          placeLabel: 'Home',
          startAt: new Date(homeEnd.getTime() + 5 * 3_600_000 + 25 * 60_000),
          endAt: new Date(homeEnd.getTime() + 8 * 3_600_000),
          durationMs: 3 * 3_600_000 - 25 * 60_000,
          segmentOrder: 4,
        }),
        trip({
          kind: 'travel',
          dateKey: '2026-08-02',
          distanceKm: 4,
          durationMs: 15 * 60_000,
          startAt: new Date('2026-08-02T20:00:00Z'),
          endAt: new Date('2026-08-02T20:15:00Z'),
          segmentOrder: 5,
          eventKey: 't3',
        }),
        trip({
          kind: 'stay',
          dateKey: '2026-08-02',
          placeId: 3,
          placeKind: 'saved',
          placeLabel: 'Gym',
          startAt: new Date('2026-08-02T20:15:00Z'),
          endAt: new Date('2026-08-02T21:15:00Z'),
          durationMs: 3_600_000,
          segmentOrder: 6,
          eventKey: 'gym',
        }),
        trip({
          kind: 'travel',
          dateKey: '2026-08-02',
          distanceKm: 4,
          durationMs: 18 * 60_000,
          startAt: new Date('2026-08-02T21:15:00Z'),
          endAt: new Date('2026-08-02T21:33:00Z'),
          segmentOrder: 7,
          eventKey: 't4',
        }),
        trip({
          kind: 'stay',
          dateKey: '2026-08-02',
          placeId: 1,
          placeKind: 'saved',
          placeLabel: 'Home',
          startAt: new Date('2026-08-02T21:33:00Z'),
          endAt: new Date('2026-08-02T23:00:00Z'),
          durationMs: 87 * 60_000,
          segmentOrder: 8,
          eventKey: 'home2',
        }),
      ],
    });

    expect(summary.distanceKm).toBe(28);
    expect(summary.sleepEnabled).toBe(true);
    expect(summary.sleepMs).toBe(7 * 3_600_000);

    const home = summary.placeTimes.find(row => row.kind === 'home');
    const rawHome =
      12 * 3_600_000 + (3 * 3_600_000 - 25 * 60_000) + 87 * 60_000;
    expect(home?.durationMs).toBe(rawHome - 7 * 3_600_000);

    expect(summary.placeTimes.some(row => row.kind === 'work')).toBe(true);
    expect(summary.placeTimes.some(row => row.label === 'Gym')).toBe(true);
    expect(
      summary.frequentTravels.every(row => row.count >= 2),
    ).toBe(true);
  });

  it('groups repeated travels with avg min max', () => {
    const now = new TZDate(2026, 7, 2, 18, 0, 0, 0, APP_TIMEZONE);
    const summary = buildMapInsightsSummary({
      period: 'week',
      now,
      sleepEnabled: false,
      savedPlaces: [
        saved({ id: 1, kind: 'home', label: 'Home' }),
        saved({ id: 2, kind: 'work', label: 'Office' }),
      ],
      trips: [
        trip({
          kind: 'stay',
          dateKey: '2026-08-02',
          placeId: 1,
          placeKind: 'saved',
          startAt: new Date('2026-08-02T08:00:00Z'),
          endAt: new Date('2026-08-02T09:00:00Z'),
          durationMs: 3_600_000,
          segmentOrder: 0,
        }),
        trip({
          kind: 'travel',
          dateKey: '2026-08-02',
          durationMs: 20 * 60_000,
          distanceKm: 8,
          startAt: new Date('2026-08-02T09:00:00Z'),
          endAt: new Date('2026-08-02T09:20:00Z'),
          segmentOrder: 1,
        }),
        trip({
          kind: 'stay',
          dateKey: '2026-08-02',
          placeId: 2,
          placeKind: 'saved',
          startAt: new Date('2026-08-02T09:20:00Z'),
          endAt: new Date('2026-08-02T12:00:00Z'),
          durationMs: 160 * 60_000,
          segmentOrder: 2,
        }),
        trip({
          kind: 'travel',
          dateKey: '2026-08-02',
          durationMs: 30 * 60_000,
          distanceKm: 8,
          startAt: new Date('2026-08-02T12:00:00Z'),
          endAt: new Date('2026-08-02T12:30:00Z'),
          segmentOrder: 3,
        }),
        trip({
          kind: 'stay',
          dateKey: '2026-08-02',
          placeId: 1,
          placeKind: 'saved',
          startAt: new Date('2026-08-02T12:30:00Z'),
          endAt: new Date('2026-08-02T13:00:00Z'),
          durationMs: 30 * 60_000,
          segmentOrder: 4,
        }),
        trip({
          kind: 'travel',
          dateKey: '2026-08-02',
          durationMs: 22 * 60_000,
          distanceKm: 8,
          startAt: new Date('2026-08-02T13:00:00Z'),
          endAt: new Date('2026-08-02T13:22:00Z'),
          segmentOrder: 5,
        }),
        trip({
          kind: 'stay',
          dateKey: '2026-08-02',
          placeId: 2,
          placeKind: 'saved',
          startAt: new Date('2026-08-02T13:22:00Z'),
          endAt: new Date('2026-08-02T17:00:00Z'),
          durationMs: 218 * 60_000,
          segmentOrder: 6,
        }),
      ],
    });

    const homeToOffice = summary.frequentTravels.find(
      row => row.fromLabel === 'Home' && row.toLabel === 'Office',
    );
    expect(homeToOffice).toBeTruthy();
    expect(homeToOffice!.count).toBe(2);
    expect(homeToOffice!.minMs).toBe(20 * 60_000);
    expect(homeToOffice!.maxMs).toBe(22 * 60_000);
    expect(homeToOffice!.avgMs).toBe(21 * 60_000);

    expect(summary.rhythm.leaveSampleCount).toBe(2);
    expect(summary.rhythm.returnSampleCount).toBe(1);
    expect(summary.rhythm.typicalLeaveHomeMinutes).not.toBeNull();
    expect(summary.rhythm.typicalReturnHomeMinutes).toBeNull();
  });

  it('detects top places, new places, nights away, and comparison', () => {
    const now = new TZDate(2026, 7, 5, 18, 0, 0, 0, APP_TIMEZONE);
    // Week starts Sunday Aug 2 → Aug 5. Previous same-length ends Aug 1.
    const prev = mapInsightPreviousPeriodBounds('week', now);

    const summary = buildMapInsightsSummary({
      period: 'week',
      now,
      sleepEnabled: false,
      savedPlaces: [saved({ id: 1, kind: 'home', label: 'Home' })],
      trips: [
        // History before current week — Cafe known
        trip({
          kind: 'stay',
          dateKey: '2026-07-20',
          poiId: 10,
          poiLabel: 'Old Cafe',
          placeLabel: 'Old Cafe',
          startAt: new Date('2026-07-20T15:00:00Z'),
          endAt: new Date('2026-07-20T16:00:00Z'),
          durationMs: 3_600_000,
          eventKey: 'old-cafe',
        }),
        // Previous period distance
        trip({
          kind: 'travel',
          dateKey: prev.startDateKey,
          distanceKm: 5,
          durationMs: 10 * 60_000,
          startAt: new Date('2026-07-26T12:00:00Z'),
          endAt: new Date('2026-07-26T12:10:00Z'),
          eventKey: 'prev-travel',
        }),
        // Night away: stay spanning Aug 2→3 midnight not at home
        trip({
          kind: 'stay',
          dateKey: '2026-08-02',
          poiId: 99,
          poiLabel: 'Hotel',
          placeLabel: 'Hotel',
          startAt: new Date('2026-08-02T20:00:00Z'),
          endAt: new Date('2026-08-03T10:00:00Z'),
          durationMs: 14 * 3_600_000,
          eventKey: 'hotel',
        }),
        // New POI this week
        trip({
          kind: 'stay',
          dateKey: '2026-08-04',
          poiId: 42,
          poiLabel: 'New Bakery',
          placeLabel: 'New Bakery',
          startAt: new Date('2026-08-04T14:00:00Z'),
          endAt: new Date('2026-08-04T15:30:00Z'),
          durationMs: 90 * 60_000,
          eventKey: 'bakery',
        }),
        trip({
          kind: 'travel',
          dateKey: '2026-08-04',
          distanceKm: 12,
          durationMs: 20 * 60_000,
          startAt: new Date('2026-08-04T15:30:00Z'),
          endAt: new Date('2026-08-04T15:50:00Z'),
          eventKey: 'cur-travel',
        }),
        // Known cafe again — not new
        trip({
          kind: 'stay',
          dateKey: '2026-08-05',
          poiId: 10,
          poiLabel: 'Old Cafe',
          placeLabel: 'Old Cafe',
          startAt: new Date('2026-08-05T11:00:00Z'),
          endAt: new Date('2026-08-05T12:00:00Z'),
          durationMs: 3_600_000,
          eventKey: 'old-cafe-2',
        }),
      ],
    });

    expect(summary.nightsAway).toBeGreaterThanOrEqual(1);
    expect(summary.topPlaces.some(row => row.label === 'New Bakery')).toBe(
      true,
    );
    expect(summary.topPlaces.some(row => row.label === 'Hotel')).toBe(true);
    expect(summary.newPlaces.some(row => row.label === 'New Bakery')).toBe(
      true,
    );
    expect(summary.newPlaces.some(row => row.label === 'Old Cafe')).toBe(
      false,
    );
    expect(summary.distanceKm).toBe(12);
    expect(summary.comparison.distanceKmDelta).toBe(7);
  });
});
