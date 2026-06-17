import fs from 'node:fs';
import path from 'node:path';

import type {LocationPointRow} from '@/db/repositories/location-days';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {toDateKey} from '@/lib/day-utils';
import {buildExplorerDayTimeline} from '@/lib/explorer-day-trips';
import {
  getDefaultTripDetectionConfig,
  isClosedPlayableEntry,
} from '@/lib/trip-materialization';

function loadPoints(): {
  points: LocationPointRow[];
  savedPlaces: SavedPlaceRow[];
} {
  const file = path.join(__dirname, '..', 'all data.json');
  if (!fs.existsSync(file)) {
    return {points: [], savedPlaces: []};
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
      saved_places: SavedPlaceRow[];
    };
  };
  return {
    points: raw.tables.location_points.map(row => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      lat: row.lat,
      lng: row.lng,
      accuracy: row.accuracy,
      altitude: row.altitude,
      speed: row.speed,
      source: row.source,
    })),
    savedPlaces: raw.tables.saved_places,
  };
}

describe('explorer closed entries carry GPS for trip_points', () => {
  const {points, savedPlaces} = loadPoints();
  const config = getDefaultTripDetectionConfig();

  it('closed playable entries include route points', () => {
    if (points.length === 0) {
      return;
    }

    const dateKeys = [...new Set(points.map(p => toDateKey(p.timestamp)))].sort();
    let closedWithPoints = 0;
    let closedWithoutPoints = 0;

    for (const dateKey of dateKeys) {
      const prev = toDateKey(new Date(dateKey + 'T12:00:00Z'));
      void prev;
      const windowKeys = new Set([
        shift(dateKey, -1),
        dateKey,
        shift(dateKey, 1),
      ]);
      const windowPoints = points.filter(p =>
        windowKeys.has(toDateKey(p.timestamp)),
      );
      const entries = buildExplorerDayTimeline(
        dateKey,
        windowPoints,
        config,
        savedPlaces,
      );
      for (const entry of entries.filter(isClosedPlayableEntry)) {
        if (entry.points.length > 0) {
          closedWithPoints += 1;
        } else {
          closedWithoutPoints += 1;
        }
      }
    }

    expect(closedWithPoints).toBeGreaterThan(0);
    expect(closedWithoutPoints).toBe(0);
  });
});

function shift(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + delta));
  return date.toISOString().slice(0, 10);
}
