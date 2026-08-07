import {
  DEFAULT_STOP_CONFIG,
  detectTrips,
  type ParsedPoint,
  type SavedPlaceRow,
} from '@lifemap/segmentation';

/**
 * Vishnu-style arrival: Core Motion stays `in_vehicle` @ 100 while GPS speed
 * is ~0 and steps are centimeters. Soft wheeled rule must still form a
 * saved-place stop within 1 minute.
 */
function point(
  overrides: Partial<ParsedPoint> &
    Pick<ParsedPoint, 'id' | 'at' | 'lat' | 'lng'>,
): ParsedPoint {
  const at = overrides.at;
  return {
    accuracy: 5,
    altitude: null,
    speed: 0,
    source: 'gps',
    timestamp: at,
    activityType: 'in_vehicle',
    activityConfidence: 100,
    isMoving: true,
    dateKey: '2026-08-06',
    ...overrides,
  };
}

const VISHNU = {
  lat: 33.21150690517306,
  lng: -97.15883070328813,
};

const vishnuPlace: SavedPlaceRow = {
  id: 5,
  kind: 'favorite',
  label: 'Vishnu',
  lat: VISHNU.lat,
  lng: VISHNU.lng,
  radiusMeters: 150,
  addressLine: '2421 Louise St',
  createdAt: new Date('2026-06-14T02:38:12.000Z'),
};

describe('parked in_vehicle saved-place stop', () => {
  it('detects a favorite stop despite stale in_vehicle while speed is ~0', () => {
    const t0 = new Date('2026-08-06T23:11:11.000Z');
    const points: ParsedPoint[] = [
      // Approach still moving.
      point({
        id: 1,
        at: new Date(t0.getTime() - 60_000),
        lat: VISHNU.lat - 0.002,
        lng: VISHNU.lng,
        speed: 8,
      }),
      point({
        id: 2,
        at: new Date(t0.getTime() - 30_000),
        lat: VISHNU.lat - 0.001,
        lng: VISHNU.lng,
        speed: 5,
      }),
      // Parked at Vishnu — activity still says car.
      point({
        id: 782478,
        at: t0,
        lat: 33.211431,
        lng: -97.158956,
        speed: 0.11,
      }),
      point({
        id: 782481,
        at: new Date(t0.getTime() + 20_000),
        lat: 33.211431,
        lng: -97.158964,
        speed: 0,
      }),
      // Breaker that previously aborted the stay run (speed 0, in_vehicle).
      point({
        id: 782488,
        at: new Date(t0.getTime() + 166_000),
        lat: 33.211431,
        lng: -97.158966,
        speed: 0,
      }),
      point({
        id: 782860,
        at: new Date(t0.getTime() + 212_000),
        lat: 33.211431,
        lng: -97.158968,
        speed: 0,
        activityType: 'still',
        activityConfidence: 100,
      }),
    ];

    const { segments } = detectTrips(
      points,
      DEFAULT_STOP_CONFIG,
      [vishnuPlace],
    );
    const stays = segments.filter(segment => segment.kind === 'stay');
    const vishnuStay = stays.find(
      stay => stay.placeLabel === 'Vishnu' || stay.placeId === 5,
    );

    expect(vishnuStay).toBeDefined();
    expect(vishnuStay!.durationMs).toBeGreaterThanOrEqual(60_000);
    // First parked fix is the arrival — not delayed until still@100.
    expect(vishnuStay!.startAt.getTime()).toBe(t0.getTime());
  });

  it('still forms a generic stop when parked in_vehicle for the dwell window', () => {
    const start = new Date('2026-08-06T18:00:00.000Z');
    const points: ParsedPoint[] = [];
    for (let i = 0; i < 5; i += 1) {
      points.push(
        point({
          id: i + 1,
          at: new Date(start.getTime() + i * 60_000),
          lat: 33.25 + i * 0.00001,
          lng: -97.15,
          speed: 0,
        }),
      );
    }

    const { segments } = detectTrips(points, {
      ...DEFAULT_STOP_CONFIG,
      minDwellMs: 4 * 60_000,
      radiusM: 100,
    });
    const stays = segments.filter(segment => segment.kind === 'stay');
    expect(stays.length).toBeGreaterThanOrEqual(1);
    expect(stays[0]!.durationMs).toBeGreaterThanOrEqual(4 * 60_000);
  });
});
