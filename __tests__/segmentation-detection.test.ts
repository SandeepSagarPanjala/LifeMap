import type { LocationPointRow } from '@/db/repositories/location-days';
import {
  buildDayTimeline,
  buildSegmentationTimeline,
  detectTripsFromPoints,
} from '@/lib/segmentation';
import type { PlaceLookupRow, PlacePoiRow } from '@/lib/place-lookup-types';
import { PLACE_LOOKUP_VENUE_RADIUS_M } from '@/lib/app-constants';
import { buildTripDetectionConfig } from '@/lib/trip-settings';

const HOME = { lat: 33.21, lng: -97.13 };
const WALMART = { lat: 33.25, lng: -97.05 };

function makePoints(
  specs: Array<{
    minutes: number;
    lat: number;
    lng: number;
    speed?: number | null;
  }>,
  start = new Date('2026-06-03T08:00:00'),
): LocationPointRow[] {
  return specs.map((spec, index) => ({
    id: index + 1,
    timestamp: new Date(start.getTime() + spec.minutes * 60_000),
    lat: spec.lat,
    lng: spec.lng,
    accuracy: 10,
    altitude: null,
    speed: spec.speed ?? null,
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
  }));
}

describe('segmentation detection (current algorithm)', () => {
  const config = buildTripDetectionConfig(10, 10, 150);

  describe('synthetic timelines', () => {
    it('home → drive → walmart → drive → home', () => {
      const timeline = buildDayTimeline(
        makePoints([
          { minutes: 0, ...HOME },
          { minutes: 60, ...HOME },
          { minutes: 110, ...HOME },
          { minutes: 118, lat: 33.215, lng: -97.12 },
          { minutes: 120, lat: 33.22, lng: -97.1 },
          { minutes: 125, lat: 33.23, lng: -97.08 },
          { minutes: 130, lat: 33.235, lng: -97.07 },
          { minutes: 135, ...WALMART },
          { minutes: 150, ...WALMART },
          { minutes: 165, lat: 33.24, lng: -97.07 },
          { minutes: 170, lat: 33.23, lng: -97.09 },
          { minutes: 175, lat: 33.22, lng: -97.11 },
          { minutes: 185, ...HOME },
          { minutes: 200, ...HOME },
        ]),
        config,
      );

      expect(timeline.map(entry => entry.kind)).toEqual([
        'stay',
        'travel',
        'stay',
        'travel',
        'stay',
      ]);
      const firstDrive = timeline[1];
      const firstStay = timeline[0];
      if (firstDrive?.kind === 'travel' && firstStay?.kind === 'stay') {
        expect(firstStay.endAt.getTime()).toBe(firstDrive.startAt.getTime());
      }
    });

    it('stay end equals drive start when departure is a moving-speed GPS', () => {
      const timeline = buildDayTimeline(
        makePoints([
          { minutes: 0, ...HOME },
          { minutes: 20, ...HOME },
          { minutes: 40, ...HOME },
          // Last stationary at the stay, then a moving fix a few minutes later.
          { minutes: 42, lat: 33.212, lng: -97.128, speed: 8 },
          { minutes: 50, lat: 33.22, lng: -97.1, speed: 12 },
          { minutes: 60, ...WALMART },
          { minutes: 80, ...WALMART },
        ]),
        config,
      );

      expect(timeline.map(entry => entry.kind)).toEqual([
        'stay',
        'travel',
        'stay',
      ]);
      const stay = timeline[0];
      const drive = timeline[1];
      if (stay?.kind === 'stay' && drive?.kind === 'travel') {
        expect(stay.endAt.getTime()).toBe(drive.startAt.getTime());
        // Stay must end on the last stationary cluster point (40 min), not the
        // moving fix (42 min).
        expect(stay.endAt.getTime()).toBe(
          new Date('2026-06-03T08:40:00').getTime(),
        );
      }
    });

    it('keeps sparse same-area pings as one visit', () => {
      const home = 33.25045;
      const lng = -97.15306;
      const timeline = buildDayTimeline(
        makePoints([
          { minutes: 0, lat: home, lng },
          { minutes: 19, lat: home + 0.00001, lng },
          { minutes: 26, lat: home, lng },
          { minutes: 38, lat: home, lng },
          { minutes: 55, lat: home, lng },
          { minutes: 61, lat: home, lng },
          { minutes: 67, lat: home, lng },
        ]),
        config,
      );

      expect(timeline.filter(entry => entry.kind === 'stay')).toHaveLength(1);
      expect(timeline.some(entry => entry.kind === 'travel')).toBe(false);
    });

    it('does not split one visit on quiet gaps in the same area', () => {
      const timeline = buildDayTimeline(
        makePoints([
          { minutes: 0, ...HOME },
          { minutes: 25, lat: HOME.lat + 0.00001, lng: HOME.lng + 0.00001 },
          { minutes: 50, lat: HOME.lat + 0.00002, lng: HOME.lng + 0.00002 },
        ]),
        config,
      );

      expect(timeline.filter(entry => entry.kind === 'stay')).toHaveLength(1);
      expect(timeline.some(entry => entry.kind === 'travel')).toBe(false);
    });

    it('bridges a long quiet gap with travel instead of a missing-data gap card', () => {
      const timeline = buildDayTimeline(
        makePoints([
          { minutes: 0, ...HOME },
          { minutes: 8, ...HOME },
          { minutes: 15, ...HOME },
          { minutes: 80, ...WALMART },
          { minutes: 95, ...WALMART },
        ]),
        config,
      );

      expect(timeline.map(entry => entry.kind)).toEqual([
        'stay',
        'travel',
        'stay',
      ]);
      expect(timeline.some(entry => entry.kind === 'gap')).toBe(false);
    });

    it('treats overnight phone-off endpoint jumps as missing, not a drive', () => {
      // Home evening → Work next morning with no GPS in between (Jul 8 pattern).
      const start = new Date('2026-07-07T23:00:00-05:00');
      const points = makePoints(
        [
          { minutes: 0, ...HOME },
          { minutes: 11, ...HOME },
          // ~11h blackout, then Work
          { minutes: 11 + 11 * 60, ...WALMART },
          { minutes: 11 + 11 * 60 + 20, ...WALMART },
        ],
        start,
      );

      const jul7 = buildSegmentationTimeline('2026-07-07', points, config);
      const jul8 = buildSegmentationTimeline('2026-07-08', points, config);

      expect(jul7.some(entry => entry.kind === 'travel')).toBe(false);
      expect(jul8.some(entry => entry.kind === 'travel')).toBe(false);
      expect(jul7.map(entry => entry.kind)).toContain('gap');
      expect(jul8.map(entry => entry.kind)).toContain('gap');

      const jul7Gap = jul7.find(entry => entry.kind === 'gap');
      const jul8Gap = jul8.find(entry => entry.kind === 'gap');
      expect(jul7Gap?.endAt.getTime()).toBe(
        new Date('2026-07-08T00:00:00-05:00').getTime(),
      );
      expect(jul8Gap?.startAt.getTime()).toBe(
        new Date('2026-07-08T00:00:00-05:00').getTime(),
      );
    });

    it('keeps one stay across Home indoor GPS teleport with bad accuracy', () => {
      // Jul 16 pattern: solid Home fix, then ~80m jump with ~53m accuracy and
      // sticky isMoving/unknown, then snap back — must not flash a red drive.
      const start = new Date('2026-07-16T21:00:00.000Z');
      const points: LocationPointRow[] = [
        {
          id: 1,
          timestamp: start,
          lat: HOME.lat,
          lng: HOME.lng,
          accuracy: 10,
          altitude: null,
          speed: 0,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'still',
          activityConfidence: 100,
          isMoving: true,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        },
        {
          id: 2,
          timestamp: new Date(start.getTime() + 10 * 60_000),
          lat: HOME.lat,
          lng: HOME.lng,
          accuracy: 10,
          altitude: null,
          speed: 0.2,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'unknown',
          activityConfidence: 100,
          isMoving: true,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        },
        {
          id: 3,
          timestamp: new Date(start.getTime() + 10 * 60_000 + 44_000),
          lat: HOME.lat + 0.00072, // ~80m north
          lng: HOME.lng + 0.0002,
          accuracy: 53,
          altitude: null,
          speed: 1.83,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'unknown',
          activityConfidence: 100,
          isMoving: true,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        },
        {
          id: 4,
          timestamp: new Date(start.getTime() + 10 * 60_000 + 55_000),
          lat: HOME.lat + 0.0006,
          lng: HOME.lng + 0.00015,
          accuracy: 50,
          altitude: null,
          speed: 2.78,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'unknown',
          activityConfidence: 100,
          isMoving: true,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        },
        {
          id: 5,
          timestamp: new Date(start.getTime() + 10 * 60_000 + 90_000),
          lat: HOME.lat,
          lng: HOME.lng,
          accuracy: 11,
          altitude: null,
          speed: 0,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'still',
          activityConfidence: 100,
          isMoving: true,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        },
        {
          id: 6,
          timestamp: new Date(start.getTime() + 25 * 60_000),
          lat: HOME.lat,
          lng: HOME.lng,
          accuracy: 14,
          altitude: null,
          speed: 0,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'still',
          activityConfidence: 100,
          isMoving: false,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        },
      ];

      const timeline = buildDayTimeline(points, config);
      expect(timeline.map(entry => entry.kind)).toEqual(['stay']);
      expect(timeline.some(entry => entry.kind === 'travel')).toBe(false);
    });

    it('still emits a walk when confident on_foot leaves the stay radius', () => {
      const start = new Date('2026-07-16T16:00:00.000Z');
      const points: LocationPointRow[] = [];
      let id = 1;
      // Home dwell
      for (const minutes of [0, 8, 16]) {
        points.push({
          id: id++,
          timestamp: new Date(start.getTime() + minutes * 60_000),
          lat: HOME.lat,
          lng: HOME.lng,
          accuracy: 8,
          altitude: null,
          speed: 0,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'still',
          activityConfidence: 100,
          isMoving: false,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        });
      }
      // Walk ~180m east with confident on_foot (beyond radius+accuracy)
      for (let step = 1; step <= 6; step += 1) {
        points.push({
          id: id++,
          timestamp: new Date(start.getTime() + (18 + step) * 60_000),
          lat: HOME.lat,
          lng: HOME.lng + step * 0.00035,
          accuracy: 8,
          altitude: null,
          speed: 1.4,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'on_foot',
          activityConfidence: 90,
          isMoving: true,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        });
      }
      // Dwell at destination
      const destLng = HOME.lng + 6 * 0.00035;
      for (const minutes of [30, 40, 50]) {
        points.push({
          id: id++,
          timestamp: new Date(start.getTime() + minutes * 60_000),
          lat: HOME.lat,
          lng: destLng,
          accuracy: 8,
          altitude: null,
          speed: 0,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'still',
          activityConfidence: 100,
          isMoving: false,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        });
      }

      const timeline = buildDayTimeline(points, config);
      expect(timeline.map(entry => entry.kind)).toEqual([
        'stay',
        'travel',
        'stay',
      ]);
    });

    it('keeps one stay when indoor GPS wanders with bare isMoving flags', () => {
      // Jul 15 Home pattern: long still stay, ~56m wander with junk isMoving /
      // unknown + near-zero speed, then back at Home — must not flash a drive.
      const start = new Date('2026-07-15T05:00:00.000Z');
      const points: LocationPointRow[] = [
        {
          id: 1,
          timestamp: start,
          lat: HOME.lat,
          lng: HOME.lng,
          accuracy: 10,
          altitude: null,
          speed: 0,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'still',
          activityConfidence: 100,
          isMoving: true,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        },
        {
          id: 2,
          timestamp: new Date(start.getTime() + 60 * 60_000),
          lat: HOME.lat,
          lng: HOME.lng,
          accuracy: 20,
          altitude: null,
          speed: 0,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'still',
          activityConfidence: 100,
          isMoving: true,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        },
        // Peak wander (~50m NE) still confidently still — stay continues.
        {
          id: 3,
          timestamp: new Date(start.getTime() + 60 * 60_000 + 20_000),
          lat: HOME.lat + 0.0005,
          lng: HOME.lng + 0.0003,
          accuracy: 34,
          altitude: null,
          speed: 3.2,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'still',
          activityConfidence: 100,
          isMoving: true,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        },
        // Tail that previously ended the stay: unknown + isMoving, tiny speed.
        {
          id: 4,
          timestamp: new Date(start.getTime() + 60 * 60_000 + 40_000),
          lat: HOME.lat + 0.0003,
          lng: HOME.lng + 0.0002,
          accuracy: 22,
          altitude: null,
          speed: 0.11,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'unknown',
          activityConfidence: 100,
          isMoving: true,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        },
        {
          id: 5,
          timestamp: new Date(start.getTime() + 60 * 60_000 + 60_000),
          lat: HOME.lat + 0.0001,
          lng: HOME.lng + 0.0001,
          accuracy: 11,
          altitude: null,
          speed: null,
          source: 'gps',
          heading: null,
          headingAccuracy: null,
          speedAccuracy: null,
          altitudeAccuracy: null,
          activityType: 'unknown',
          activityConfidence: 0,
          isMoving: true,
          isMock: null,
          uuid: null,
          batteryLevel: null,
          batteryIsCharging: null,
        },
      ];

      const timeline = buildDayTimeline(points, config);
      expect(timeline.map(entry => entry.kind)).toEqual(['stay']);
      expect(timeline.some(entry => entry.kind === 'travel')).toBe(false);
    });

    it('does not emit a stay from a single GPS point', () => {
      const trips = detectTripsFromPoints(
        makePoints([{ minutes: 0, ...HOME }]),
        config,
      );
      expect(trips).toHaveLength(0);
    });

    it('separates visits at different places', () => {
      const timeline = buildDayTimeline(
        makePoints([
          { minutes: 0, ...HOME },
          { minutes: 30, ...HOME },
          { minutes: 120, ...WALMART },
          { minutes: 150, ...WALMART },
        ]),
        buildTripDetectionConfig(10, 10, 25),
      );

      expect(
        timeline.filter(entry => entry.kind === 'stay').length,
      ).toBeGreaterThanOrEqual(2);
    });

    it('merges same-area clusters across a sparse GPS gap', () => {
      const anchor = { lat: 33.25028, lng: -97.15312 };
      const timeline = buildDayTimeline(
        makePoints([
          { minutes: 0, ...anchor },
          { minutes: 30, lat: anchor.lat + 0.00001, lng: anchor.lng },
          { minutes: 81, lat: 33.25052, lng: -97.153 },
        ]),
        buildTripDetectionConfig(10, 10, 25),
      );

      expect(timeline.filter(entry => entry.kind === 'stay')).toHaveLength(1);
    });
  });

  describe('place lookup cache annotate', () => {
    function walmartCache(): PlaceLookupRow {
      return {
        id: 42,
        anchorLat: WALMART.lat,
        anchorLng: WALMART.lng,
        venueRadiusMeters: PLACE_LOOKUP_VENUE_RADIUS_M,
        addressLine: '123 Retail Rd',
        lookupStatus: 'complete',
        fetchedAt: new Date('2026-06-03T08:00:00.000Z'),
      };
    }

    function walmartPois(): PlacePoiRow[] {
      return [
        {
          id: 7,
          cacheId: 42,
          name: 'Walmart',
          lat: WALMART.lat,
          lng: WALMART.lng,
          category: null,
          source: 'mapkit',
          createdAt: new Date('2026-06-03T08:00:00.000Z'),
        },
      ];
    }

    it('links unlabeled stays to cache and labels drive endpoints', () => {
      const timeline = buildDayTimeline(
        makePoints([
          { minutes: 0, ...HOME },
          { minutes: 60, ...HOME },
          { minutes: 110, ...HOME },
          { minutes: 118, lat: 33.215, lng: -97.12 },
          { minutes: 120, lat: 33.22, lng: -97.1 },
          { minutes: 125, lat: 33.23, lng: -97.08 },
          { minutes: 130, lat: 33.235, lng: -97.07 },
          { minutes: 135, ...WALMART },
          { minutes: 150, ...WALMART },
          { minutes: 165, lat: 33.24, lng: -97.07 },
          { minutes: 170, lat: 33.23, lng: -97.09 },
          { minutes: 175, lat: 33.22, lng: -97.11 },
          { minutes: 185, ...HOME },
          { minutes: 200, ...HOME },
        ]),
        config,
        {
          placeLookupCache: [walmartCache()],
          placePois: walmartPois(),
          resolveClosestPoi: true,
        },
      );

      const walmartStay = timeline.find(
        entry =>
          entry.kind === 'stay' &&
          entry.placeKind === 'cache' &&
          entry.placeId === 42 &&
          entry.poiLabel === 'Walmart',
      );
      expect(walmartStay).toBeDefined();

      const driveToWalmart = timeline.find(
        entry => entry.kind === 'travel' && entry.toPoiLabel === 'Walmart',
      );
      expect(driveToWalmart).toBeDefined();
    });
  });
});
