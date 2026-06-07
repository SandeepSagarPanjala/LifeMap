import {
  buildDayTimeline,
  dedupeLocationPoints,
  detectTrips,
  getTravelDisplayPoints,
  visitApproachConnectorCoordinates,
  isShortGapDeparture,
  isStaleWakeNotDeparture,
  stayTripCentroid,
  stayTripMarkerCoordinate,
  staysBeforeEntryIndex,
  stayBeforeEntryIndex,
} from '../src/lib/trip-detection';
import {distanceKm} from '../src/lib/location-geo';
import {buildTripDetectionConfig} from '../src/lib/trip-settings';
import type {LocationPointRow} from '../src/db/repositories/location-days';

const config = buildTripDetectionConfig(10, 10, 150);

const HOME = {lat: 33.21, lng: -97.13};
const WALMART = {lat: 33.25, lng: -97.05};

function makePoints(
  specs: Array<{minutes: number; lat: number; lng: number}>,
): LocationPointRow[] {
  const start = new Date('2026-06-03T08:00:00');
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

describe('stay / trip timeline', () => {
  it('dedupes same timestamp and place', () => {
    const base = makePoints([{minutes: 0, ...HOME}]);
    const dupes: LocationPointRow[] = [
      {...base[0]!, id: 1},
      {...base[0]!, id: 2, source: 'motion'},
      {...base[0]!, id: 3},
    ];
    expect(dedupeLocationPoints(dupes)).toHaveLength(1);
  });

  it('home 8–10 → trip → walmart stay → trip → home stay (5 events)', () => {
    const timeline = buildDayTimeline(
      makePoints([
        {minutes: 0, ...HOME},
        {minutes: 60, ...HOME},
        {minutes: 110, ...HOME},
        {minutes: 120, lat: 33.22, lng: -97.1},
        {minutes: 125, lat: 33.23, lng: -97.08},
        {minutes: 135, ...WALMART},
        {minutes: 150, ...WALMART},
        {minutes: 165, lat: 33.24, lng: -97.07},
        {minutes: 175, lat: 33.22, lng: -97.11},
        {minutes: 185, ...HOME},
        {minutes: 200, ...HOME},
      ]),
      config,
    );

    const kinds = timeline.map(e => e.kind);
    expect(kinds).toEqual(['stay', 'travel', 'stay', 'travel', 'stay']);
    expect(timeline[0]?.kind).toBe('stay');
    expect(timeline[2]?.kind).toBe('stay');
    expect(timeline[4]?.kind).toBe('stay');
    if (timeline[1]?.kind === 'travel') {
      expect(timeline[1].startAt.getTime()).toBe(
        new Date('2026-06-03T10:00:00').getTime(),
      );
    }
  });

  it('keeps one open visit for sparse same-area pings (home all night)', () => {
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

    const stays = timeline.filter(e => e.kind === 'stay');
    expect(stays).toHaveLength(1);
    expect(stays[0]?.startAt).toEqual(new Date('2026-06-03T08:00:00'));
    expect(timeline.some(e => e.kind === 'travel')).toBe(false);
  });

  it('does not split a stay on time gaps in the same area', () => {
    const timeline = buildDayTimeline(
      makePoints([
        {minutes: 0, ...HOME},
        {minutes: 25, lat: HOME.lat + 0.00001, lng: HOME.lng + 0.00001},
        {minutes: 50, lat: HOME.lat + 0.00002, lng: HOME.lng + 0.00002},
      ]),
      config,
    );

    expect(timeline.filter(e => e.kind === 'stay')).toHaveLength(1);
    expect(timeline.some(e => e.kind === 'gap')).toBe(false);
  });

  it('inserts a gap when the next save is far after a quiet period', () => {
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

    expect(timeline.some(e => e.kind === 'gap')).toBe(true);
    expect(timeline.filter(e => e.kind === 'stay').length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('treats a lone save as an open visit (stay)', () => {
    const trips = detectTrips(makePoints([{minutes: 0, ...HOME}]), config);
    expect(trips).toHaveLength(1);
    expect(trips[0]?.kind).toBe('stay');
  });

  it('keeps one visit when all pings stay within radius of the first save', () => {
    const home = 33.25045;
    const lng = -97.15306;
    const timeline = buildDayTimeline(
      makePoints([
        {minutes: 0, lat: home, lng},
        {minutes: 12, lat: home + 0.00005, lng: lng + 0.00004},
        {minutes: 24, lat: home + 0.00008, lng: lng + 0.00006},
      ]),
      buildTripDetectionConfig(10, 10, 25),
    );

    expect(timeline.filter(e => e.kind === 'stay')).toHaveLength(1);
    expect(timeline.some(e => e.kind === 'travel')).toBe(false);
  });

  it('uses visit centroid for map pin when not ongoing', () => {
    const trips = detectTrips(
      makePoints([
        {minutes: 0, lat: 33.21, lng: -97.13},
        {minutes: 15, lat: 33.21005, lng: -97.13005},
      ]),
      config,
    );
    const stay = trips.find(t => t.kind === 'stay');
    expect(stay).toBeDefined();
    const pin = stayTripMarkerCoordinate(stay!, {ongoing: false});
    const centroid = stayTripCentroid(stay!);
    expect(pin.latitude).toBe(centroid.latitude);
    expect(pin.longitude).toBe(centroid.longitude);
  });

  it('merges same-area stays across a time gap with no saves', () => {
    const anchor = {lat: 33.25028, lng: -97.15312};
    const timeline = buildDayTimeline(
      makePoints([
        {minutes: 0, ...anchor},
        {minutes: 30, lat: anchor.lat + 0.00001, lng: anchor.lng},
        {minutes: 81, lat: 33.25052, lng: -97.153},
      ]),
      buildTripDetectionConfig(10, 10, 25),
    );

    expect(timeline.filter(e => e.kind === 'stay')).toHaveLength(1);
    expect(timeline[0]?.kind).toBe('stay');
    if (timeline[0]?.kind === 'stay') {
      expect(timeline[0].startAt).toEqual(new Date('2026-06-03T08:00:00'));
    }
  });

  it('does not merge stays when the next cluster is a different place', () => {
    const timeline = buildDayTimeline(
      makePoints([
        {minutes: 0, ...HOME},
        {minutes: 30, ...HOME},
        {minutes: 120, ...WALMART},
        {minutes: 150, ...WALMART},
      ]),
      buildTripDetectionConfig(10, 10, 25),
    );

    expect(timeline.filter(e => e.kind === 'stay').length).toBeGreaterThanOrEqual(2);
  });

  it('detects mid-route stops shorter than home dwell (5+ min)', () => {
    const away = {lat: 33.23, lng: -97.164};
    const timeline = buildDayTimeline(
      makePoints([
        {minutes: 0, ...HOME},
        {minutes: 15, ...HOME},
        {minutes: 20, lat: 33.22, lng: -97.14},
        {minutes: 25, lat: 33.225, lng: -97.15},
        {minutes: 33, ...away},
        {minutes: 38, lat: away.lat + 0.00002, lng: away.lng},
        {minutes: 45, lat: 33.235, lng: -97.165},
        {minutes: 50, lat: 33.236, lng: -97.166},
        {minutes: 58, ...HOME},
        {minutes: 65, ...HOME},
      ]),
      buildTripDetectionConfig(10, 10, 50),
    );

    const kinds = timeline.map(e => e.kind);
    expect(kinds).toContain('stay');
    expect(kinds.filter(k => k === 'stay').length).toBeGreaterThanOrEqual(2);
    const midStop = timeline.find(
      entry =>
        entry.kind === 'stay' &&
        entry.startAt.getTime() === new Date('2026-06-03T08:33:00').getTime(),
    );
    expect(midStop).toBeDefined();
    expect(kinds.filter(k => k === 'travel').length).toBeGreaterThanOrEqual(1);
  });

  it('keeps a short drive between stops when distance is hundreds of meters', () => {
    const away = {lat: 33.23154, lng: -97.16641};
    const trips = detectTrips(
      makePoints([
        {minutes: 0, ...HOME},
        {minutes: 15, ...HOME},
        {minutes: 20, lat: 33.23, lng: -97.164},
        {minutes: 21, lat: 33.2308, lng: -97.165},
        {minutes: 22, lat: 33.2312, lng: -97.1658},
        {minutes: 23, ...away},
        {minutes: 30, ...away},
      ]),
      buildTripDetectionConfig(10, 10, 25),
    );

    expect(trips.some(t => t.kind === 'travel')).toBe(true);
    const between = trips.find(
      (t, index) =>
        t.kind === 'travel' &&
        trips[index - 1]?.kind === 'stay' &&
        trips[index + 1]?.kind === 'stay',
    );
    expect(between).toBeDefined();
  });

  it('classifies short gap + lot move as departure from last stay save', () => {
    const wb = {lat: 33.23022, lng: -97.164};
    const enRoute = {lat: 33.23108, lng: -97.16576};
    const base = new Date('2026-06-04T09:18:08.000Z');
    const row = (
      offsetMin: number,
      coords: {lat: number; lng: number},
      id: number,
    ): LocationPointRow => ({
      id,
      timestamp: new Date(base.getTime() + offsetMin * 60_000),
      lat: coords.lat,
      lng: coords.lng,
      accuracy: 5,
      altitude: null,
      speed: null,
      source: 'gps',
    });

    expect(isShortGapDeparture(row(0, wb, 1), row(2.4, enRoute, 2))).toBe(true);
    expect(
      isStaleWakeNotDeparture(row(0, wb, 1), row(19, {lat: 33.23077, lng: -97.16328}, 2)),
    ).toBe(true);
  });

  it('includes last stay point when leaving for the next stop (Jun 4 export)', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const exportPath = path.join(__dirname, '..', 'all data.json');
    if (!fs.existsSync(exportPath)) {
      return;
    }

    const raw = JSON.parse(fs.readFileSync(exportPath, 'utf8')) as {
      rows: Array<{
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
    const dayStart = new Date('2026-06-04T05:00:00.000Z');
    const points = raw.rows
      .map(row => ({
        ...row,
        timestamp: new Date(row.timestamp),
        source: row.source as LocationPointRow['source'],
      }))
      .filter(p => p.timestamp >= dayStart);

    const trips = detectTrips(points, buildTripDetectionConfig(10, 10, 25));
    const hop = trips.find(t => t.kind === 'travel' && t.points.some(p => p.id === 776));

    expect(hop?.points[0]?.id).toBe(776);
    expect((hop?.distanceKm ?? 0) * 1000).toBeGreaterThan(150);
  });

  it('ends the Galleria drive at mall arrival, not after walking inside (Jun 4 export)', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const exportPath = path.join(__dirname, '..', 'all data.json');
    if (!fs.existsSync(exportPath)) {
      return;
    }

    const raw = JSON.parse(fs.readFileSync(exportPath, 'utf8')) as {
      rows: Array<{
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
    const dayStart = new Date('2026-06-04T05:00:00.000Z');
    const points = raw.rows
      .map(row => ({
        ...row,
        timestamp: new Date(row.timestamp),
        source: row.source as LocationPointRow['source'],
      }))
      .filter(p => p.timestamp >= dayStart);

    const timeline = buildDayTimeline(
      points,
      buildTripDetectionConfig(10, 10, 25),
    );
    const eveningDrive = timeline.find(
      entry =>
        entry.kind === 'travel' &&
        entry.points.some(p => p.id === 1470 || p.id === 1467),
    );
    const mallVisit = timeline.find(
      entry =>
        entry.kind === 'stay' &&
        entry.points.some(p => p.id === 3271 || p.id === 3270),
    );

    expect(eveningDrive).toBeDefined();
    expect(mallVisit).toBeDefined();
    if (eveningDrive?.kind !== 'travel' || mallVisit?.kind !== 'stay') {
      return;
    }

    // Drive should end ~6:55 PM at arrival (#3254–#3270), not 7:16 after mall walking.
    expect(eveningDrive.endAt.getTime()).toBeLessThan(
      new Date('2026-06-04T19:05:00-05:00').getTime(),
    );
    expect(eveningDrive.points.some(p => p.id === 3350 || p.id === 3307)).toBe(
      false,
    );

    // Mall time should be one long visit (≥ 1 hr), not a 5‑min blip after 7:16.
    expect(mallVisit.durationMs).toBeGreaterThanOrEqual(60 * 60_000);
  });

  it('detects a 90+ min parking-lot stay when GPS path drifts but spread stays local (Jun 4 #4719)', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const exportPath = path.join(__dirname, '..', 'all data.json');
    if (!fs.existsSync(exportPath)) {
      return;
    }

    const raw = JSON.parse(fs.readFileSync(exportPath, 'utf8')) as {
      rows: Array<{
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
    const dayStart = new Date('2026-06-04T05:00:00.000Z');
    const points = raw.rows
      .map(row => ({
        ...row,
        timestamp: new Date(row.timestamp),
        source: row.source as LocationPointRow['source'],
      }))
      .filter(p => p.timestamp >= dayStart);

    const timeline = buildDayTimeline(
      points,
      buildTripDetectionConfig(10, 10, 25),
    );

    const stay4719 = timeline.find(
      entry =>
        entry.kind === 'stay' && entry.points.some(p => p.id === 4719),
    );
    const driveFrom4719 = timeline.find(
      entry =>
        entry.kind === 'travel' && entry.points[0]?.id === 4719,
    );

    expect(stay4719).toBeDefined();
    expect(driveFrom4719).toBeUndefined();
    if (stay4719?.kind !== 'stay') {
      return;
    }

    // Arrived ~9:26 PM, left ~10:58 PM — not a 9:26–11:19 drive.
    expect(stay4719.startAt.getTime()).toBeLessThanOrEqual(
      new Date('2026-06-05T02:26:18.000Z').getTime(),
    );
    expect(stay4719.endAt.getTime()).toBeGreaterThanOrEqual(
      new Date('2026-06-05T03:55:00.000Z').getTime(),
    );
    expect(stay4719.durationMs).toBeGreaterThanOrEqual(85 * 60_000);

    const departDrive = timeline.find(
      entry =>
        entry.kind === 'travel' &&
        entry.startAt.getTime() >= new Date('2026-06-05T03:58:00.000Z').getTime() &&
        entry.startAt.getTime() <= new Date('2026-06-05T04:05:00.000Z').getTime(),
    );
    expect(departDrive).toBeDefined();
  });

  it('extends sparse-GPS visit until next drive (Jun 5 8:53–10:47)', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const exportPath = path.join(__dirname, '..', 'all data.json');
    if (!fs.existsSync(exportPath)) {
      return;
    }

    const raw = JSON.parse(fs.readFileSync(exportPath, 'utf8')) as {
      rows: Array<{
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
    const dayStart = new Date('2026-06-05T05:00:00.000Z');
    const points = raw.rows
      .map(row => ({
        ...row,
        timestamp: new Date(row.timestamp),
        source: row.source as LocationPointRow['source'],
      }))
      .filter(p => p.timestamp >= dayStart);

    const timeline = buildDayTimeline(
      points,
      buildTripDetectionConfig(10, 10, 25),
    );

    const morningVisit = timeline.find(
      entry =>
        entry.kind === 'stay' &&
        entry.points.some(p => p.id === 10228 || p.id === 10237),
    );
    const departDrive = timeline.find(
      entry =>
        entry.kind === 'travel' &&
        entry.startAt.getTime() >= new Date('2026-06-05T15:45:00.000Z').getTime() &&
        entry.startAt.getTime() <= new Date('2026-06-05T15:50:00.000Z').getTime(),
    );

    expect(morningVisit).toBeDefined();
    expect(departDrive).toBeDefined();
    if (morningVisit?.kind !== 'stay' || departDrive?.kind !== 'travel') {
      return;
    }

    // Arrived ~8:53, sparse pings until 9:11, then no GPS until drive at 10:47.
    expect(morningVisit.durationMs).toBeGreaterThanOrEqual(109 * 60_000);
    expect(morningVisit.endAt.getTime()).toBeGreaterThanOrEqual(
      departDrive.startAt.getTime() - 60_000,
    );
  });

  it('extends inbound drive through turn-in to the visit circle (Jun 5 7-Eleven)', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const exportPath = path.join(__dirname, '..', 'all data.json');
    if (!fs.existsSync(exportPath)) {
      return;
    }

    const raw = JSON.parse(fs.readFileSync(exportPath, 'utf8')) as {
      rows: Array<{
        id: number;
        timestamp: string;
        lat: number;
        lng: number;
        source: string;
      }>;
    };
    const tripConfig = buildTripDetectionConfig(10, 10, 25);
    const points = raw.rows
      .map(row => ({
        ...row,
        timestamp: new Date(row.timestamp),
        source: row.source as LocationPointRow['source'],
        accuracy: null,
        altitude: null,
        speed: null,
      }))
      .filter(
        p =>
          p.timestamp >= new Date('2026-06-05T05:00:00.000Z') &&
          p.timestamp < new Date('2026-06-06T05:00:00.000Z'),
      );

    const timeline = buildDayTimeline(points, tripConfig);
    const visit = timeline.find(
      entry =>
        entry.kind === 'stay' &&
        entry.startAt.getTime() >= new Date('2026-06-06T04:37:00.000Z').getTime() &&
        entry.startAt.getTime() <= new Date('2026-06-06T04:42:00.000Z').getTime(),
    );
    expect(visit).toBeDefined();
    if (visit?.kind !== 'stay') {
      return;
    }

    const visitIndex = timeline.indexOf(visit);
    const drive = timeline[visitIndex - 1];
    expect(drive?.kind).toBe('travel');
    if (drive?.kind !== 'travel') {
      return;
    }

    const centroid = stayTripCentroid(visit);
    expect(drive.points[drive.points.length - 1]!.id).toBeGreaterThanOrEqual(13939);
    expect(visit.points[0]!.id).toBeGreaterThanOrEqual(13939);

    const driveRoute = getTravelDisplayPoints(
      drive,
      stayBeforeEntryIndex(timeline, visitIndex),
      staysBeforeEntryIndex(timeline, visitIndex),
      tripConfig,
    );
    const last = driveRoute[driveRoute.length - 1]!;
    const distToCentroidM =
      distanceKm(
        {lat: last.lat, lng: last.lng},
        {lat: centroid.latitude, lng: centroid.longitude},
      ) * 1000;
    expect(distToCentroidM).toBeLessThanOrEqual(60);
    // Core of the stop is in the 7-Eleven lot (~-96.804), not west on Coit (~-96.81).
    expect(centroid.longitude).toBeGreaterThan(-96.806);
    expect(centroid.longitude).toBeLessThan(-96.802);

    const connector = visitApproachConnectorCoordinates(driveRoute, visit);
    expect(connector).not.toBeNull();
    expect(connector).toHaveLength(2);
    expect(connector![1]!.latitude).toBeCloseTo(centroid.latitude, 5);
    expect(connector![1]!.longitude).toBeCloseTo(centroid.longitude, 5);
  });

  it('merges sparse charger pings into one visit with drive ending at arrival (Jun 6)', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const exportPath = path.join(__dirname, '..', 'all data.json');
    if (!fs.existsSync(exportPath)) {
      return;
    }

    const raw = JSON.parse(fs.readFileSync(exportPath, 'utf8')) as {
      rows: Array<{
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
    const tripConfig = buildTripDetectionConfig(10, 5, 25);
    const points = raw.rows
      .map(row => ({
        ...row,
        timestamp: new Date(row.timestamp),
        source: row.source as LocationPointRow['source'],
        accuracy: row.accuracy ?? null,
        altitude: row.altitude ?? null,
        speed: row.speed ?? null,
      }))
      .filter(
        p =>
          p.timestamp >= new Date('2026-06-06T05:00:00.000Z') &&
          p.timestamp < new Date('2026-06-07T05:00:00.000Z'),
      );

    const timeline = buildDayTimeline(points, tripConfig);
    const visitIndex = timeline.findIndex(
      entry => entry.kind === 'stay' && entry.points.some(p => p.id === 16329),
    );
    expect(visitIndex).toBeGreaterThan(0);
    const visit = timeline[visitIndex];
    const drive = timeline[visitIndex - 1];
    expect(visit?.kind).toBe('stay');
    expect(drive?.kind).toBe('travel');
    if (visit?.kind !== 'stay' || drive?.kind !== 'travel') {
      return;
    }

    expect(visit.points.map(p => p.id)).toEqual(
      expect.arrayContaining([16329, 16330, 16334]),
    );
    expect(visit.durationMs).toBeGreaterThanOrEqual(20 * 60_000);

    const driveRoute = getTravelDisplayPoints(
      drive,
      stayBeforeEntryIndex(timeline, visitIndex - 1),
      staysBeforeEntryIndex(timeline, visitIndex - 1),
      tripConfig,
    );
    expect(driveRoute[driveRoute.length - 1]?.id).toBe(16329);
    expect(visit.points[0]?.id).toBe(16329);
  });

  it('does not emit noise trips for jitter at one place', () => {
    const trips = detectTrips(
      makePoints([
        {minutes: 0, ...HOME},
        {minutes: 1, lat: HOME.lat + 0.00001, lng: HOME.lng + 0.00001},
      ]),
      config,
    );
    expect(trips).toHaveLength(1);
    expect(trips[0]?.kind).toBe('stay');
  });
});
