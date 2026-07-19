import {
  DEFAULT_STOP_CONFIG,
  detectStops,
  refineStopBoundaries,
  type ParsedPoint,
  type Stop,
} from '@lifemap/segmentation';

function point(
  overrides: Partial<ParsedPoint> &
    Pick<ParsedPoint, 'id' | 'at' | 'lat' | 'lng'>,
): ParsedPoint {
  const at = overrides.at;
  return {
    accuracy: 8,
    altitude: null,
    speed: null,
    source: 'gps',
    timestamp: at,
    activityType: null,
    activityConfidence: null,
    isMoving: null,
    dateKey: '2026-07-17',
    ...overrides,
  };
}

function stopFromIds(
  points: ParsedPoint[],
  startId: number,
  endId: number,
): Stop {
  const start = points.findIndex(p => p.id === startId);
  const end = points.findIndex(p => p.id === endId);
  const cluster = points.slice(start, end + 1);
  const lat = cluster.reduce((s, p) => s + p.lat, 0) / cluster.length;
  const lng = cluster.reduce((s, p) => s + p.lng, 0) / cluster.length;
  return {
    id: `stop-${startId}`,
    lat,
    lng,
    arrivedAt: cluster[0]!.at,
    leftAt: cluster[cluster.length - 1]!.at,
    durationMs:
      cluster[cluster.length - 1]!.at.getTime() - cluster[0]!.at.getTime(),
    pointCount: cluster.length,
    spreadM: 50,
    pointIds: cluster.map(p => p.id),
  };
}

describe('refineStopBoundaries', () => {
  it('Natural Grocers: vehicle→foot start and last-foot+still end', () => {
    const base = new Date('2026-07-17T22:18:00.000Z');
    const ng = { lat: 33.2313, lng: -97.1326 };
    const points: ParsedPoint[] = [
      point({
        id: 504148,
        at: new Date(base.getTime() + 44_000),
        lat: ng.lat - 0.0004,
        lng: ng.lng,
        speed: 3.42,
        activityType: 'in_vehicle',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504149,
        at: new Date(base.getTime() + 48_000),
        lat: ng.lat - 0.0003,
        lng: ng.lng,
        speed: 1.73,
        activityType: 'in_vehicle',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504329,
        at: new Date(base.getTime() + 142_000),
        lat: ng.lat - 0.00005,
        lng: ng.lng,
        speed: 0.22,
        activityType: 'in_vehicle',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504333,
        at: new Date(base.getTime() + 147_000),
        ...ng,
        speed: 0.27,
        activityType: 'in_vehicle',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504336,
        at: new Date(base.getTime() + 247_000),
        lat: ng.lat + 0.0002,
        lng: ng.lng - 0.0001,
        speed: 0,
        activityType: 'on_foot',
        activityConfidence: 100,
        isMoving: true,
      }),
      // sparse indoor body
      point({
        id: 504400,
        at: new Date(base.getTime() + 20 * 60_000),
        lat: ng.lat + 0.0001,
        lng: ng.lng,
        speed: 0,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504500,
        at: new Date(base.getTime() + 50 * 60_000),
        lat: ng.lat,
        lng: ng.lng,
        speed: 0,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504557,
        at: new Date(base.getTime() + 72 * 60_000),
        lat: ng.lat - 0.00002,
        lng: ng.lng + 0.00005,
        speed: 1.35,
        activityType: 'on_foot',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504563,
        at: new Date(base.getTime() + 74 * 60_000),
        ...ng,
        speed: 0,
        activityType: 'still',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504567,
        at: new Date(base.getTime() + 75.5 * 60_000),
        lat: ng.lat - 0.00008,
        lng: ng.lng + 0.00004,
        speed: 0.85,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504573,
        at: new Date(base.getTime() + 77 * 60_000),
        lat: ng.lat - 0.0003,
        lng: ng.lng + 0.0002,
        speed: 5.28,
        activityType: 'in_vehicle',
        activityConfidence: 100,
        isMoving: true,
      }),
    ];

    const geometric = stopFromIds(points, 504336, 504567);
    const refined = refineStopBoundaries(geometric, points, DEFAULT_STOP_CONFIG);
    expect(refined.pointIds[0]).toBe(504333);
    expect(refined.pointIds[refined.pointIds.length - 1]).toBe(504563);
  });

  it('Kroger: keeps first-after-vehicle start and last-foot end', () => {
    const base = new Date('2026-07-17T23:36:00.000Z');
    const kr = { lat: 33.2312, lng: -97.1378 };
    const points: ParsedPoint[] = [
      point({
        id: 504605,
        at: new Date(base.getTime() + 9_000),
        lat: kr.lat - 0.0002,
        lng: kr.lng - 0.0002,
        speed: 3.34,
        activityType: 'in_vehicle',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504606,
        at: new Date(base.getTime() + 20_000),
        ...kr,
        speed: 0.37,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504610,
        at: new Date(base.getTime() + 54_000),
        lat: kr.lat + 0.00005,
        lng: kr.lng,
        speed: 0.81,
        activityType: 'on_foot',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504700,
        at: new Date(base.getTime() + 8 * 60_000),
        lat: kr.lat + 0.0001,
        lng: kr.lng + 0.0001,
        speed: 0,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504819,
        at: new Date(base.getTime() + 22 * 60_000),
        ...kr,
        speed: 0.66,
        activityType: 'on_foot',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504825,
        at: new Date(base.getTime() + 23.5 * 60_000),
        lat: kr.lat + 0.0004,
        lng: kr.lng - 0.00005,
        speed: 1.59,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504829,
        at: new Date(base.getTime() + 25 * 60_000),
        lat: kr.lat - 0.00002,
        lng: kr.lng + 0.0009,
        speed: 0.01,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 504834,
        at: new Date(base.getTime() + 25.5 * 60_000),
        lat: kr.lat - 0.001,
        lng: kr.lng + 0.002,
        speed: 14.67,
        activityType: 'in_vehicle',
        activityConfidence: 100,
        isMoving: true,
      }),
    ];

    const geometric = stopFromIds(points, 504606, 504829);
    const refined = refineStopBoundaries(geometric, points, DEFAULT_STOP_CONFIG);
    expect(refined.pointIds[0]).toBe(504606);
    expect(refined.pointIds[refined.pointIds.length - 1]).toBe(504819);
  });

  it('fallback end trims outbound road pings without foot labels', () => {
    const base = new Date('2026-07-17T23:36:00.000Z');
    const kr = { lat: 33.2312, lng: -97.1378 };
    const points: ParsedPoint[] = [
      point({
        id: 1,
        at: new Date(base.getTime()),
        lat: kr.lat - 0.001,
        lng: kr.lng,
        speed: 8,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 2,
        at: new Date(base.getTime() + 30_000),
        ...kr,
        speed: 0.3,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 3,
        at: new Date(base.getTime() + 10 * 60_000),
        lat: kr.lat + 0.00005,
        lng: kr.lng,
        speed: 0,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 4,
        at: new Date(base.getTime() + 20 * 60_000),
        ...kr,
        speed: 0.2,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 5,
        at: new Date(base.getTime() + 21.5 * 60_000),
        lat: kr.lat + 0.0004,
        lng: kr.lng,
        speed: 1.5,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 6,
        at: new Date(base.getTime() + 23 * 60_000),
        lat: kr.lat,
        lng: kr.lng + 0.0009,
        speed: 0.01,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
      point({
        id: 7,
        at: new Date(base.getTime() + 23.5 * 60_000),
        lat: kr.lat - 0.001,
        lng: kr.lng + 0.002,
        speed: 14,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
    ];

    const geometric = stopFromIds(points, 2, 6);
    const refined = refineStopBoundaries(geometric, points, DEFAULT_STOP_CONFIG);
    expect(refined.pointIds[0]).toBe(2);
    expect(refined.pointIds[refined.pointIds.length - 1]).toBe(4);
  });
});

describe('detectStops with boundary refine', () => {
  it('pulls Natural Grocers start back to parked vehicle', () => {
    const base = new Date('2026-07-17T22:00:00.000Z');
    const ng = { lat: 33.2313, lng: -97.1326 };
    const points: ParsedPoint[] = [];
    let id = 1;
    // approach
    for (const [min, spd, latOff] of [
      [0, 8, -0.002],
      [1, 5, -0.001],
      [2, 3.5, -0.0005],
      [3, 0.3, 0],
    ] as const) {
      points.push(
        point({
          id: id++,
          at: new Date(base.getTime() + min * 60_000),
          lat: ng.lat + latOff,
          lng: ng.lng,
          speed: spd,
          activityType: 'in_vehicle',
          activityConfidence: 100,
          isMoving: true,
        }),
      );
    }
    const parkId = points[points.length - 1]!.id;
    points.push(
      point({
        id: id++,
        at: new Date(base.getTime() + 4 * 60_000),
        lat: ng.lat + 0.00015,
        lng: ng.lng,
        speed: 0.5,
        activityType: 'on_foot',
        activityConfidence: 100,
        isMoving: true,
      }),
    );
    // dwell ≥ 5 min, end with foot → still (same pattern as Natural Grocers)
    for (let min = 6; min <= 16; min += 2) {
      points.push(
        point({
          id: id++,
          at: new Date(base.getTime() + min * 60_000),
          lat: ng.lat + (min % 3) * 0.00002,
          lng: ng.lng,
          speed: 0,
          activityType: 'unknown',
          activityConfidence: 100,
          isMoving: true,
        }),
      );
    }
    points.push(
      point({
        id: id++,
        at: new Date(base.getTime() + 18 * 60_000),
        lat: ng.lat + 0.00002,
        lng: ng.lng,
        speed: 1.2,
        activityType: 'on_foot',
        activityConfidence: 100,
        isMoving: true,
      }),
    );
    const lastFootId = points[points.length - 1]!.id;
    points.push(
      point({
        id: id++,
        at: new Date(base.getTime() + 19.5 * 60_000),
        ...ng,
        speed: 0,
        activityType: 'still',
        activityConfidence: 100,
        isMoving: false,
      }),
    );
    const stillId = points[points.length - 1]!.id;
    points.push(
      point({
        id: id++,
        at: new Date(base.getTime() + 23 * 60_000),
        lat: ng.lat - 0.0001,
        lng: ng.lng,
        speed: 0.8,
        activityType: 'unknown',
        activityConfidence: 100,
        isMoving: true,
      }),
    );
    points.push(
      point({
        id: id++,
        at: new Date(base.getTime() + 24 * 60_000),
        lat: ng.lat - 0.001,
        lng: ng.lng + 0.001,
        speed: 10,
        activityType: 'in_vehicle',
        activityConfidence: 100,
        isMoving: true,
      }),
    );

    const stops = detectStops(points, DEFAULT_STOP_CONFIG);
    expect(stops.length).toBeGreaterThanOrEqual(1);
    const stay = stops[0]!;
    expect(stay.pointIds[0]).toBe(parkId);
    expect(stay.pointIds[stay.pointIds.length - 1]).toBe(stillId);
    expect(stay.pointIds).toContain(lastFootId);
  });
});
