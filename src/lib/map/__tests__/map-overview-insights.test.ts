import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import type { TripRow } from '@/db/repositories/trips';
import { buildMapOverviewInsights, listMapOverviewDrillRows } from '@/lib/map/map-overview-insights';

function trip(
  partial: Partial<TripRow> & Pick<TripRow, 'kind' | 'dateKey'>,
): TripRow {
  const startAt = partial.startAt ?? new Date('2026-08-02T12:00:00Z');
  return {
    id: partial.id ?? 1,
    eventKey: partial.eventKey ?? `e-${partial.dateKey}-${partial.kind}-${partial.id ?? 1}`,
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
  partial: Pick<SavedPlaceRow, 'id' | 'kind' | 'label'> &
    Partial<Pick<SavedPlaceRow, 'lat' | 'lng'>>,
): SavedPlaceRow {
  return {
    id: partial.id,
    kind: partial.kind,
    label: partial.label,
    lat: partial.lat ?? 33.2,
    lng: partial.lng ?? -97.1,
    radiusMeters: 80,
    addressLine: null,
    active: true,
    createdAt: new Date(),
  };
}

describe('buildMapOverviewInsights', () => {
  it('aggregates home stay totals and full-day stays', () => {
    const overview = buildMapOverviewInsights({
      savedPlaces: [saved({ id: 1, kind: 'home', label: 'Home' })],
      trips: [
        trip({
          id: 1,
          kind: 'stay',
          dateKey: '2026-08-01',
          placeId: 1,
          placeKind: 'saved',
          durationMs: 26 * 3_600_000,
          startAt: new Date('2026-08-01T02:00:00Z'),
          endAt: new Date('2026-08-02T04:00:00Z'),
          segmentOrder: 0,
        }),
        trip({
          id: 2,
          kind: 'stay',
          dateKey: '2026-08-02',
          placeId: 1,
          placeKind: 'saved',
          durationMs: 2 * 3_600_000,
          startAt: new Date('2026-08-02T18:00:00Z'),
          endAt: new Date('2026-08-02T20:00:00Z'),
          segmentOrder: 0,
        }),
      ],
    });

    expect(overview.home.configured).toBe(true);
    expect(overview.home.stayCount).toBe(2);
    expect(overview.home.fullDayStayCount).toBe(1);
    expect(overview.home.totalMs).toBe(28 * 3_600_000);
    expect(overview.home.longestStayMs).toBe(26 * 3_600_000);
    expect(overview.home.shortestStayMs).toBe(2 * 3_600_000);
    expect(overview.home.avgStayMs).toBe(14 * 3_600_000);
  });

  it('uses summed home time per day for shortest stay, not a single segment', () => {
    const overview = buildMapOverviewInsights({
      savedPlaces: [saved({ id: 1, kind: 'home', label: 'Home' })],
      trips: [
        // Day A: three short visits → 3 hours total
        trip({
          id: 1,
          kind: 'stay',
          dateKey: '2026-08-01',
          placeId: 1,
          placeKind: 'saved',
          durationMs: 60 * 60_000,
          startAt: new Date('2026-08-01T12:00:00Z'),
          endAt: new Date('2026-08-01T13:00:00Z'),
          segmentOrder: 0,
        }),
        trip({
          id: 2,
          kind: 'stay',
          dateKey: '2026-08-01',
          placeId: 1,
          placeKind: 'saved',
          durationMs: 60 * 60_000,
          startAt: new Date('2026-08-01T15:00:00Z'),
          endAt: new Date('2026-08-01T16:00:00Z'),
          segmentOrder: 1,
        }),
        trip({
          id: 3,
          kind: 'stay',
          dateKey: '2026-08-01',
          placeId: 1,
          placeKind: 'saved',
          durationMs: 60 * 60_000,
          startAt: new Date('2026-08-01T20:00:00Z'),
          endAt: new Date('2026-08-01T21:00:00Z'),
          segmentOrder: 2,
        }),
        // Day B: one visit → 2 hours (shortest day)
        trip({
          id: 4,
          kind: 'stay',
          dateKey: '2026-08-02',
          placeId: 1,
          placeKind: 'saved',
          durationMs: 2 * 3_600_000,
          startAt: new Date('2026-08-02T18:00:00Z'),
          endAt: new Date('2026-08-02T20:00:00Z'),
          segmentOrder: 0,
        }),
        // Day C: longer
        trip({
          id: 5,
          kind: 'stay',
          dateKey: '2026-08-03',
          placeId: 1,
          placeKind: 'saved',
          durationMs: 8 * 3_600_000,
          startAt: new Date('2026-08-03T10:00:00Z'),
          endAt: new Date('2026-08-03T18:00:00Z'),
          segmentOrder: 0,
        }),
      ],
    });

    // Must be 2h day total — not the 1h individual segments on day A.
    expect(overview.home.shortestStayMs).toBe(2 * 3_600_000);
    expect(overview.home.longestStayMs).toBe(8 * 3_600_000);
  });

  it('ignores days with a gray missing/gap bar for shortest day at home', () => {
    const overview = buildMapOverviewInsights({
      savedPlaces: [saved({ id: 1, kind: 'home', label: 'Home' })],
      trips: [
        // Incomplete day: short home total + gray missing bar — must not win.
        trip({
          id: 1,
          kind: 'stay',
          dateKey: '2026-08-01',
          placeId: 1,
          placeKind: 'saved',
          durationMs: 30 * 60_000,
          startAt: new Date('2026-08-01T12:00:00Z'),
          endAt: new Date('2026-08-01T12:30:00Z'),
          segmentOrder: 0,
        }),
        trip({
          id: 2,
          kind: 'missing',
          dateKey: '2026-08-01',
          durationMs: 6 * 3_600_000,
          startAt: new Date('2026-08-01T12:30:00Z'),
          endAt: new Date('2026-08-01T18:30:00Z'),
          segmentOrder: 1,
        }),
        // Complete day: longer home time — becomes shortest eligible day.
        trip({
          id: 3,
          kind: 'stay',
          dateKey: '2026-08-02',
          placeId: 1,
          placeKind: 'saved',
          durationMs: 4 * 3_600_000,
          startAt: new Date('2026-08-02T14:00:00Z'),
          endAt: new Date('2026-08-02T18:00:00Z'),
          segmentOrder: 0,
        }),
        trip({
          id: 4,
          kind: 'travel',
          dateKey: '2026-08-02',
          durationMs: 20 * 60_000,
          distanceKm: 5,
          startAt: new Date('2026-08-02T18:00:00Z'),
          endAt: new Date('2026-08-02T18:20:00Z'),
          segmentOrder: 1,
        }),
      ],
    });

    expect(overview.home.shortestStayMs).toBe(4 * 3_600_000);
  });

  it('aggregates work visits, commute, and weekday counts', () => {
    const overview = buildMapOverviewInsights({
      savedPlaces: [
        saved({ id: 1, kind: 'home', label: 'Home', lat: 33.2, lng: -97.1 }),
        saved({ id: 2, kind: 'work', label: 'Office', lat: 33.25, lng: -97.12 }),
      ],
      trips: [
        trip({
          id: 1,
          kind: 'stay',
          dateKey: '2026-08-03',
          placeId: 1,
          placeKind: 'saved',
          startAt: new Date('2026-08-03T12:00:00Z'), // Mon morning local depends on TZ
          endAt: new Date('2026-08-03T13:00:00Z'),
          durationMs: 3_600_000,
          segmentOrder: 0,
        }),
        trip({
          id: 2,
          kind: 'travel',
          dateKey: '2026-08-03',
          distanceKm: 10,
          durationMs: 20 * 60_000,
          startAt: new Date('2026-08-03T13:00:00Z'),
          endAt: new Date('2026-08-03T13:20:00Z'),
          segmentOrder: 1,
        }),
        trip({
          id: 3,
          kind: 'stay',
          dateKey: '2026-08-03',
          placeId: 2,
          placeKind: 'saved',
          startAt: new Date('2026-08-03T13:20:00Z'),
          endAt: new Date('2026-08-03T21:00:00Z'),
          durationMs: 7 * 3_600_000 + 40 * 60_000,
          segmentOrder: 2,
        }),
        trip({
          id: 4,
          kind: 'travel',
          dateKey: '2026-08-03',
          distanceKm: 12,
          durationMs: 30 * 60_000,
          startAt: new Date('2026-08-03T21:00:00Z'),
          endAt: new Date('2026-08-03T21:30:00Z'),
          segmentOrder: 3,
        }),
        trip({
          id: 5,
          kind: 'stay',
          dateKey: '2026-08-03',
          placeId: 1,
          placeKind: 'saved',
          startAt: new Date('2026-08-03T21:30:00Z'),
          endAt: new Date('2026-08-03T23:00:00Z'),
          durationMs: 90 * 60_000,
          segmentOrder: 4,
        }),
        // Second commute shorter
        trip({
          id: 6,
          kind: 'stay',
          dateKey: '2026-08-04',
          placeId: 1,
          placeKind: 'saved',
          startAt: new Date('2026-08-04T12:00:00Z'),
          endAt: new Date('2026-08-04T13:00:00Z'),
          durationMs: 3_600_000,
          segmentOrder: 0,
        }),
        trip({
          id: 7,
          kind: 'travel',
          dateKey: '2026-08-04',
          distanceKm: 10,
          durationMs: 15 * 60_000,
          startAt: new Date('2026-08-04T13:00:00Z'),
          endAt: new Date('2026-08-04T13:15:00Z'),
          segmentOrder: 1,
        }),
        trip({
          id: 8,
          kind: 'stay',
          dateKey: '2026-08-04',
          placeId: 2,
          placeKind: 'saved',
          startAt: new Date('2026-08-04T13:15:00Z'),
          endAt: new Date('2026-08-04T18:00:00Z'),
          durationMs: 4 * 3_600_000 + 45 * 60_000,
          segmentOrder: 2,
        }),
      ],
    });

    expect(overview.work.configured).toBe(true);
    expect(overview.work.visitCount).toBe(2);
    expect(overview.work.commuteCount).toBe(2);
    expect(overview.work.commuteMinMs).toBe(15 * 60_000);
    expect(overview.work.commuteMaxMs).toBe(20 * 60_000);
    expect(overview.work.distanceToWorkKm).toBeGreaterThan(0);
    expect(overview.work.speedAvgKmh).toBeGreaterThan(0);
    expect(overview.work.weekdayCounts.length).toBeGreaterThan(0);
    expect(overview.work.typicalArriveMinutes).not.toBeNull();
    expect(overview.work.typicalLeaveMinutes).not.toBeNull();
  });

  it('lists full-day home stays for drill-down', () => {
    const trips = [
      trip({
        id: 1,
        kind: 'stay',
        dateKey: '2026-08-01',
        placeId: 1,
        placeKind: 'saved',
        durationMs: 26 * 3_600_000,
        startAt: new Date('2026-08-01T02:00:00Z'),
        endAt: new Date('2026-08-02T04:00:00Z'),
        segmentOrder: 0,
      }),
      trip({
        id: 2,
        kind: 'stay',
        dateKey: '2026-08-02',
        placeId: 1,
        placeKind: 'saved',
        durationMs: 2 * 3_600_000,
        startAt: new Date('2026-08-02T18:00:00Z'),
        endAt: new Date('2026-08-02T20:00:00Z'),
        segmentOrder: 0,
      }),
    ];
    const rows = listMapOverviewDrillRows({
      kind: 'home_stays_full_day',
      trips,
      savedPlaces: [saved({ id: 1, kind: 'home', label: 'Home' })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tripId).toBe(1);
  });

  it('drills shortest home day as one summed day row', () => {
    const trips = [
      trip({
        id: 1,
        kind: 'stay',
        dateKey: '2026-08-01',
        placeId: 1,
        placeKind: 'saved',
        durationMs: 60 * 60_000,
        startAt: new Date('2026-08-01T12:00:00Z'),
        endAt: new Date('2026-08-01T13:00:00Z'),
        segmentOrder: 0,
      }),
      trip({
        id: 2,
        kind: 'stay',
        dateKey: '2026-08-01',
        placeId: 1,
        placeKind: 'saved',
        durationMs: 60 * 60_000,
        startAt: new Date('2026-08-01T15:00:00Z'),
        endAt: new Date('2026-08-01T16:00:00Z'),
        segmentOrder: 1,
      }),
      trip({
        id: 3,
        kind: 'stay',
        dateKey: '2026-08-02',
        placeId: 1,
        placeKind: 'saved',
        durationMs: 45 * 60_000,
        startAt: new Date('2026-08-02T12:00:00Z'),
        endAt: new Date('2026-08-02T12:45:00Z'),
        segmentOrder: 0,
      }),
      trip({
        id: 4,
        kind: 'stay',
        dateKey: '2026-08-02',
        placeId: 1,
        placeKind: 'saved',
        durationMs: 45 * 60_000,
        startAt: new Date('2026-08-02T18:00:00Z'),
        endAt: new Date('2026-08-02T18:45:00Z'),
        segmentOrder: 1,
      }),
    ];
    const rows = listMapOverviewDrillRows({
      kind: 'home_stay_shortest',
      trips,
      savedPlaces: [saved({ id: 1, kind: 'home', label: 'Home' })],
    });
    // Day 2 totals 90m < day 1's 2h — one summed row, not two segments.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.dateKey).toBe('2026-08-02');
    expect(rows[0]!.id).toBe('home-day:2026-08-02');
    expect(rows[0]!.valueLabel).toBe('1 hr 30 min');
  });
});
