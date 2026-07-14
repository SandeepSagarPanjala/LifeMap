import {
  canExtendOpenStayWithNewPoints,
  openStayEventKey,
  shouldRunTodayOpenSilentSeal,
  TODAY_OPEN_SILENT_SEAL_MIN_TAIL_SEGMENTS,
} from '@/lib/today-sync';
import { buildTripDetectionConfig } from '@/lib/trip-settings';
import type { TripRow } from '@/db/repositories/trips';
import { makeTripRow } from './helpers/trip-row-fixture';

const config = buildTripDetectionConfig(10, 10, 150);

function stayTrip(overrides: Partial<TripRow> = {}): TripRow {
  const startAt = new Date('2026-06-22T08:00:00');
  const endAt = new Date('2026-06-22T20:00:00');
  return makeTripRow({
    id: 1,
    eventKey: 'stay:open',
    kind: 'stay',
    startAt,
    endAt,
    centroidLat: 33.21,
    centroidLng: -97.13,
    ...overrides,
  });
}

describe('openStayEventKey', () => {
  it('is stable for the same start time', () => {
    const startAt = new Date('2026-06-22T08:00:00');
    expect(openStayEventKey(startAt)).toBe(`stay:${startAt.getTime()}:open`);
  });
});

describe('canExtendOpenStayWithNewPoints', () => {
  it('allows clock-only extend when there are no new points', () => {
    expect(canExtendOpenStayWithNewPoints(stayTrip(), [], config)).toBe(true);
  });

  it('allows new points within dwell radius of the stay centroid', () => {
    expect(
      canExtendOpenStayWithNewPoints(
        stayTrip(),
        [
          {
            id: 1,
            timestamp: new Date('2026-06-22T20:00:00'),
            lat: 33.21001,
            lng: -97.13001,
            accuracy: 10,
            altitude: null,
            speed: null,
            source: 'gps',
            heading: null,
            headingAccuracy: null,
            speedAccuracy: null,
            altitudeAccuracy: null,
            activityType: null,
            activityConfidence: null,
            isMoving: null,
            isMock: null,
            uuid: null,
            batteryLevel: null,
            batteryIsCharging: null,
          },
        ],
        config,
      ),
    ).toBe(true);
  });

  it('rejects new points outside dwell radius', () => {
    expect(
      canExtendOpenStayWithNewPoints(
        stayTrip(),
        [
          {
            id: 1,
            timestamp: new Date('2026-06-22T20:00:00'),
            lat: 33.25,
            lng: -97.13,
            accuracy: 10,
            altitude: null,
            speed: null,
            source: 'gps',
            heading: null,
            headingAccuracy: null,
            speedAccuracy: null,
            altitudeAccuracy: null,
            activityType: null,
            activityConfidence: null,
            isMoving: null,
            isMock: null,
            uuid: null,
            batteryLevel: null,
            batteryIsCharging: null,
          },
        ],
        config,
      ),
    ).toBe(false);
  });

  it('rejects when the last trip is not a stay', () => {
    expect(
      canExtendOpenStayWithNewPoints(stayTrip({ kind: 'travel' }), [], config),
    ).toBe(false);
  });
});

describe('shouldRunTodayOpenSilentSeal', () => {
  it('always runs when stored trips exist', () => {
    expect(shouldRunTodayOpenSilentSeal(1, 0)).toBe(true);
    expect(shouldRunTodayOpenSilentSeal(1, 1)).toBe(true);
  });

  it('skips when DB is empty and tail has fewer than 3 playable segments', () => {
    expect(shouldRunTodayOpenSilentSeal(0, 0)).toBe(false);
    expect(shouldRunTodayOpenSilentSeal(0, 1)).toBe(false);
    expect(shouldRunTodayOpenSilentSeal(0, 2)).toBe(false);
  });

  it('runs when DB is empty and tail has at least 3 playable segments', () => {
    expect(
      shouldRunTodayOpenSilentSeal(0, TODAY_OPEN_SILENT_SEAL_MIN_TAIL_SEGMENTS),
    ).toBe(true);
    expect(shouldRunTodayOpenSilentSeal(0, 4)).toBe(true);
  });
});
