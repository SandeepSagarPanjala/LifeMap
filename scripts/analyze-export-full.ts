import {readFileSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';
import {format} from 'date-fns';

import {distanceKm} from '../src/lib/location-geo';
import {dedupeLocationPoints} from '../src/lib/trip-detection';
import {buildDayTimeline} from '../src/lib/segmentation';
import {buildTripDetectionConfig} from '../src/lib/trip-settings';
import type {LocationPointRow} from '../src/db/repositories/location-days';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const raw = JSON.parse(readFileSync(join(root, 'all data.json'), 'utf8')) as {
  exportedAt: string;
  rowCount: number;
  rows: Array<{
    id: number;
    timestamp: string;
    lat: number;
    lng: number;
    accuracy: number | null;
    altitude: number | null;
    speed: number | null;
    source: string;
  }>;
};

const TZ = 'America/Chicago';

function formatCentral(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(typeof iso === 'string' ? new Date(iso) : iso);
}

function dateKeyCentral(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

const points: LocationPointRow[] = raw.rows.map(r => ({
  id: r.id,
  timestamp: new Date(r.timestamp),
  lat: r.lat,
  lng: r.lng,
  accuracy: r.accuracy,
  altitude: r.altitude,
  speed: r.speed,
  source: r.source as LocationPointRow['source'],
}));

const config25 = buildTripDetectionConfig(10, 10, 25);
const config150 = buildTripDetectionConfig(10, 10, 150);

function report(config: ReturnType<typeof buildTripDetectionConfig>, label: string) {
  const deduped = dedupeLocationPoints(points);
  const timeline = buildDayTimeline(points, config);
  const stays = timeline.filter(e => e.kind === 'stay');
  const travels = timeline.filter(e => e.kind === 'travel');
  const gaps = timeline.filter(e => e.kind === 'gap');

  console.log(`\n### ${label}`);
  console.log(`Deduped: ${deduped.length} / ${points.length} raw`);
  console.log(`Timeline: ${stays.length} visits, ${travels.length} drives, ${gaps.length} gaps`);
  stays.forEach((s, i) => {
    const p0 = s.points[0]!;
    console.log(
      `  Visit ${i + 1}: ${formatCentral(s.startAt)} → ${formatCentral(s.endAt)} (${Math.round(s.durationMs / 60000)} min, ${s.points.length} saves) device-format start: ${format(s.startAt, 'h:mm a')}`,
    );
    console.log(`    anchor: ${p0.lat.toFixed(5)}, ${p0.lng.toFixed(5)} id=${p0.id}`);
  });
  const lastStay = stays[stays.length - 1];
  if (lastStay) {
    console.log(
      `  OPEN VISIT label would show: "Here from ${format(lastStay.startAt, 'h:mm a')} – …"`,
    );
  }
}

console.log('# Full DB timeline (same as app: getAllLocationPoints + buildDayTimeline)');
console.log(`Exported ${formatCentral(raw.exportedAt)}, ${raw.rowCount} rows`);

report(config25, '25 m dwell radius (default setting)');
report(config150, '150 m dwell radius');

// Jun 3 home cluster
const home = {lat: 33.25045, lng: -97.15306};
const jun3 = dedupeLocationPoints(
  points.filter(p => dateKeyCentral(p.timestamp.toISOString()) === '2026-06-03'),
);
console.log('\n### Jun 3 deduped saves near home (first/last)');
const near = jun3.filter(p => distanceKm(home, p) * 1000 <= 150);
if (near.length) {
  console.log(`First near home: ${formatCentral(near[0]!.timestamp)} id=${near[0]!.id}`);
  console.log(`Last near home: ${formatCentral(near[near.length - 1]!.timestamp)} id=${near[near.length - 1]!.id}`);
}

// Find save that formats to 10:20 PM (local device = we simulate with Chicago)
for (const p of dedupeLocationPoints(points)) {
  const local = format(p.timestamp, 'h:mm a');
  if (local === '10:20 PM') {
    console.log(`\nRow formatting as 10:20 PM (date-fns local): ${p.timestamp.toISOString()} id=${p.id} Central=${formatCentral(p.timestamp)}`);
  }
}

// Why 3 home visits at 25m — show deduped saves between visit 2 end and visit 3 start
const deduped = dedupeLocationPoints(points);
const trips25 = buildDayTimeline(points, config25);
const v2 = trips25.filter(e => e.kind === 'stay')[1];
const v3 = trips25.filter(e => e.kind === 'stay')[2];
if (v2 && v3) {
  console.log('\n### Break between Visit 2 and Visit 3 (25 m)');
  const gapPoints = deduped.filter(
    p =>
      p.timestamp > v2.endAt &&
      p.timestamp < v3.startAt,
  );
  gapPoints.forEach(p => {
    const d2 = (distanceKm(v2.points[0]!, p) * 1000).toFixed(1);
    const d3 = (distanceKm(v3.points[0]!, p) * 1000).toFixed(1);
    console.log(
      `  ${formatCentral(p.timestamp)} id=${p.id} ${p.lat.toFixed(5)},${p.lng.toFixed(5)} — ${d2}m from V2 anchor, ${d3}m from V3 anchor`,
    );
  });
  if (gapPoints.length === 0) {
    console.log('  (no saves between — cluster gap / anchor reset on next ping)');
  }
}
