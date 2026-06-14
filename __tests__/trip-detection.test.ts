import {
  buildDayTimeline,
  dedupeLocationPoints,
  detectTrips,
  findSavedPlaceStaySpans,
  getTravelDisplayPoints,
  getVisitInboundTravelPoints,
  visitApproachConnectorCoordinates,
  visitInAreaRouteSegments,
  isShortGapDeparture,
  isStaleWakeNotDeparture,
  stayMapCentroid,
  stayMapMarkerCoordinate,
  stayTripCentroid,
  stayTripMarkerCoordinate,
  findNextPlayableTimelineIndex,
  findPrevPlayableTimelineIndex,
  firstPlayableTimelineIndex,
  lastPlayableTimelineIndex,
  staysBeforeEntryIndex,
  stayBeforeEntryIndex,
  isSparseTravelRoute,
  mergeStaySpansAcrossSparseGaps,
} from '../src/lib/trip-detection';
import {distanceKm} from '../src/lib/location-geo';
import {buildTripDetectionConfig} from '../src/lib/trip-settings';
import type {LocationPointRow} from '../src/db/repositories/location-days';
import type {DetectedTrip} from '../src/lib/trip-detection';

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

    const kinds = timeline.map(e => e.kind);
    expect(kinds).toEqual(['stay', 'travel', 'stay', 'travel', 'stay']);
    expect(timeline[0]?.kind).toBe('stay');
    expect(timeline[2]?.kind).toBe('stay');
    expect(timeline[4]?.kind).toBe('stay');
    if (timeline[1]?.kind === 'travel' && timeline[0]?.kind === 'stay') {
      expect(timeline[0].endAt.getTime()).toBe(timeline[1].startAt.getTime());
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

    const driveRoute = getVisitInboundTravelPoints(
      drive,
      visit,
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

    expect(visitApproachConnectorCoordinates(driveRoute, visit)).toBeNull();
    expect(visitInAreaRouteSegments(visit, tripConfig).length).toBeGreaterThan(0);
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

  it('does not split a drive at a pause when a moment was captured there', () => {
    const stopLat = 33.23;
    const stopLng = -97.08;
    const points = makePoints([
      {minutes: 0, ...HOME},
      {minutes: 60, ...HOME},
      {minutes: 110, ...HOME},
      {minutes: 120, lat: 33.22, lng: -97.1},
      {minutes: 125, lat: 33.225, lng: -97.09},
      {minutes: 130, lat: stopLat, lng: stopLng},
      {minutes: 136, lat: stopLat, lng: stopLng},
      {minutes: 142, lat: stopLat, lng: stopLng},
      {minutes: 148, lat: 33.24, lng: -97.07},
      {minutes: 155, lat: 33.245, lng: -97.06},
      {minutes: 165, ...WALMART},
      {minutes: 180, ...WALMART},
    ]);
    const momentAt = new Date(
      points.find(point => point.id === 7)!.timestamp.getTime() + 3 * 60_000,
    );

    const withoutMoments = buildDayTimeline(points, config);
    const withMoment = buildDayTimeline(points, config, {
      momentTimestamps: [momentAt],
    });

    expect(withoutMoments.map(entry => entry.kind)).toEqual([
      'stay',
      'travel',
      'stay',
      'travel',
      'stay',
    ]);
    expect(withMoment.map(entry => entry.kind)).toEqual([
      'stay',
      'travel',
      'stay',
    ]);

    const splitDrive = withoutMoments[1];
    const mergedDrive = withMoment[1];
    expect(splitDrive?.kind).toBe('travel');
    expect(mergedDrive?.kind).toBe('travel');
    if (splitDrive?.kind !== 'travel' || mergedDrive?.kind !== 'travel') {
      return;
    }
    expect(mergedDrive.durationMs).toBeGreaterThan(splitDrive.durationMs);
  });

  it('bridges drive start to visit pin when prior stay row ends on departure road GPS', () => {
    const library = {
      id: 1,
      timestamp: new Date('2026-06-06T21:25:00.000Z'),
      lat: 33.05582,
      lng: -96.83425,
      accuracy: 10,
      altitude: null,
      speed: 0,
      source: 'gps' as const,
    };
    const road = {
      id: 2,
      timestamp: new Date('2026-06-06T21:34:10.000Z'),
      lat: 33.05809,
      lng: -96.83283,
      accuracy: 10,
      altitude: null,
      speed: 14,
      source: 'gps' as const,
    };
    const previousStay: DetectedTrip = {
      id: 'stay-library',
      kind: 'stay',
      points: [library, road],
      startAt: new Date('2026-06-06T20:13:00.000Z'),
      endAt: road.timestamp,
      distanceKm: 0,
      durationMs: 1,
    };
    const travel: DetectedTrip = {
      id: 'travel-tesla',
      kind: 'travel',
      points: [road, {...road, id: 3, lat: 33.05928, lng: -96.83279}],
      startAt: road.timestamp,
      endAt: new Date('2026-06-06T21:39:00.000Z'),
      distanceKm: 1,
      durationMs: 1,
    };

    const route = getTravelDisplayPoints(travel, previousStay, [], config);
    expect(route[0]?.lat).toBeCloseTo(library.lat, 3);
    expect(route[0]?.lat).not.toBeCloseTo(road.lat, 3);
  });
});

describe('playable timeline navigation', () => {
  const stay = {
    id: 'stay-1',
    kind: 'stay' as const,
    points: [],
    startAt: new Date('2026-06-08T08:00:00'),
    endAt: new Date('2026-06-08T09:00:00'),
    distanceKm: 0,
    durationMs: 3_600_000,
  };
  const gap = {
    kind: 'gap' as const,
    startAt: new Date('2026-06-08T09:00:00'),
    endAt: new Date('2026-06-08T10:00:00'),
    durationMs: 3_600_000,
    distanceKm: 0,
  };
  const travel = {
    id: 'travel-1',
    kind: 'travel' as const,
    points: [],
    startAt: new Date('2026-06-08T10:00:00'),
    endAt: new Date('2026-06-08T11:00:00'),
    distanceKm: 5,
    durationMs: 3_600_000,
  };
  const entries = [stay, gap, travel];

  it('skips gaps when moving to the next playable entry', () => {
    expect(firstPlayableTimelineIndex(entries)).toBe(0);
    expect(lastPlayableTimelineIndex(entries)).toBe(2);
    expect(findNextPlayableTimelineIndex(entries, 0)).toBe(2);
    expect(findNextPlayableTimelineIndex(entries, 1)).toBe(2);
    expect(findNextPlayableTimelineIndex(entries, 2)).toBe(-1);
  });

  it('skips gaps when moving to the previous playable entry', () => {
    expect(findPrevPlayableTimelineIndex(entries, 2)).toBe(0);
    expect(findPrevPlayableTimelineIndex(entries, 1)).toBe(0);
    expect(findPrevPlayableTimelineIndex(entries, 0)).toBe(-1);
  });
});

describe('findSavedPlaceStaySpans', () => {
  const homePlace = {
    id: 1,
    kind: 'home' as const,
    label: 'Home',
    lat: 33.25045,
    lng: -97.15306,
    radiusMeters: 150,
    createdAt: new Date(),
  };

  it('detects a long home visit from points within 150 m of saved home', () => {
    const start = new Date('2026-06-08T05:20:00.000Z');
    const points: LocationPointRow[] = [];
    for (let hour = 0; hour < 20; hour += 1) {
      points.push({
        id: hour + 1,
        timestamp: new Date(start.getTime() + hour * 60 * 60_000),
        lat: 33.25045 + hour * 0.00001,
        lng: -97.15306,
        accuracy: 10,
        altitude: null,
        speed: null,
        source: 'gps',
      });
    }

    const spans = findSavedPlaceStaySpans(points, [homePlace]);
    expect(spans).toHaveLength(1);
    expect(spans[0]?.start).toBe(0);
    expect(spans[0]?.end).toBe(points.length - 1);
  });

  it('splits home visit from a real departure to another city', () => {
    const homePoints = makePoints([
      {minutes: 0, lat: 33.25045, lng: -97.15306},
      {minutes: 60, lat: 33.2505, lng: -97.1531},
      {minutes: 120, lat: 33.2504, lng: -97.153},
    ]);
    const awayPoints = makePoints([
      {minutes: 180, lat: 33.28, lng: -97.05},
      {minutes: 240, lat: 33.29, lng: -97.04},
    ]);
    const points = [...homePoints, ...awayPoints];

    const spans = findSavedPlaceStaySpans(points, [homePlace]);
    expect(spans).toHaveLength(1);
    expect(spans[0]?.end).toBe(2);
  });

  it('does not treat a 2-point long hop as a meaningful drive', () => {
    const base = new Date('2026-06-13T05:00:00.000Z');
    const points = [
      {
        id: 1,
        timestamp: base,
        lat: 33.15,
        lng: -96.82,
        accuracy: 10,
        altitude: null,
        speed: 15,
        source: 'gps' as const,
      },
      {
        id: 2,
        timestamp: new Date(base.getTime() + 27 * 60_000),
        lat: 33.25,
        lng: -97.15,
        accuracy: 10,
        altitude: null,
        speed: 0,
        source: 'gps' as const,
      },
    ];
    const trips = detectTrips(points, buildTripDetectionConfig(10, 5, 20));
    expect(trips.some(trip => trip.kind === 'travel')).toBe(false);
  });

  it('does not overlap adjacent drive and stay times', () => {
    const base = new Date('2026-06-13T01:25:00.000Z');
    const point = (
      minutes: number,
      lat: number,
      lng: number,
      speed: number | null,
    ): LocationPointRow => ({
      id: minutes,
      timestamp: new Date(base.getTime() + minutes * 60_000),
      lat,
      lng,
      accuracy: 10,
      altitude: null,
      speed,
      source: 'gps',
    });

    const home = {lat: 33.25, lng: -97.15};
    const shay = {lat: 33.22, lng: -96.82};
    const points = [
      point(0, home.lat, home.lng, 0),
      point(30, home.lat + 0.01, home.lng + 0.01, 15),
      point(33, home.lat + 0.02, home.lng + 0.015, 15),
      point(36, shay.lat + 0.02, shay.lng + 0.01, 12),
      point(37, shay.lat + 0.001, shay.lng + 0.0005, 4),
      point(38, shay.lat + 0.0001, shay.lng, 0),
      point(90, shay.lat + 0.0002, shay.lng + 0.0001, 0),
      point(120, shay.lat + 0.03, shay.lng + 0.02, 15),
      point(127, shay.lat + 0.04, shay.lng + 0.03, 15),
      point(131, shay.lat + 0.045, shay.lng + 0.035, 12),
      point(134, shay.lat + 0.05, shay.lng + 0.04, 0),
    ];

    const trips = detectTrips(points, buildTripDetectionConfig(10, 5, 20));
    expect(trips.length).toBeGreaterThan(0);
    for (let index = 0; index < trips.length - 1; index += 1) {
      const left = trips[index]!;
      const right = trips[index + 1]!;
      if (left.kind === 'stay' && right.kind === 'stay') {
        continue;
      }
      expect(left.kind).not.toBe(right.kind);
      expect(left.endAt.getTime()).toBeLessThanOrEqual(right.startAt.getTime());
      if (left.kind === 'travel' && right.kind === 'stay') {
        expect(left.endAt.getTime()).toBe(right.startAt.getTime());
      }
      if (left.kind === 'stay' && right.kind === 'travel') {
        expect(left.endAt.getTime()).toBe(right.startAt.getTime());
      }
    }
  });

  it('treats collinear few-point long routes as sparse', () => {
    const base = new Date('2026-06-13T05:43:00.000Z');
    const points = [
      {
        id: 1,
        timestamp: base,
        lat: 33.15,
        lng: -96.82,
        accuracy: 10,
        altitude: null,
        speed: 15,
        source: 'gps' as const,
      },
      {
        id: 2,
        timestamp: new Date(base.getTime() + 20 * 60_000),
        lat: 33.2,
        lng: -97.0,
        accuracy: 10,
        altitude: null,
        speed: 15,
        source: 'gps' as const,
      },
      {
        id: 3,
        timestamp: new Date(base.getTime() + 46 * 60_000),
        lat: 33.25,
        lng: -97.15,
        accuracy: 10,
        altitude: null,
        speed: 0,
        source: 'gps' as const,
      },
    ];
    expect(isSparseTravelRoute(points)).toBe(true);
  });

  it('aligns map visit anchor with drive arrival for Slim Chickens (Jun 12 export)', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const exportPath = path.join(__dirname, '..', 'all data.json');
    if (!fs.existsSync(exportPath)) {
      return;
    }

    const raw = JSON.parse(fs.readFileSync(exportPath, 'utf8')) as {
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
        saved_places: Array<{
          id: number;
          kind: string;
          label: string;
          lat: number;
          lng: number;
          radiusMeters: number;
          createdAt: string;
        }>;
      };
    };

    const {endOfDay} = require('date-fns') as typeof import('date-fns');
    const {
      prepareDayHistoryTimeline,
      getHistoryLookaheadEnd,
    } = require('../src/lib/today-history') as typeof import('../src/lib/today-history');
    const {buildHistoryMapPlan} =
      require('../src/lib/history-map-plan') as typeof import('../src/lib/history-map-plan');
    const {getDayRange} =
      require('../src/lib/day-utils') as typeof import('../src/lib/day-utils');

    const points = raw.tables.location_points.map(row => ({
      ...row,
      timestamp: new Date(row.timestamp),
      source: row.source as LocationPointRow['source'],
    }));
    const savedPlaces = raw.tables.saved_places.map(row => ({
      ...row,
      createdAt: new Date(row.createdAt),
    }));
    const tripConfig = buildTripDetectionConfig(10, 5, 20);
    const {start: dayStart} = getDayRange('2026-06-12');
    const dayEnd = endOfDay(dayStart);
    const entries = prepareDayHistoryTimeline(
      '2026-06-12',
      points.filter(point => point.timestamp >= dayStart && point.timestamp <= dayEnd),
      points.filter(point => point.timestamp < dayStart),
      tripConfig,
      new Date('2026-06-13T07:24:00.000Z'),
      points.filter(
        point =>
          point.timestamp > dayEnd &&
          point.timestamp <= getHistoryLookaheadEnd(dayEnd),
      ),
      {savedPlaces},
    );

    const driveIndex = entries.findIndex(
      entry =>
        entry.kind === 'travel' &&
        entry.endAt.toISOString() === '2026-06-13T03:39:19.000Z',
    );
    const visit = entries[driveIndex + 1];
    expect(visit?.kind).toBe('stay');
    if (visit?.kind !== 'stay') {
      return;
    }

    const plan = buildHistoryMapPlan(entries, driveIndex, tripConfig);
    const travelPoints = plan.selected?.travelPoints ?? [];
    const marker = stayMapMarkerCoordinate(visit);
    const last = travelPoints[travelPoints.length - 1]!;
    const gapM =
      distanceKm(
        {lat: last.lat, lng: last.lng},
        {lat: marker.latitude, lng: marker.longitude},
      ) * 1000;

    expect(gapM).toBeLessThanOrEqual(5);
    expect(stayMapCentroid(visit).latitude).toBeCloseTo(marker.latitude, 5);
  });

  it('merges same-place stay spans across sparse GPS gaps', () => {
    const charger = {lat: 33.12, lng: -96.82};
    const points = makePoints([
      {minutes: 0, ...charger},
      {minutes: 8, ...charger},
      {minutes: 35, ...charger},
      {minutes: 43, ...charger},
    ]);
    points[2]!.timestamp = new Date(points[1]!.timestamp.getTime() + 27 * 60_000);
    points[3]!.timestamp = new Date(points[2]!.timestamp.getTime() + 8 * 60_000);

    const dwellConfig = buildTripDetectionConfig(10, 5, 50);
    const rawSpans = [
      {start: 0, end: 1},
      {start: 2, end: 3},
    ];
    const merged = mergeStaySpansAcrossSparseGaps(points, rawSpans, dwellConfig);

    expect(merged).toEqual([{start: 0, end: 3}]);
  });
});
