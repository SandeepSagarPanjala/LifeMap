import {readFileSync} from 'fs';

import {buildDayTimeline, detectTrips} from '../src/lib/trip-detection.ts';
import {prepareDayHistoryTimeline} from '../src/lib/today-history.ts';
import {buildTripDetectionConfig, TRIP_DETECTION_VERSION} from '../src/lib/trip-settings.ts';

const raw = JSON.parse(readFileSync('all data.json', 'utf8')) as {
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

const points = raw.tables.location_points.map(row => ({
  ...row,
  timestamp: new Date(row.timestamp),
  source: row.source as 'gps' | 'motion' | 'heartbeat_ping',
}));

const savedPlaces = raw.tables.saved_places.map(row => ({
  ...row,
  createdAt: new Date(row.createdAt),
}));

const config = buildTripDetectionConfig(10, 5, 20);
const dateKey = '2026-06-13';
const dayStart = new Date('2026-06-13T05:00:00.000Z');

const dayPoints = points.filter(point => {
  const dk = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(point.timestamp);
  return dk === dateKey;
});

const lookback = points.filter(point => point.timestamp < dayStart).slice(-80);
const combined = [...lookback, ...dayPoints];

const rawTrips = detectTrips(combined, config, {savedPlaces});
const rawTimeline = buildDayTimeline(combined, config, {savedPlaces});

const timeline = prepareDayHistoryTimeline(
  dateKey,
  dayPoints,
  lookback,
  config,
  new Date('2026-06-13T07:24:00.000Z'),
  [],
  {savedPlaces},
);

const fmt = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

console.log('TRIP_DETECTION_VERSION', TRIP_DETECTION_VERSION);
console.log('day points', dayPoints.length);
console.log('\n--- detectTrips raw ---');
for (const entry of rawTrips) {
  console.log(
    `${entry.kind.padEnd(6)} ${fmt(entry.startAt)} - ${fmt(entry.endAt)} pts=${entry.points.length}`,
  );
}
console.log('\n--- buildDayTimeline ---');
for (const entry of rawTimeline) {
  console.log(`${entry.kind.padEnd(6)} ${fmt(entry.startAt)} - ${fmt(entry.endAt)}`);
}
console.log('\n--- prepareDayHistoryTimeline ---');
for (const entry of timeline) {
  if (entry.kind === 'gap') {
    console.log(`gap    ${fmt(entry.startAt)} - ${fmt(entry.endAt)}`);
    continue;
  }
  console.log(
    `${entry.kind.padEnd(6)} ${fmt(entry.startAt)} - ${fmt(entry.endAt)} pts=${entry.points.length} dist=${Math.round(entry.distanceKm * 1000)}m`,
  );
}

for (let index = 0; index < timeline.length - 1; index += 1) {
  const left = timeline[index]!;
  const right = timeline[index + 1]!;
  if (left.kind !== 'gap' && right.kind !== 'gap' && left.kind === right.kind) {
    console.log('BAD ADJACENT', left.kind, fmt(left.startAt), fmt(right.startAt));
  }
}
