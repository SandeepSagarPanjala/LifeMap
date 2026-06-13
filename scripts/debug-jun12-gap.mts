import {readFileSync} from 'fs';

import {distanceKm} from '../src/lib/location-geo.ts';

const raw = JSON.parse(readFileSync('all data.json', 'utf8')) as {
  tables: {location_points: Array<{timestamp: string; lat: number; lng: number; speed: number | null}>};
};
const fmt = (d: Date) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);

const points = raw.tables.location_points.map(r => ({
  ...r,
  timestamp: new Date(r.timestamp),
}));

const gapStart = new Date('2026-06-13T03:09:00.000Z');
const gapEnd = new Date('2026-06-13T04:15:00.000Z');
const window = points.filter(
  p => p.timestamp >= gapStart && p.timestamp <= gapEnd,
);

console.log('Points 10:09pm - 11:15pm:', window.length);
if (window.length === 0) {
  console.log('NO GPS POINTS IN THIS HOUR — tracking gap');
} else {
  let prev = window[0];
  for (const p of window) {
    const gap = prev
      ? ((p.timestamp.getTime() - prev.timestamp.getTime()) / 60_000).toFixed(1)
      : '?';
    console.log(
      fmt(p.timestamp),
      `+${gap}m`,
      `spd=${p.speed?.toFixed(1) ?? 'null'}`,
      p.lat.toFixed(5),
      p.lng.toFixed(5),
    );
    prev = p;
  }
}

// first point after Shay visit ends
const afterShay = points.filter(
  p => p.timestamp >= new Date('2026-06-13T03:09:00.000Z'),
).slice(0, 5);
console.log('\nFirst points after 10:09pm Shay end:');
for (const p of afterShay) {
  console.log(fmt(p.timestamp), p.lat.toFixed(5), p.lng.toFixed(5), p.speed);
}
