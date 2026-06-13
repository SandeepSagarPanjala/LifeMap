import {readFileSync} from 'fs';

import {
  detectTrips,
  findSavedPlaceStaySpans,
  findStaySpans,
} from '../src/lib/trip-detection.ts';
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
const generic = findStaySpans(slice, config);
const saved = findSavedPlaceStaySpans(slice, savedPlaces);

console.log('\ngeneric stay spans:');
for (const s of generic) {
  console.log(
    `  ${fmt(slice[s.start]!.timestamp)} - ${fmt(slice[s.end]!.timestamp)} idx ${s.start}-${s.end} pts=${s.end - s.start + 1}`,
  );
}

console.log('\nsaved place spans:');
for (const s of saved) {
  const place = savedPlaces.find(
    p =>
      slice.slice(s.start, s.end + 1).some(pt => {
        const d =
          Math.sqrt(
            (pt.lat - p.lat) ** 2 + ((pt.lng - p.lng) * Math.cos((pt.lat * Math.PI) / 180)) ** 2,
          ) * 111000;
        return d <= p.radiusMeters;
      }),
  );
  console.log(
    `  ${place?.label ?? '?'} ${fmt(slice[s.start]!.timestamp)} - ${fmt(slice[s.end]!.timestamp)} idx ${s.start}-${s.end}`,
  );
}

const trips = detectTrips(slice, config, {savedPlaces});
console.log('\ndetectTrips on slice:');
for (const t of trips) {
  console.log(`${t.kind} ${fmt(t.startAt)} - ${fmt(t.endAt)} pts=${t.points.length}`);
}
