import {readFileSync} from 'fs';

import {detectTripsFromPoints} from '../src/lib/segmentation/index.ts';
import {buildTripDetectionConfig} from '../src/lib/trip-settings.ts';

const raw = JSON.parse(readFileSync('all data.json', 'utf8')) as {
  tables: {
    location_points: Array<{
      id: number;
      timestamp: string;
      lat: number;
      lng: number;
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

const fmt = (d: Date) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);

const all = raw.tables.location_points.map(r => ({
  ...r,
  timestamp: new Date(r.timestamp),
  source: r.source as 'gps' | 'motion' | 'heartbeat_ping',
}));
const savedPlaces = raw.tables.saved_places.map(r => ({
  ...r,
  createdAt: new Date(r.createdAt),
}));
const config = buildTripDetectionConfig(10, 5, 20);

const slice = all.filter(
  p =>
    p.timestamp >= new Date('2026-06-13T02:00:00.000Z') &&
    p.timestamp <= new Date('2026-06-13T05:00:00.000Z'),
);

console.log('slice points', slice.length);

const trips = detectTripsFromPoints(slice, config, {savedPlaces});
console.log('\ndetectTripsFromPoints on slice:');
for (const t of trips) {
  console.log(`${t.kind} ${fmt(t.startAt)} - ${fmt(t.endAt)} pts=${t.points.length}`);
}
