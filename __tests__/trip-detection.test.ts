import {
  buildDayTimeline,
  dedupeLocationPoints,
  detectTrips,
  getTravelDisplayPoints,
  stayTripMarkerCoordinate,
} from '../src/lib/trip-detection';
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

  it('uses exact first save for visit pin when not ongoing', () => {
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
    expect(pin.latitude).toBe(33.21);
    expect(pin.longitude).toBe(-97.13);
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
    expect(kinds.filter(k => k === 'travel').length).toBeGreaterThanOrEqual(2);
    expect(kinds.filter(k => k === 'stay').length).toBeGreaterThanOrEqual(2);
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
