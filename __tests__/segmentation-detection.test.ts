import fs from 'node:fs';
import path from 'node:path';

import type {LocationPointRow} from '@/db/repositories/location-days';
import {toDateKey} from '@/lib/day-utils';
import {
  buildDayTimeline,
  buildSegmentationTimeline,
  detectTripsFromPoints,
} from '@/lib/segmentation';
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

function loadWindowForDay(dateKey: string): LocationPointRow[] {
  const file = path.join(__dirname, '..', 'all data.json');
  if (!fs.existsSync(file)) {
    return [];
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    tables: {
      location_points: Array<{
        id: number;
        timestamp: string;
        lat: number;
        lng: number;
        accuracy: number | null;
        altitude: number | null;
        speed: number | null;
        source: string;
      }>;
    };
  };
  const anchor = new Date(`${dateKey}T12:00:00`);
  const prev = toDateKey(new Date(anchor.getTime() - 86_400_000));
  const next = toDateKey(new Date(anchor.getTime() + 86_400_000));
  const keys = new Set([prev, dateKey, next]);
  return raw.tables.location_points
    .map(row => ({
      ...row,
      timestamp: new Date(row.timestamp),
      source: row.source as LocationPointRow['source'],
    }))
    .filter(point => keys.has(toDateKey(point.timestamp)));
}

function expectAlternatingStayTravel(
  kinds: Array<'stay' | 'travel' | 'gap'>,
): void {
  const playable = kinds.filter(
    (kind): kind is 'stay' | 'travel' => kind !== 'gap',
  );
  for (let index = 0; index < playable.length - 1; index += 1) {
    expect(playable[index]).not.toBe(playable[index + 1]);
  }
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

  describe('timeline invariants', () => {
    it('alternates stays and drives on export days', () => {
      const points = loadWindowForDay('2026-06-04');
      if (points.length === 0) {
        return;
      }

      const timeline = buildSegmentationTimeline(
        '2026-06-04',
        points,
        buildTripDetectionConfig(10, 10, 25),
      );

      expectAlternatingStayTravel(timeline.map(entry => entry.kind));
    });
  });

  describe('export regressions (all data.json)', () => {
    const exportConfig = buildTripDetectionConfig(10, 10, 25);

    it('Jun 4 projects to alternating stays and drives', () => {
      const points = loadWindowForDay('2026-06-04');
      if (points.length === 0) {
        return;
      }

      const timeline = buildSegmentationTimeline('2026-06-04', points, exportConfig);
      const kinds = timeline.map(entry => entry.kind);

      expect(kinds.filter(kind => kind === 'stay')).toHaveLength(4);
      expect(kinds.filter(kind => kind === 'travel')).toHaveLength(3);
      expect(kinds.filter(kind => kind === 'gap')).toHaveLength(0);
      expectAlternatingStayTravel(kinds);
    });

    it('Jun 4 includes the evening Galleria drive segment', () => {
      const points = loadWindowForDay('2026-06-04');
      if (points.length === 0) {
        return;
      }

      const timeline = buildSegmentationTimeline('2026-06-04', points, exportConfig);
      const eveningDrive = timeline.find(
        entry =>
          entry.kind === 'travel' &&
          entry.points.some(point => point.id === 1470 || point.id === 1467),
      );

      expect(eveningDrive).toBeDefined();
      expect(eveningDrive?.kind).toBe('travel');
    });

    it('Jun 6 charger stop is part of the evening drive segment (not split into its own visit)', () => {
      const points = loadWindowForDay('2026-06-06');
      if (points.length === 0) {
        return;
      }

      const segments = buildSegmentationTimeline(
        '2026-06-06',
        points,
        buildTripDetectionConfig(10, 5, 25),
      );
      const driveWith16329 = segments.find(
        entry =>
          entry.kind === 'travel' && entry.points.some(point => point.id === 16329),
      );
      const stayWith16329 = segments.find(
        entry =>
          entry.kind === 'stay' && entry.points.some(point => point.id === 16329),
      );

      expect(driveWith16329).toBeDefined();
      expect(stayWith16329).toBeUndefined();
    });
  });
});
