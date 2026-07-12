import {
  buildTimelineFromStoredTrips,
  buildTimelineFromTrips,
  canReadDayFromMaterializedTrips,
} from '@/lib/timeline-from-trips';
import {
  existingTripLabelsByEventKey,
  isClosedPlayableEntry,
  isImplausibleMaterializedTravel,
  todaySealNeedsPersist,
  todayStoredHistoryNeedsLiveTail,
  tripEventKey,
  tripLabelForPersist,
} from '@/lib/trip-materialization';
import { TRIP_DETECTION_VERSION } from '@/lib/app-constants';
import type { TripRow } from '@/db/repositories/trips';
import type { DetectedTrip } from '@/lib/trip-detection';
import { makeMaterializedDay, makeTripPoint } from './helpers/fixtures';
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

function travel(startMs: number, endMs: number): DetectedTrip {
  return {
    id: `travel-${startMs}`,
    kind: 'travel',
    points: [],
    startAt: new Date(startMs),
    endAt: new Date(endMs),
    durationMs: endMs - startMs,
    distanceKm: 2.4,
  };
}

describe('tripEventKey', () => {
  it('is stable for the same closed stay', () => {
    const entry = stay(1_000, 2_000);
    expect(tripEventKey(entry)).toBe('stay:1000:2000');
  });
});

describe('isClosedPlayableEntry', () => {
  it('treats open visits as not persistable', () => {
    expect(isClosedPlayableEntry(stay(1, 2, true))).toBe(false);
  });

  it('treats closed stays and drives as persistable', () => {
    expect(isClosedPlayableEntry(stay(1, 2))).toBe(true);
    expect(isClosedPlayableEntry(travel(1, 2))).toBe(true);
  });
});

describe('todayStoredHistoryNeedsLiveTail', () => {
  it('returns true when the sealed prefix ends on a drive', () => {
    expect(
      todayStoredHistoryNeedsLiveTail([
        stay(1_000, 2_000),
        travel(2_000, 3_000),
      ]),
    ).toBe(true);
  });

  it('returns false when the sealed prefix already has an open stay', () => {
    expect(
      todayStoredHistoryNeedsLiveTail([
        travel(1_000, 2_000),
        stay(2_000, 3_000, true),
      ]),
    ).toBe(false);
  });
});

describe('todaySealNeedsPersist', () => {
  it('returns false when sealable prefix matches existing rows', () => {
    const home = stay(1_000, 4_000);
    const drive = travel(4_000, 5_000);
    expect(
      todaySealNeedsPersist(
        [{ eventKey: tripEventKey(home) }, { eventKey: tripEventKey(drive) }],
        [home, drive],
      ),
    ).toBe(false);
  });

  it('returns true when stale partial drives remain in the DB', () => {
    const home = stay(1_000, 4_000);
    const partialDrive = travel(4_000, 4_500);
    const finalDrive = travel(4_000, 5_000);
    expect(
      todaySealNeedsPersist(
        [
          { eventKey: tripEventKey(home) },
          { eventKey: tripEventKey(partialDrive) },
        ],
        [home, finalDrive],
      ),
    ).toBe(true);
  });

  it('returns true when a new closed segment appears', () => {
    const home = stay(1_000, 4_000);
    const drive = travel(4_000, 5_000);
    expect(
      todaySealNeedsPersist([{ eventKey: tripEventKey(home) }], [home, drive]),
    ).toBe(true);
  });
});

describe('tripLabelForPersist', () => {
  it('keeps a visit-specific label when the day is re-materialized', () => {
    const eventKey = tripEventKey(stay(1_000, 2_000));
    const existing = existingTripLabelsByEventKey([
      makeTripRow({
        id: 3,
        eventKey,
        kind: 'stay',
        startAt: new Date(1_000),
        endAt: new Date(2_000),
        detectionVersion: 2,
        placeId: 12,
        placeKind: 'cache',
        poiId: 2,
        poiLabel: 'Custom POI',
        poiCategory: null,
      }),
    ]);

    expect(
      tripLabelForPersist(eventKey, existing, {
        placeKind: 'cache',
        placeId: 12,
        placeLabel: null,
        poiId: 0,
        poiLabel: 'Other POI',
        poiCategory: null,
      }),
    ).toEqual({
      placeLabel: null,
      placeId: 12,
      placeKind: 'cache',
      poiId: 2,
      poiLabel: 'Custom POI',
      poiCategory: null,
    });
  });

  it('uses detected cache when no visit label was saved', () => {
    const eventKey = tripEventKey(stay(1_000, 2_000));

    expect(
      tripLabelForPersist(eventKey, new Map(), {
        placeKind: 'cache',
        placeId: 9,
        placeLabel: '123 Main St',
        poiId: 1,
        poiLabel: 'Walmart',
        poiCategory: 'MKPOICategoryStore',
      }),
    ).toEqual({
      placeLabel: '123 Main St',
      placeId: 9,
      placeKind: 'cache',
      poiId: 1,
      poiLabel: 'Walmart',
      poiCategory: 'MKPOICategoryStore',
    });
  });
});

describe('isImplausibleMaterializedTravel', () => {
  it('flags Jun 8 corrupt 22hr cached drive', () => {
    const corrupt = makeTripRow({
      id: 416,
      eventKey: 'travel:1:2',
      kind: 'travel',
      dateKey: '2026-06-08',
      startAt: new Date('2026-06-08T04:51:23.000Z'),
      endAt: new Date('2026-06-09T03:25:14.000Z'),
      durationMs: 81_231_000,
      distanceKm: 31.35,
      centroidLat: 33.23,
      centroidLng: -97.02,
      detectionVersion: 1,
      closedAt: new Date(),
    });
    expect(isImplausibleMaterializedTravel(corrupt)).toBe(true);
  });

  it('allows a normal half-hour commute', () => {
    const commute = makeTripRow({
      id: 1,
      eventKey: 'travel:1:2',
      kind: 'travel',
      dateKey: '2026-06-08',
      startAt: new Date('2026-06-08T04:51:23.000Z'),
      endAt: new Date('2026-06-08T05:20:24.000Z'),
      durationMs: 1_741_000,
      distanceKm: 27.6,
      centroidLat: 33.23,
      centroidLng: -97.02,
      detectionVersion: 2,
      closedAt: new Date(),
    });
    expect(isImplausibleMaterializedTravel(commute)).toBe(false);
  });
});

describe('canReadDayFromMaterializedTrips', () => {
  it('only reads complete days at the current detection version', () => {
    expect(
      canReadDayFromMaterializedTrips(
        makeMaterializedDay({
          dateKey: '2026-06-01',
          status: 'complete',
          detectionVersion: TRIP_DETECTION_VERSION,
          tripCount: 2,
          pointCount: 10,
          sealedAt: new Date(),
        }),
        TRIP_DETECTION_VERSION,
      ),
    ).toBe(true);

    expect(
      canReadDayFromMaterializedTrips(
        makeMaterializedDay({
          dateKey: '2026-06-01',
          status: 'partial',
          detectionVersion: TRIP_DETECTION_VERSION,
          tripCount: 1,
          pointCount: 10,
        }),
        TRIP_DETECTION_VERSION,
      ),
    ).toBe(false);
  });
});

describe('buildTimelineFromTrips', () => {
  it('rehydrates playable entries with materialized ids and inserts gaps', () => {
    const rows: TripRow[] = [
      makeTripRow({
        id: 7,
        eventKey: 'stay:1000:2000',
        kind: 'stay',
        dateKey: '2026-06-01',
        startAt: new Date(1_000),
        endAt: new Date(2_000),
        centroidLat: 37.77,
        centroidLng: -122.42,
      }),
      makeTripRow({
        id: 8,
        eventKey: 'travel:200000:201000',
        kind: 'travel',
        dateKey: '2026-06-01',
        startAt: new Date(200_000),
        endAt: new Date(201_000),
        distanceKm: 1.2,
        centroidLat: 37.78,
        centroidLng: -122.41,
      }),
    ];

    const timeline = buildTimelineFromTrips(rows, []);
    expect(timeline).toHaveLength(3);
    expect(timeline[0]?.kind).toBe('stay');
    expect(timeline[1]?.kind).toBe('gap');
    expect(timeline[2]?.kind).toBe('travel');
    if (timeline[0]?.kind === 'stay') {
      expect(timeline[0].materializedTripId).toBe(7);
      expect(timeline[0].id).toBe('materialized-7');
    }
  });

  it('does not assign departure road GPS to the previous stay', () => {
    const libraryAt = new Date('2026-06-06T19:49:17.000Z');
    const departAt = new Date('2026-06-06T19:58:55.000Z');
    const rows: TripRow[] = [
      makeTripRow({
        id: 1,
        eventKey: 'stay:1:2',
        kind: 'stay',
        dateKey: '2026-06-06',
        startAt: new Date('2026-06-06T18:06:00.000Z'),
        endAt: departAt,
        centroidLat: 33.05579,
        centroidLng: -96.83429,
        closedAt: departAt,
      }),
      makeTripRow({
        id: 2,
        eventKey: 'travel:2:3',
        kind: 'travel',
        dateKey: '2026-06-06',
        startAt: departAt,
        endAt: new Date('2026-06-06T20:13:00.000Z'),
        centroidLat: 33.05,
        centroidLng: -96.833,
        closedAt: new Date('2026-06-06T20:13:00.000Z'),
      }),
    ];
    const routePoints = [
      {
        id: 1,
        timestamp: libraryAt,
        lat: 33.05579,
        lng: -96.83429,
        accuracy: 10,
        altitude: null,
        speed: 0,
        source: 'gps',
      },
      {
        id: 2,
        timestamp: departAt,
        lat: 33.05124,
        lng: -96.83318,
        accuracy: 10,
        altitude: null,
        speed: 14,
        source: 'gps',
      },
    ];

    const timeline = buildTimelineFromTrips(rows, routePoints);
    expect(timeline[0]?.kind).toBe('stay');
    expect(timeline[1]?.kind).toBe('travel');
    if (timeline[0]?.kind === 'stay' && timeline[1]?.kind === 'travel') {
      expect(timeline[0].points).toHaveLength(1);
      expect(timeline[0].points[0]?.lat).toBeCloseTo(33.05579, 4);
      expect(timeline[1].points[0]?.lat).toBeCloseTo(33.05124, 4);
    }
  });
});

describe('buildTimelineFromStoredTrips', () => {
  it('hydrates stays with anchor points and drives from trip_points', () => {
    const rows: TripRow[] = [
      makeTripRow({
        id: 1,
        eventKey: 'stay:1:2',
        kind: 'stay',
        dateKey: '2026-06-01',
        startAt: new Date(1_000),
        endAt: new Date(2_000),
        centroidLat: 37.77,
        centroidLng: -122.42,
      }),
      makeTripRow({
        id: 2,
        eventKey: 'travel:2:3',
        kind: 'travel',
        dateKey: '2026-06-01',
        startAt: new Date(3_000),
        endAt: new Date(4_000),
        distanceKm: 1.2,
        centroidLat: 37.78,
        centroidLng: -122.41,
      }),
    ];
    const pointsByTripId = new Map([
      [
        2,
        [
          makeTripPoint({
            id: 10,
            tripId: 2,
            seq: 0,
            lat: 37.77,
            lng: -122.42,
          }),
          makeTripPoint({
            id: 11,
            tripId: 2,
            seq: 1,
            lat: 37.78,
            lng: -122.41,
          }),
        ],
      ],
    ]);

    const timeline = buildTimelineFromStoredTrips(rows, pointsByTripId);
    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.kind).toBe('stay');
    expect(timeline[1]?.kind).toBe('travel');
    if (timeline[0]?.kind === 'stay') {
      expect(timeline[0].points).toHaveLength(1);
      expect(timeline[0].points[0]?.lat).toBe(37.77);
    }
    if (timeline[1]?.kind === 'travel') {
      expect(timeline[1].points).toHaveLength(2);
    }
  });
});
