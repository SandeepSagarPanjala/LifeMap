import type {LocationPointRow} from '@/db/repositories/location-days';
import {buildDayTimeline, detectTripsFromPoints} from '@/lib/segmentation';
import type {PlaceLookupRow, PlacePoiRow} from '@/lib/place-lookup-types';
import {PLACE_LOOKUP_VENUE_RADIUS_M} from '@/lib/app-constants';
import {buildTripDetectionConfig} from '@/lib/trip-settings';

const HOME = {lat: 33.21, lng: -97.13};
const WALMART = {lat: 33.25, lng: -97.05};

function makePoints(
  specs: Array<{minutes: number; lat: number; lng: number}>,
  start = new Date('2026-06-03T08:00:00'),
): LocationPointRow[] {
  return specs.map((spec, index) => ({
    id: index + 1,
    timestamp: new Date(start.getTime() + spec.minutes * 60_000),
    lat: spec.lat,
    lng: spec.lng,
    accuracy: 10,
    altitude: null,
    speed: null,
    source: 'gps',
  }));
}

describe('segmentation detection (current algorithm)', () => {
  const config = buildTripDetectionConfig(10, 10, 150);

  describe('synthetic timelines', () => {
    it('home → drive → walmart → drive → home', () => {
      const timeline = buildDayTimeline(
        makePoints([
          {minutes: 0, ...HOME},
          {minutes: 60, ...HOME},
          {minutes: 110, ...HOME},
          {minutes: 118, lat: 33.215, lng: -97.12},
          {minutes: 120, lat: 33.22, lng: -97.1},
          {minutes: 125, lat: 33.23, lng: -97.08},
          {minutes: 130, lat: 33.235, lng: -97.07},
          {minutes: 135, ...WALMART},
          {minutes: 150, ...WALMART},
          {minutes: 165, lat: 33.24, lng: -97.07},
          {minutes: 170, lat: 33.23, lng: -97.09},
          {minutes: 175, lat: 33.22, lng: -97.11},
          {minutes: 185, ...HOME},
          {minutes: 200, ...HOME},
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

    it('keeps sparse same-area pings as one visit', () => {
      const home = 33.25045;
      const lng = -97.15306;
      const timeline = buildDayTimeline(
        makePoints([
          {minutes: 0, lat: home, lng},
          {minutes: 19, lat: home + 0.00001, lng},
          {minutes: 26, lat: home, lng},
          {minutes: 38, lat: home, lng},
          {minutes: 55, lat: home, lng},
          {minutes: 61, lat: home, lng},
          {minutes: 67, lat: home, lng},
        ]),
        config,
      );

      expect(timeline.filter(entry => entry.kind === 'stay')).toHaveLength(1);
      expect(timeline.some(entry => entry.kind === 'travel')).toBe(false);
    });

    it('does not split one visit on quiet gaps in the same area', () => {
      const timeline = buildDayTimeline(
        makePoints([
          {minutes: 0, ...HOME},
          {minutes: 25, lat: HOME.lat + 0.00001, lng: HOME.lng + 0.00001},
          {minutes: 50, lat: HOME.lat + 0.00002, lng: HOME.lng + 0.00002},
        ]),
        config,
      );

      expect(timeline.filter(entry => entry.kind === 'stay')).toHaveLength(1);
      expect(timeline.some(entry => entry.kind === 'travel')).toBe(false);
    });

    it('bridges a long quiet gap with travel instead of a missing-data gap card', () => {
      const timeline = buildDayTimeline(
        makePoints([
          {minutes: 0, ...HOME},
          {minutes: 8, ...HOME},
          {minutes: 15, ...HOME},
          {minutes: 80, ...WALMART},
          {minutes: 95, ...WALMART},
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

    it('does not emit segments from GPS jitter below dwell threshold', () => {
      const trips = detectTripsFromPoints(
        makePoints([
          {minutes: 0, ...HOME},
          {minutes: 1, lat: HOME.lat + 0.00001, lng: HOME.lng + 0.00001},
        ]),
        config,
      );

      expect(trips).toHaveLength(0);
    });

    it('does not emit a stay from a single GPS point', () => {
      const trips = detectTripsFromPoints(
        makePoints([{minutes: 0, ...HOME}]),
        config,
      );
      expect(trips).toHaveLength(0);
    });

    it('separates visits at different places', () => {
      const timeline = buildDayTimeline(
        makePoints([
          {minutes: 0, ...HOME},
          {minutes: 30, ...HOME},
          {minutes: 120, ...WALMART},
          {minutes: 150, ...WALMART},
        ]),
        buildTripDetectionConfig(10, 10, 25),
      );

      expect(
        timeline.filter(entry => entry.kind === 'stay').length,
      ).toBeGreaterThanOrEqual(2);
    });

    it('merges same-area clusters across a sparse GPS gap', () => {
      const anchor = {lat: 33.25028, lng: -97.15312};
      const timeline = buildDayTimeline(
        makePoints([
          {minutes: 0, ...anchor},
          {minutes: 30, lat: anchor.lat + 0.00001, lng: anchor.lng},
          {minutes: 81, lat: 33.25052, lng: -97.153},
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
          source: 'mapkit',
          createdAt: new Date('2026-06-03T08:00:00.000Z'),
        },
      ];
    }

    it('links unlabeled stays to cache and labels drive endpoints', () => {
      const timeline = buildDayTimeline(
        makePoints([
          {minutes: 0, ...HOME},
          {minutes: 60, ...HOME},
          {minutes: 110, ...HOME},
          {minutes: 118, lat: 33.215, lng: -97.12},
          {minutes: 120, lat: 33.22, lng: -97.1},
          {minutes: 125, lat: 33.23, lng: -97.08},
          {minutes: 130, lat: 33.235, lng: -97.07},
          {minutes: 135, ...WALMART},
          {minutes: 150, ...WALMART},
          {minutes: 165, lat: 33.24, lng: -97.07},
          {minutes: 170, lat: 33.23, lng: -97.09},
          {minutes: 175, lat: 33.22, lng: -97.11},
          {minutes: 185, ...HOME},
          {minutes: 200, ...HOME},
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
        entry =>
          entry.kind === 'travel' && entry.toPoiLabel === 'Walmart',
      );
      expect(driveToWalmart).toBeDefined();
    });
  });
});
