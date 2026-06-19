import fs from 'node:fs';
import path from 'node:path';

import type {LocationPointRow} from '@/db/repositories/location-days';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {toDateKey} from '@/lib/day-utils';
import {buildExplorerDayTimeline} from '@/lib/explorer-day-trips';
import {detectSegmentsForDay} from '@/lib/segmentation';
import {getDefaultTripDetectionConfig} from '@/lib/trip-materialization';

type ExportJson = {
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
    saved_places: SavedPlaceRow[];
  };
};

function loadExport(): ExportJson {
  const file = path.join(__dirname, '..', 'all data.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ExportJson;
}

function rowToLocationPoint(
  row: ExportJson['tables']['location_points'][number],
): LocationPointRow {
  return {
    id: row.id,
    timestamp: new Date(row.timestamp),
    lat: row.lat,
    lng: row.lng,
    accuracy: row.accuracy,
    altitude: row.altitude,
    speed: row.speed,
    source: row.source,
  };
}

function pointsForDayKeys(
  points: LocationPointRow[],
  keys: Set<string>,
): LocationPointRow[] {
  return points.filter(point => keys.has(toDateKey(point.timestamp)));
}

describe('Jun 16 segmentation vs mobile timeline', () => {
  const dateKey = '2026-06-16';
  const exportData = loadExport();
  const allPoints = exportData.tables.location_points.map(rowToLocationPoint);
  const savedPlaces = exportData.tables.saved_places;
  const config = getDefaultTripDetectionConfig();

  const windowKeys = new Set(['2026-06-15', dateKey, '2026-06-17']);
  const windowPoints = pointsForDayKeys(allPoints, windowKeys);

  it('raw segmentation includes Home stay after Kroger drive', () => {
    const segments = detectSegmentsForDay(
      dateKey,
      windowPoints,
      config,
      savedPlaces,
    );
    const last = segments[segments.length - 1]!;
    expect(last.kind).toBe('stay');
    if (last.kind === 'stay') {
      expect(last.savedPlaceLabel).toBe('Home');
    }
  });

  it('explorer timeline keeps the last Home stay', () => {
    const entries = buildExplorerDayTimeline(
      dateKey,
      windowPoints,
      config,
      savedPlaces,
    );
    const last = entries[entries.length - 1]!;
    expect(last.kind).toBe('stay');
    if (last.kind === 'stay') {
      expect(last.savedPlaceLabel).toBe('Home');
    }
  });
});
