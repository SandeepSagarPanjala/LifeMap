import {
  getCurrentOpenVisit,
  getHistoryLookaheadEnd,
  prepareDayHistoryTimeline,
  prepareTodayHistoryTimeline,
} from '../src/lib/today-history';
import {buildHistoryDayRuler} from '../src/lib/history-timeline';
import {buildTripDetectionConfig} from '../src/lib/trip-settings';
import {getDayRange} from '../src/lib/day-utils';
import type {LocationPointRow} from '../src/db/repositories/location-days';
import {mapExportSavedPlace} from './helpers/fixtures';
import {ALL_DATA_EXPORT_PATH} from './helpers/personal-export';
import {endOfDay} from 'date-fns';

const config = buildTripDetectionConfig(10, 10, 25);
const home = {lat: 33.25045, lng: -97.15306};

function row(
  iso: string,
  id: number,
  coords = home,
): LocationPointRow {
  return {
    id,
    timestamp: new Date(iso),
    lat: coords.lat,
    lng: coords.lng,
    accuracy: 10,
    altitude: null,
    speed: null,
    source: 'gps',
  };
}

describe('prepareTodayHistoryTimeline', () => {
  const dayStart = new Date('2026-06-04T05:00:00.000Z'); // Jun 4 12 AM CDT
  const now = new Date('2026-06-04T08:42:00.000Z'); // 3:42 AM CDT

  it('extends open visit to now and from midnight when still home overnight', () => {
    const lookback = [row('2026-06-04T04:12:00.000Z', 1)]; // 11:12 PM Jun 3 CDT
    const today = [row('2026-06-04T06:36:29.000Z', 3)]; // 1:36 AM CDT
    const savedPlaces = [
      {
        id: 1,
        kind: 'home' as const,
        label: 'Home',
        lat: home.lat,
        lng: home.lng,
        radiusMeters: 100,
        createdAt: new Date('2026-01-01'),
      },
    ];

    const entries = prepareDayHistoryTimeline(
      '2026-06-04',
      today,
      lookback,
      config,
      now,
      [],
      {savedPlaces},
    );
    const stay = entries.find(e => e.kind === 'stay');
    expect(stay?.kind).toBe('stay');
    if (stay?.kind === 'stay') {
      expect(stay.startAt).toEqual(dayStart);
      expect(stay.endAt).toEqual(now);
      expect(stay.openThroughNow).toBe(true);
      expect(stay.durationMs).toBe(now.getTime() - dayStart.getTime());
    }
  });

  it('extends last stay through end of day on a past day with no later saves', () => {
    const dayKey = '2026-06-03';
    const lastPing = new Date('2026-06-04T04:12:13.000Z');
    const referenceNow = new Date('2026-06-04T12:00:00.000Z');
    const dayPoints = [
      row('2026-06-03T23:49:00.000Z', 1),
      row(lastPing.toISOString(), 2),
    ];

    const entries = prepareDayHistoryTimeline(
      dayKey,
      dayPoints,
      [],
      config,
      referenceNow,
    );
    const stay = entries[entries.length - 1];
    expect(stay?.kind).toBe('stay');
    if (stay?.kind === 'stay') {
      expect(stay.openThroughNow).toBeFalsy();
      expect(stay.endAt.getTime()).toBeGreaterThan(lastPing.getTime());
      expect(stay.endAt.getTime()).toBe(
        new Date('2026-06-04T04:59:59.999Z').getTime(),
      );
    }
  });

  it('getCurrentOpenVisit returns open stay when user is still on site', () => {
    const lookback = [row('2026-06-04T04:12:00.000Z', 1)];
    const today = [row('2026-06-04T06:36:29.000Z', 3)];
    const savedPlaces = [
      {
        id: 1,
        kind: 'home' as const,
        label: 'Home',
        lat: home.lat,
        lng: home.lng,
        radiusMeters: 100,
        createdAt: new Date('2026-01-01'),
      },
    ];
    const entries = prepareDayHistoryTimeline(
      '2026-06-04',
      today,
      lookback,
      config,
      now,
      [],
      {savedPlaces},
    );
    const visit = getCurrentOpenVisit(entries, {
      userCoordinate: {latitude: home.lat, longitude: home.lng},
      config,
    });
    expect(visit?.kind).toBe('stay');
    expect(visit?.openThroughNow).toBe(true);
  });

  it('getCurrentOpenVisit hides when live GPS is away from the visit', () => {
    const today = [row('2026-06-04T06:36:29.000Z', 1)];
    const entries = prepareTodayHistoryTimeline(
      today,
      [],
      dayStart,
      now,
      config,
    );
    const visit = getCurrentOpenVisit(entries, {
      userCoordinate: {latitude: 33.3, longitude: -97.2},
      config,
    });
    expect(visit).toBeNull();
  });

  it('extends last stay through now when no saves after last ping', () => {
    const today = [
      row('2026-06-04T06:36:29.000Z', 1),
      row('2026-06-04T08:11:12.000Z', 2),
    ];

    const entries = prepareTodayHistoryTimeline(
      today,
      [],
      dayStart,
      now,
      config,
    );
    const stay = entries.find(e => e.kind === 'stay');
    expect(stay?.kind).toBe('stay');
    if (stay?.kind === 'stay') {
      expect(stay.endAt).toEqual(now);
      expect(stay.openThroughNow).toBe(true);
    }
  });

  it('does not extend a stay through a drive that follows it (Jun 19 export)', () => {
    const fs = require('fs') as typeof import('fs');
    const exportPath = ALL_DATA_EXPORT_PATH;
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
    const tripConfig = buildTripDetectionConfig(10, 5, 75);
    const allPoints = raw.tables.location_points.map(point => ({
      ...point,
      timestamp: new Date(point.timestamp),
      source: point.source as LocationPointRow['source'],
    }));
    const dayStart = new Date('2026-06-19T05:00:00.000Z');
    const dayEnd = new Date('2026-06-20T04:59:59.999Z');
    const referenceNow = new Date('2026-06-20T00:50:00.000Z'); // 7:50 PM CDT, mid-drive
    const dayPoints = allPoints.filter(
      p => p.timestamp >= dayStart && p.timestamp <= referenceNow,
    );
    const lookback = allPoints.filter(p => p.timestamp < dayStart);
    const savedPlaces = (raw.tables.saved_places ?? []).map(mapExportSavedPlace);

    const entries = prepareDayHistoryTimeline(
      '2026-06-19',
      dayPoints,
      lookback,
      tripConfig,
      referenceNow,
      [],
      {savedPlaces},
    );

    const evening = entries.filter(
      entry =>
        entry.kind !== 'gap' &&
        entry.startAt.getTime() >= new Date('2026-06-20T00:00:00.000Z').getTime(),
    );
    const vishnuStay = evening.find(
      entry => entry.kind === 'stay' && entry.savedPlaceLabel === 'Vishnu',
    );
    const followingTravel = evening.find(
      (entry, index) =>
        entry.kind === 'travel' &&
        evening[index - 1]?.kind === 'stay' &&
        (evening[index - 1] as {savedPlaceLabel?: string}).savedPlaceLabel ===
          'Vishnu',
    );

    expect(vishnuStay?.kind).toBe('stay');
    expect(followingTravel?.kind).toBe('travel');
    if (vishnuStay?.kind === 'stay') {
      expect(vishnuStay.openThroughNow).toBeFalsy();
      expect(vishnuStay.endAt.getTime()).toBeLessThan(referenceNow.getTime());
      expect(vishnuStay.endAt.getTime()).toBeLessThanOrEqual(
        followingTravel!.endAt.getTime(),
      );
    }
  });

  it('does not split a midnight drive into a fake visit and restart', () => {
    const road = {lat: 33.22, lng: -96.95};
    const moving = (iso: string, id: number, latOffset: number): LocationPointRow => ({
      id,
      timestamp: new Date(iso),
      lat: road.lat + latOffset,
      lng: road.lng + latOffset * 0.01,
      accuracy: 8,
      altitude: 180,
      speed: 20,
      source: 'gps',
    });

    const jun7Points = [
      moving('2026-06-08T04:51:00.000Z', 1, 0), // 11:51 PM Jun 7 CDT
      moving('2026-06-08T04:54:00.000Z', 2, 0.01),
      moving('2026-06-08T04:57:00.000Z', 3, 0.02),
      moving('2026-06-08T04:59:30.000Z', 4, 0.03),
    ];
    const jun8Points = [
      moving('2026-06-08T05:00:30.000Z', 5, 0.04), // 12:00 AM Jun 8 CDT
      moving('2026-06-08T05:05:00.000Z', 6, 0.08),
      moving('2026-06-08T05:10:00.000Z', 7, 0.12),
      moving('2026-06-08T05:20:00.000Z', 8, 0.2),
    ];
    const referenceNow = new Date('2026-06-08T12:00:00.000Z');

    const yesterday = prepareDayHistoryTimeline(
      '2026-06-07',
      jun7Points,
      [],
      config,
      referenceNow,
      jun8Points,
    );
    const today = prepareDayHistoryTimeline(
      '2026-06-08',
      jun8Points,
      jun7Points,
      config,
      referenceNow,
    );

    expect(yesterday.some(entry => entry.kind === 'stay')).toBe(false);
    expect(today.some(entry => entry.kind === 'stay')).toBe(false);

    const yesterdayDrive = yesterday.find(entry => entry.kind === 'travel');
    const todayDrive = today.find(entry => entry.kind === 'travel');
    expect(yesterdayDrive?.kind).toBe('travel');
    expect(todayDrive?.kind).toBe('travel');
    if (yesterdayDrive?.kind === 'travel' && todayDrive?.kind === 'travel') {
      expect(yesterdayDrive.points).toHaveLength(8);
      expect(todayDrive.points).toHaveLength(8);
      expect(yesterdayDrive.startAt.toISOString()).toBe(
        '2026-06-08T04:51:00.000Z',
      );
      expect(yesterdayDrive.endAt.toISOString()).toBe(
        '2026-06-08T05:20:00.000Z',
      );
      expect(todayDrive.startAt.toISOString()).toBe(
        '2026-06-08T04:51:00.000Z',
      );
      expect(todayDrive.endAt.toISOString()).toBe(
        '2026-06-08T05:20:00.000Z',
      );
    }

    const yesterdayBar = buildHistoryDayRuler(
      yesterday,
      '2026-06-07',
      300,
      referenceNow,
    );
    const todayBar = buildHistoryDayRuler(
      today,
      '2026-06-08',
      300,
      referenceNow,
    );
    const yesterdaySegment = yesterdayBar.segments[0]!;
    const todaySegment = todayBar.segments[0]!;
    expect(yesterdaySegment.startAt.toISOString()).toBe(
      '2026-06-08T04:51:00.000Z',
    );
    expect(yesterdaySegment.endAt.toISOString()).toBe(
      '2026-06-08T04:59:59.999Z',
    );
    expect(todaySegment.startAt.toISOString()).toBe(
      '2026-06-08T05:00:00.000Z',
    );
    expect(todaySegment.endAt.toISOString()).toBe(
      '2026-06-08T05:20:00.000Z',
    );
  });

  it('keeps home visit separate from cross-day drive when persisting (Jun 8 export)', () => {
    const fs = require('fs') as typeof import('fs');
    const exportPath = ALL_DATA_EXPORT_PATH;
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
    const tripConfig = buildTripDetectionConfig(10, 5, 25);
    const allPoints = raw.tables.location_points.map(point => ({
      ...point,
      timestamp: new Date(point.timestamp),
      source: point.source as LocationPointRow['source'],
    }));

    const dateKey = '2026-06-08';
    const jun8DayStart = new Date('2026-06-08T05:00:00.000Z');
    const dayEnd = new Date('2026-06-09T04:59:59.999Z');
    const lookbackStart = new Date('2026-06-06T05:00:00.000Z');
    const lookaheadEnd = new Date('2026-06-10T05:00:00.000Z');
    const dayPoints = allPoints.filter(
      p => p.timestamp >= jun8DayStart && p.timestamp <= dayEnd,
    );
    const lookbackPoints = allPoints.filter(
      p => p.timestamp >= lookbackStart && p.timestamp < jun8DayStart,
    );
    const lookaheadPoints = allPoints.filter(
      p => p.timestamp > dayEnd && p.timestamp <= lookaheadEnd,
    );
    const referenceNow = new Date('2026-06-10T12:00:00.000Z');
    const savedPlaces = (raw.tables.saved_places ?? []).map(mapExportSavedPlace);

    const persistEntries = prepareDayHistoryTimeline(
      dateKey,
      dayPoints,
      lookbackPoints,
      tripConfig,
      referenceNow,
      lookaheadPoints,
      {savedPlaces},
      false,
    );

    const inboundDrive = persistEntries.find(entry => entry.kind === 'travel');
    const homeStay = persistEntries.find(
      entry =>
        entry.kind === 'stay' &&
        entry.durationMs >= 12 * 60 * 60_000,
    );

    expect(inboundDrive?.kind).toBe('travel');
    expect(homeStay?.kind).toBe('stay');
    if (inboundDrive?.kind === 'travel' && homeStay?.kind === 'stay') {
      expect(inboundDrive.durationMs).toBeLessThan(60 * 60_000);
      expect(homeStay.durationMs).toBeGreaterThan(12 * 60 * 60_000);
      expect(inboundDrive.endAt.getTime()).toBeLessThanOrEqual(
        homeStay.startAt.getTime() + 5 * 60_000,
      );
    }
  });

  it('keeps a brief saved-place stop between two drives (Jun 13 Shay export)', () => {
    const fs = require('fs') as typeof import('fs');
    const exportPath = ALL_DATA_EXPORT_PATH;
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

    const points = raw.tables.location_points.map(point => ({
      ...point,
      timestamp: new Date(point.timestamp),
      source: point.source as LocationPointRow['source'],
    }));
    const savedPlaces = raw.tables.saved_places.map(mapExportSavedPlace);
    const jun13DayStart = new Date('2026-06-13T05:00:00.000Z');
    const dayPoints = points.filter(
      point => point.timestamp >= jun13DayStart && point.timestamp < new Date('2026-06-13T07:24:00.000Z'),
    );
    const lookback = points.filter(point => point.timestamp < jun13DayStart).slice(-80);

    const entries = prepareDayHistoryTimeline(
      '2026-06-13',
      dayPoints,
      lookback,
      buildTripDetectionConfig(10, 5, 20),
      new Date('2026-06-13T07:24:00.000Z'),
      [],
      {savedPlaces},
    );

    const kinds = entries.map(entry => entry.kind);
    expect(kinds).toEqual(['travel', 'stay']);

    const morningDrive = entries.find(entry => entry.kind === 'travel');
    const homeArrival = entries.find(entry => entry.kind === 'stay');
    expect(morningDrive?.kind).toBe('travel');
    expect(homeArrival?.kind).toBe('stay');
    if (morningDrive?.kind === 'travel' && homeArrival?.kind === 'stay') {
      expect(morningDrive.endAt.getTime()).toBeLessThanOrEqual(
        homeArrival.startAt.getTime() + 60_000,
      );
      expect(homeArrival.endAt).toEqual(new Date('2026-06-13T07:24:00.000Z'));
    }
  });

  it('detects Slim Chickens stop after Shay on Jun 12 export', () => {
    const fs = require('fs') as typeof import('fs');
    const exportPath = ALL_DATA_EXPORT_PATH;
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

    const points = raw.tables.location_points.map(point => ({
      ...point,
      timestamp: new Date(point.timestamp),
      source: point.source as LocationPointRow['source'],
    }));
    const savedPlaces = raw.tables.saved_places.map(mapExportSavedPlace);
    const jun12DayStart = new Date('2026-06-12T05:00:00.000Z');
    const dayPoints = points.filter(
      point =>
        point.timestamp >= jun12DayStart &&
        point.timestamp < new Date('2026-06-13T05:00:00.000Z'),
    );
    const lookback = points.filter(point => point.timestamp < jun12DayStart).slice(-80);

    const entries = prepareDayHistoryTimeline(
      '2026-06-12',
      dayPoints,
      lookback,
      buildTripDetectionConfig(10, 5, 20),
      new Date('2026-06-13T07:24:00.000Z'),
      [],
      {savedPlaces},
    );

    const evening = entries.filter(
      entry =>
        entry.kind !== 'gap' &&
        entry.startAt >= new Date('2026-06-13T01:00:00.000Z'),
    );
    const kinds = evening.map(entry => entry.kind);
    expect(kinds).toEqual(['stay', 'travel', 'stay', 'travel']);

    const shayVisit = evening.find(
      entry =>
        entry.kind === 'stay' &&
        entry.startAt.toISOString() === '2026-06-13T02:02:34.000Z',
    );
    expect(shayVisit?.kind).toBe('stay');
    expect(shayVisit?.durationMs).toBeGreaterThan(20 * 60_000);

    const slimVisit = evening.find(
      entry =>
        entry.kind === 'stay' &&
        entry.startAt.getTime() >= new Date('2026-06-13T03:38:00.000Z').getTime() &&
        entry.startAt.getTime() <= new Date('2026-06-13T03:40:00.000Z').getTime(),
    );
    expect(slimVisit).toBeUndefined();

    const crossMidnightStay = evening.find(
      entry =>
        entry.kind === 'stay' &&
        entry.startAt.toISOString() === '2026-06-13T03:48:10.000Z',
    );
    expect(crossMidnightStay?.kind).toBe('stay');
    expect(crossMidnightStay?.durationMs).toBeGreaterThan(20 * 60_000);

    const bogusMinute = evening.find(
      entry =>
        entry.kind === 'stay' &&
        entry.durationMs <= 2 * 60_000 &&
        entry.startAt.toISOString().startsWith('2026-06-13T04:09'),
    );
    expect(bogusMinute).toBeUndefined();
  });

  it('shows full cross-midnight span for non-home stays on both days (Jun 12–13 7509)', () => {
    const fs = require('fs') as typeof import('fs');
    const exportPath = ALL_DATA_EXPORT_PATH;
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

    const points = raw.tables.location_points.map(point => ({
      ...point,
      timestamp: new Date(point.timestamp),
      source: point.source as LocationPointRow['source'],
    }));
    const savedPlaces = raw.tables.saved_places.map(mapExportSavedPlace);
    const tripConfig = buildTripDetectionConfig(10, 5, 20);
    const referenceNow = new Date('2026-06-13T07:24:00.000Z');

    function loadDay(dateKey: string) {
      const {start: dayRangeStart} = getDayRange(dateKey);
      const dayEnd = endOfDay(dayRangeStart);
      const lookaheadEnd = getHistoryLookaheadEnd(dayEnd);
      const dayPoints = points.filter(
        point => point.timestamp >= dayRangeStart && point.timestamp <= dayEnd,
      );
      const lookback = points.filter(point => point.timestamp < dayRangeStart);
      const lookahead = points.filter(
        point => point.timestamp > dayEnd && point.timestamp <= lookaheadEnd,
      );
      return prepareDayHistoryTimeline(
        dateKey,
        dayPoints,
        lookback,
        tripConfig,
        referenceNow,
        lookahead,
        {savedPlaces},
      );
    }

    const jun12 = loadDay('2026-06-12');
    const jun13 = loadDay('2026-06-13');

    const jun12LastStay = jun12.filter(entry => entry.kind === 'stay').at(-1);

    expect(jun12LastStay?.kind).toBe('stay');
    if (jun12LastStay?.kind === 'stay') {
      expect(jun12LastStay.startAt.toISOString()).toBe(
        '2026-06-13T03:48:10.000Z',
      );
      expect(jun12LastStay.endAt.getTime()).toBe(
        endOfDay(getDayRange('2026-06-12').start).getTime(),
      );

      const jun12Bar = buildHistoryDayRuler(jun12, '2026-06-12', 300, referenceNow);
      const jun12Segment = jun12Bar.segments.at(-1)!;
      expect(jun12Segment.endAt).toEqual(jun12LastStay.endAt);
    }

    const jun13FirstNonGap = jun13.find(entry => entry.kind !== 'gap');
    expect(jun13FirstNonGap?.kind).toBe('travel');
  });
});
