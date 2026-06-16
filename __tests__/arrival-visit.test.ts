import type {LocationPointRow} from '@/db/repositories/location-days';
import {isArrivalVisitAfterDrive} from '@/lib/arrival-visit';
import {buildTripDetectionConfig} from '@/lib/trip-settings';
import type {DetectedTrip} from '@/lib/trip-detection';

function point(
  lat: number,
  lng: number,
  timestampMs: number,
): LocationPointRow {
  return {
    id: timestampMs,
    timestamp: new Date(timestampMs),
    lat,
    lng,
    accuracy: 5,
    altitude: null,
    speed: null,
    source: 'gps',
  };
}

function makeTrip(
  kind: DetectedTrip['kind'],
  points: LocationPointRow[],
): DetectedTrip {
  const startAt = points[0]!.timestamp;
  const endAt = points[points.length - 1]!.timestamp;
  return {
    id: `${kind}-test`,
    kind,
    points,
    startAt,
    endAt,
    durationMs: endAt.getTime() - startAt.getTime(),
    distanceKm: 0,
  };
}

describe('isArrivalVisitAfterDrive', () => {
  const config = buildTripDetectionConfig(10, 5, 75);

  it('returns true for a qualifying stop at the drive destination', () => {
    const drive = makeTrip('travel', [
      point(33.2, -97.1, 0),
      point(33.2307, -97.1637, 10 * 60_000),
    ]);
    const visit = makeTrip('stay', [
      point(33.2307, -97.1637, 10 * 60_000),
      point(33.2302, -97.164, 25 * 60_000),
    ]);

    expect(isArrivalVisitAfterDrive(drive, visit, config)).toBe(true);
  });

  it('returns false when the next stay is too brief', () => {
    const drive = makeTrip('travel', [
      point(33.2, -97.1, 0),
      point(33.2307, -97.1637, 10 * 60_000),
    ]);
    const visit = makeTrip('stay', [
      point(33.2307, -97.1637, 10 * 60_000),
      point(33.2302, -97.164, 12 * 60_000),
    ]);

    expect(isArrivalVisitAfterDrive(drive, visit, config)).toBe(false);
  });
});
