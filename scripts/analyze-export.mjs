import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const raw = JSON.parse(readFileSync(join(root, 'all data.json'), 'utf8'));

const TZ = 'America/Chicago';

function formatCentral(iso) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(new Date(iso));
}

function dateKeyCentral(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function haversineM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function dedupe(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = `${r.timestamp}|${r.lat.toFixed(5)}|${r.lng.toFixed(5)}`;
    if (!map.has(key)) map.set(key, r);
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );
}

function findStaySpans(points, radiusM, dwellMin) {
  const radius = radiusM;
  const minDwellMs = dwellMin * 60_000;
  const spans = [];
  let i = 0;
  while (i < points.length) {
    const anchor = points[i];
    let end = i;
    while (
      end + 1 < points.length &&
      haversineM(anchor, points[end + 1]) <= radius
    ) {
      end += 1;
    }
    const spanMs =
      new Date(points[end].timestamp) - new Date(points[i].timestamp);
    const atEnd = end === points.length - 1;
    if (spanMs >= minDwellMs || atEnd) {
      spans.push({ start: i, end, anchor, spanMs });
      i = end + 1;
    } else {
      i = end + 1;
    }
  }
  return spans;
}

function detectTimeline(points, radiusM, dwellMin) {
  const deduped = dedupe(points);
  const stays = findStaySpans(deduped, radiusM, dwellMin);
  const events = [];
  let cursor = 0;
  for (let s = 0; s < stays.length; s++) {
    const stay = stays[s];
    if (stay.start > cursor) {
      events.push({
        kind: 'travel',
        points: deduped.slice(cursor, stay.start),
      });
    }
    events.push({
      kind: 'stay',
      points: deduped.slice(stay.start, stay.end + 1),
      spanMs: stay.spanMs,
    });
    cursor = stay.end + 1;
  }
  if (cursor < deduped.length) {
    events.push({ kind: 'travel', points: deduped.slice(cursor) });
  }
  return { deduped, stays, events };
}

const todayKey = '2026-06-04';
const todayRows = raw.rows.filter(
  (r) => dateKeyCentral(r.timestamp) === todayKey,
);
const homeCluster = { lat: 33.25045, lng: -97.15306 };

const analysis25 = detectTimeline(todayRows, 25, 10);
const analysis150 = detectTimeline(todayRows, 150, 10);

const lines = [];
lines.push('# Analysis: all data.json — Jun 4, 2026 (Central)');
lines.push('');
lines.push(`Exported: ${formatCentral(raw.exportedAt)}`);
lines.push(`Total rows in DB: ${raw.rowCount}`);
lines.push(`Rows on calendar **Today** (${todayKey} Central): **${todayRows.length}**`);
lines.push(`Deduped unique saves today: **${analysis25.deduped.length}**`);
lines.push('');

lines.push('## Why badge shows 3');
lines.push('');
lines.push('Badge = count of **Visit** (`stay`) entries from trip detection.');
lines.push('');
for (const [label, radius] of [
  ['25 m radius (your setting)', 25],
  ['150 m radius', 150],
]) {
  const { events, deduped } =
    radius === 25 ? analysis25 : analysis150;
  const stays = events.filter((e) => e.kind === 'stay');
  lines.push(`### ${label}`);
  lines.push(`- Deduped saves: ${deduped.length}`);
  lines.push(`- **Visit count: ${stays.length}**`);
  stays.forEach((stay, idx) => {
    const p0 = stay.points[0];
    const p1 = stay.points[stay.points.length - 1];
    lines.push(
      `  ${idx + 1}. **Visit** ${formatCentral(p0.timestamp)} → ${formatCentral(p1.timestamp)} (${Math.round(stay.spanMs / 60000)} min span, ${stay.points.length} saves)`,
    );
    lines.push(
      `     anchor lat/lng: ${p0.lat.toFixed(5)}, ${p0.lng.toFixed(5)}`,
    );
  });
  const travels = events.filter((e) => e.kind === 'travel');
  if (travels.length) {
    lines.push(`- Trips dropped or shown: ${travels.length}`);
    travels.forEach((t, idx) => {
      if (t.points.length < 2) return;
      let dist = 0;
      for (let i = 1; i < t.points.length; i++) {
        dist += haversineM(t.points[i - 1], t.points[i]);
      }
      lines.push(
        `  - travel ${idx + 1}: ${t.points.length} saves, ~${dist.toFixed(0)} m`,
      );
    });
  }
  lines.push('');
}

lines.push('## Why UI says "Here from 10:20 PM"');
lines.push('');
const stays25 = analysis25.events.filter((e) => e.kind === 'stay');
const lastStay = stays25[stays25.length - 1];
if (lastStay) {
  const first = lastStay.points[0];
  lines.push(
    `With **25 m** settings, the **open visit** (last stay) starts at the **first save in that cluster**: **${formatCentral(first.timestamp)}** (id ${first.id}).`,
  );
  lines.push(
    'The card uses that save — **not** when you actually arrived home if earlier saves were split into another visit or not saved.',
  );
  lines.push('');
}

lines.push('## All deduped saves today (Central time)');
lines.push('');
lines.push('| # | Central time | id | source | dist from prev | dist from home |');
lines.push('| --- | --- | --- | --- | --- | --- |');
let prev = null;
analysis25.deduped.forEach((p, idx) => {
  const distPrev = prev ? haversineM(prev, p).toFixed(1) : '—';
  const distHome = haversineM(homeCluster, p).toFixed(1);
  lines.push(
    `| ${idx + 1} | ${formatCentral(p.timestamp)} | ${p.id} | ${p.source} | ${distPrev} m | ${distHome} m |`,
  );
  prev = p;
});

lines.push('');
lines.push('## First save near home cluster today');
lines.push('');
const nearHome = analysis25.deduped.filter(
  (p) => haversineM(homeCluster, p) <= 150,
);
if (nearHome.length) {
  lines.push(
    `First save within 150 m of home (~33.250, -97.153): **${formatCentral(nearHome[0].timestamp)}** (id ${nearHome[0].id})`,
  );
} else {
  lines.push('No saves within 150 m of home cluster today.');
}

lines.push('');
lines.push('## Jun 3 evening (might be "came home ~7 PM")');
lines.push('');
const jun3Rows = raw.rows.filter(
  (r) => dateKeyCentral(r.timestamp) === '2026-06-03',
);
const jun3NearHome = dedupe(jun3Rows).filter(
  (p) => haversineM(homeCluster, p) <= 150,
);
if (jun3NearHome.length) {
  const last = jun3NearHome[jun3NearHome.length - 1];
  const first = jun3NearHome[0];
  lines.push(
    `Jun 3 saves near home: ${jun3NearHome.length} deduped — first ${formatCentral(first.timestamp)}, last ${formatCentral(last.timestamp)}`,
  );
}

const out = join(root, 'all-data-report.md');
writeFileSync(out, lines.join('\n'));
console.log(lines.join('\n'));
console.log('\nWrote', out);
