import {existsSync, readFileSync} from 'fs';
import {join} from 'path';

import {prepareDayHistoryTimeline} from '../src/lib/today-history';
import {buildTripDetectionConfig} from '../src/lib/trip-settings';
import type {LocationPointRow} from '../src/db/repositories/location-days';

const exportPath = join(__dirname, '..', 'all data.json');
const skip = !existsSync(exportPath);

(skip ? describe.skip : describe)('Jun 8 moments collapse bug', () => {
  it('does not merge home visit into drive when moments were captured at home', () => {
    const raw = JSON.parse(readFileSync(exportPath, 'utf8')) as {
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
        moments: Array<{timestamp: string}>;
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
    const allPoints = raw.tables.location_points.map(row => ({
      ...row,
      timestamp: new Date(row.timestamp),
      source: row.source as LocationPointRow['source'],
    }));
    const savedPlaces = raw.tables.saved_places.map(place => ({
      ...place,
      kind: place.kind as 'home' | 'work' | 'favorite',
      createdAt: new Date(place.createdAt),
    }));
    const dayStart = new Date('2026-06-08T05:00:00.000Z');
    const dayEnd = new Date('2026-06-09T04:59:59.999Z');
    const lookbackStart = new Date('2026-06-06T05:00:00.000Z');
    const dayPoints = allPoints.filter(
      p => p.timestamp >= dayStart && p.timestamp <= dayEnd,
    );
    const lookbackPoints = allPoints.filter(
      p => p.timestamp >= lookbackStart && p.timestamp < dayStart,
    );
    const dayMoments = raw.tables.moments
      .map(m => new Date(m.timestamp))
      .filter(t => t >= dayStart && t <= dayEnd);

    const withMoments = prepareDayHistoryTimeline(
      '2026-06-08',
      dayPoints,
      lookbackPoints,
      tripConfig,
      new Date('2026-06-10T12:00:00.000Z'),
      [],
      {savedPlaces, momentTimestamps: dayMoments},
      true,
    );

    const megaDrive = withMoments.find(
      e => e.kind === 'travel' && e.durationMs > 12 * 60 * 60_000,
    );
    const homeStay = withMoments.find(
      e => e.kind === 'stay' && e.durationMs >= 12 * 60 * 60_000,
    );

    expect(megaDrive).toBeUndefined();
    expect(homeStay?.kind).toBe('stay');
  });
});
