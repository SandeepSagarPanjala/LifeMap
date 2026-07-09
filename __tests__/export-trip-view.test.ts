import type {TripPointRow} from '@/db/repositories/trip-points';
import type {TripRow} from '@/db/repositories/trips';
import {
  buildExportTripView,
  driveRouteLabelsFromDayTrips,
  exportTripKindSummary,
  formatExportDateTime,
} from '@/lib/export-trip-view';

function trip(overrides: Partial<TripRow> = {}): TripRow {
  return {
    id: 1,
    eventKey: 'stay-1',
    kind: 'stay',
    dateKey: '2026-07-07',
    startAt: new Date('2026-07-07T14:00:00.000Z'),
    endAt: new Date('2026-07-07T15:00:00.000Z'),
    durationMs: 3_600_000,
    distanceKm: 0,
    centroidLat: 33.21,
    centroidLng: -97.13,
    segmentOrder: 1,
    placeLabel: 'Home',
    placeId: 2,
    placeKind: 'saved',
    poiId: null,
    poiLabel: null,
    inferred: false,
    selectedCandidateIndex: null,
    detectionVersion: 10,
    closedAt: new Date('2026-07-07T15:00:00.000Z'),
    momentRefs: [],
    ...overrides,
  };
}

describe('export-trip-view', () => {
  it('formats local time in app timezone', () => {
    const field = formatExportDateTime(new Date('2026-07-07T14:00:00.000Z'));
    expect(field.local).toContain('Jul');
    expect(field.utc).toBe('2026-07-07T14:00:00.000Z');
  });

  it('builds a trip view with points', () => {
    const points: TripPointRow[] = [
      {
        id: 10,
        tripId: 1,
        seq: 0,
        lat: 33.21,
        lng: -97.13,
        recordedAt: new Date('2026-07-07T14:05:00.000Z'),
        locationPointId: 99,
        source: 'gps',
        momentId: null,
      },
    ];
    const view = buildExportTripView(trip(), points, 'km');
    expect(view.placeLabel).toBe('Home');
    expect(view.pointCount).toBe(1);
    expect(view.points[0]?.recordedAt?.local).toContain('Jul');
  });

  it('summarizes segment kinds for a day row', () => {
    expect(exportTripKindSummary(2, 1, 0)).toBe('2 stays · 1 drive');
  });

  it('derives drive route labels from neighboring stays', () => {
    const dayTrips: TripRow[] = [
      trip({id: 1, kind: 'stay', segmentOrder: 1, placeLabel: 'Home', placeKind: 'saved', placeId: 2}),
      trip({id: 2, kind: 'travel', segmentOrder: 2}),
      trip({
        id: 3,
        kind: 'stay',
        segmentOrder: 3,
        placeKind: 'cache',
        placeLabel: '123 Main St',
        poiLabel: 'Tesla Supercharger',
        poiId: 9,
      }),
    ];
    expect(driveRouteLabelsFromDayTrips(dayTrips, 1)).toEqual({
      fromLabel: 'Home',
      toLabel: 'Tesla Supercharger',
      routeTitle: 'Home → Tesla Supercharger',
    });
  });
});
