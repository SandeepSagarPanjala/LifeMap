import {
  buildTimelineFromTrips,
  canReadDayFromMaterializedTrips,
} from '@/lib/timeline-from-trips';
import {
  isClosedPlayableEntry,
  tripEventKey,
  TRIP_DETECTION_VERSION,
} from '@/lib/trip-materialization';
import type {TripRow} from '@/db/repositories/trips';
import type {DetectedTrip} from '@/lib/trip-detection';

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

describe('canReadDayFromMaterializedTrips', () => {
  it('only reads complete days at the current detection version', () => {
    expect(
      canReadDayFromMaterializedTrips(
        {
          dateKey: '2026-06-01',
          status: 'complete',
          detectionVersion: TRIP_DETECTION_VERSION,
          tripCount: 2,
          pointCount: 10,
          sealedAt: new Date(),
          updatedAt: new Date(),
        },
        TRIP_DETECTION_VERSION,
      ),
    ).toBe(true);

    expect(
      canReadDayFromMaterializedTrips(
        {
          dateKey: '2026-06-01',
          status: 'partial',
          detectionVersion: TRIP_DETECTION_VERSION,
          tripCount: 1,
          pointCount: 10,
          sealedAt: null,
          updatedAt: new Date(),
        },
        TRIP_DETECTION_VERSION,
      ),
    ).toBe(false);
  });
});

describe('buildTimelineFromTrips', () => {
  it('rehydrates playable entries with materialized ids and inserts gaps', () => {
    const rows: TripRow[] = [
      {
        id: 7,
        eventKey: 'stay:1000:2000',
        kind: 'stay',
        dateKey: '2026-06-01',
        startAt: new Date(1_000),
        endAt: new Date(2_000),
        durationMs: 1_000,
        distanceKm: 0,
        centroidLat: 37.77,
        centroidLng: -122.42,
        placeLookupCacheId: null,
        selectedCandidateIndex: null,
        detectionVersion: 1,
        closedAt: new Date(2_000),
      },
      {
        id: 8,
        eventKey: 'travel:200000:201000',
        kind: 'travel',
        dateKey: '2026-06-01',
        startAt: new Date(200_000),
        endAt: new Date(201_000),
        durationMs: 1_000,
        distanceKm: 1.2,
        centroidLat: 37.78,
        centroidLng: -122.41,
        placeLookupCacheId: null,
        selectedCandidateIndex: null,
        detectionVersion: 1,
        closedAt: new Date(201_000),
      },
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
      {
        id: 1,
        eventKey: 'stay:1:2',
        kind: 'stay',
        dateKey: '2026-06-06',
        startAt: new Date('2026-06-06T18:06:00.000Z'),
        endAt: departAt,
        durationMs: 1,
        distanceKm: 0,
        centroidLat: 33.05579,
        centroidLng: -96.83429,
        placeLookupCacheId: null,
        selectedCandidateIndex: null,
        detectionVersion: 1,
        closedAt: departAt,
      },
      {
        id: 2,
        eventKey: 'travel:2:3',
        kind: 'travel',
        dateKey: '2026-06-06',
        startAt: departAt,
        endAt: new Date('2026-06-06T20:13:00.000Z'),
        durationMs: 1,
        distanceKm: 1,
        centroidLat: 33.05,
        centroidLng: -96.833,
        placeLookupCacheId: null,
        selectedCandidateIndex: null,
        detectionVersion: 1,
        closedAt: new Date('2026-06-06T20:13:00.000Z'),
      },
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
