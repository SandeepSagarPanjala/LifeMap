import {readFileSync} from 'fs';

import {buildDayTimeline, detectTrips} from '../src/lib/trip-detection.ts';
import {prepareDayHistoryTimeline} from '../src/lib/today-history.ts';
import {buildTripDetectionConfig} from '../src/lib/trip-settings.ts';
import {distanceKm} from '../src/lib/location-geo.ts';

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

const TZ = 'America/Chicago';
const fmt = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    month: 'short',
    day: 'numeric',
  }).format(date);

const points = raw.tables.location_points.map(row => ({
  ...row,
  timestamp: new Date(row.timestamp),
  source: row.source as 'gps' | 'motion' | 'heartbeat_ping',
}));
const savedPlaces = raw.tables.saved_places.map(row => ({
  ...row,
  createdAt: new Date(row.createdAt),
}));

const shay = savedPlaces.find(p => p.label === 'Shay')!;
const home = savedPlaces.find(p => p.label === 'Home')!;

const dateKey = '2026-06-12';
const dayStart = new Date('2026-06-12T05:00:00.000Z');
const dayEnd = new Date('2026-06-13T05:00:00.000Z');
const dayPoints = points.filter(
  point => point.timestamp >= dayStart && point.timestamp < dayEnd,
);
const lookback = points.filter(point => point.timestamp < dayStart).slice(-80);

const config = buildTripDetectionConfig(10, 5, 20);
const combined = [...lookback, ...dayPoints];
const rawTrips = detectTrips(combined, config, {savedPlaces});
const rawTimeline = buildDayTimeline(combined, config, {savedPlaces});

console.log('\n--- detectTrips raw (evening only) ---');
for (const entry of rawTrips) {
  if (entry.startAt >= new Date('2026-06-13T01:00:00.000Z')) {
    console.log(
      `  ${entry.kind.padEnd(6)} ${fmt(entry.startAt)} - ${fmt(entry.endAt)}  pts=${entry.points.length}`,
    );
  }
}

const entries = prepareDayHistoryTimeline(
  dateKey,
  dayPoints,
  lookback,
  config,
  new Date('2026-06-13T07:24:00.000Z'),
  [],
  {savedPlaces},
);

console.log('Jun 12 timeline:');
for (const entry of entries) {
  if (entry.kind === 'gap') {
    console.log(`  gap    ${fmt(entry.startAt)} - ${fmt(entry.endAt)}`);
    continue;
  }
  console.log(
    `  ${entry.kind.padEnd(6)} ${fmt(entry.startAt)} - ${fmt(entry.endAt)}  pts=${entry.points.length}  ${Math.round(entry.distanceKm * 1000)}m`,
  );
}

const eveningStart = new Date('2026-06-13T01:00:00.000Z'); // 8pm CDT Jun 12
const eveningEnd = new Date('2026-06-13T05:00:00.000Z'); // midnight
const evening = points.filter(
  point =>
    point.timestamp >= eveningStart && point.timestamp < eveningEnd,
);

console.log(`\nEvening GPS (${evening.length} points, 8pm-midnight):`);
let prev = evening[0];
for (const point of evening) {
  const ds = (distanceKm(point, shay) * 1000).toFixed(0);
  const dh = (distanceKm(point, home) * 1000).toFixed(0);
  const gap =
    prev != null
      ? ((point.timestamp.getTime() - prev.timestamp.getTime()) / 60_000).toFixed(
          1,
        )
      : '?';
  console.log(
    `${fmt(point.timestamp)} +${gap}min spd=${point.speed?.toFixed(1) ?? 'null'} shay=${ds}m home=${dh}m ${point.lat.toFixed(5)} ${point.lng.toFixed(5)}`,
  );
  prev = point;
}
