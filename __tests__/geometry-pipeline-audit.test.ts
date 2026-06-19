import fs from 'node:fs';
import path from 'node:path';

import type {LocationPointRow} from '@/db/repositories/location-days';
import type {MomentRow} from '@/db/repositories/moments';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {toDateKey} from '@/lib/day-utils';
import {buildExplorerDayTimeline} from '@/lib/explorer-day-trips';
import {canonicalizeStayGeometry} from '@/lib/stay-geometry';
import type {DetectedTrip} from '@/lib/trip-detection';
import {resolveVisitAnchor} from '@/lib/visit-anchor';
import {
  getDefaultTripDetectionConfig,
  isPersistableTimelineEntry,
} from '@/lib/trip-materialization';
import {canonicalizeTravelGeometry} from '@/lib/travel-geometry';

function loadExport(): {
  points: LocationPointRow[];
  savedPlaces: SavedPlaceRow[];
  moments: MomentRow[];
} {
  const file = path.join(__dirname, '..', 'all data.json');
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
      moments: Array<{
        id: number;
        timestamp: string;
        lat: number | null;
        lng: number | null;
        kind: string;
      }>;
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
    moments: raw.tables.moments.map(row => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      lat: row.lat,
      lng: row.lng,
      kind: row.kind as MomentRow['kind'],
      filePath: null,
      noteText: null,
      durationMs: null,
      savedPlaceId: null,
      tripId: null,
    })),
  };
}

function shiftDateKey(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + delta));
  return date.toISOString().slice(0, 10);
}

function pctReduced(before: number, after: number): number {
  if (before === 0) {
    return 0;
  }
  return Number((((before - after) / before) * 100).toFixed(1));
}

function stayCanonical(
  entry: DetectedTrip,
  savedPlaces: SavedPlaceRow[],
  moments: MomentRow[],
): LocationPointRow[] {
  const centroid = resolveVisitAnchor(entry.points, savedPlaces);
  if (entry.points.length === 0) {
    return [
      {
        id: -1,
        timestamp: entry.startAt,
        lat: centroid.lat,
        lng: centroid.lng,
        accuracy: null,
        altitude: null,
        speed: null,
        source: 'anchor',
      },
    ];
  }
  return canonicalizeStayGeometry(entry, centroid, moments);
}

function travelCanonical(entry: DetectedTrip): LocationPointRow[] {
  if (entry.points.length === 0) {
    return [];
  }
  return canonicalizeTravelGeometry(entry.points);
}

type StageTotals = {
  stayPoints: number;
  travelPoints: number;
  total: number;
};

function addStage(
  entry: DetectedTrip,
  savedPlaces: SavedPlaceRow[],
  moments: MomentRow[],
  stage: 'detection' | 'stayOnly' | 'full',
  totals: StageTotals,
): void {
  let geometry: LocationPointRow[];
  if (stage === 'detection') {
    geometry = entry.points;
  } else if (entry.kind === 'stay') {
    geometry = stayCanonical(entry, savedPlaces, moments);
  } else if (stage === 'stayOnly') {
    geometry = entry.points;
  } else {
    geometry = travelCanonical(entry);
  }

  if (entry.kind === 'stay') {
    totals.stayPoints += geometry.length;
  } else {
    totals.travelPoints += geometry.length;
  }
  totals.total += geometry.length;
}

describe('geometry pipeline audit on all data.json', () => {
  it('reports reduction across detection, stay-geometry, and travel-geometry', () => {
    const {points, savedPlaces, moments} = loadExport();
    const config = getDefaultTripDetectionConfig();
    const dateKeys = [...new Set(points.map(p => toDateKey(p.timestamp)))].sort();

    const detection: StageTotals = {stayPoints: 0, travelPoints: 0, total: 0};
    const stayOnly: StageTotals = {stayPoints: 0, travelPoints: 0, total: 0};
    const full: StageTotals = {stayPoints: 0, travelPoints: 0, total: 0};

    let stayCount = 0;
    let travelCount = 0;

    const heavyDrives: Array<{
      dateKey: string;
      raw: number;
      canonical: number;
      distanceKm: number;
    }> = [];

    const perDay: Array<{
      dateKey: string;
      detection: number;
      stayOnly: number;
      full: number;
    }> = [];

    for (const dateKey of dateKeys) {
      const windowKeys = new Set([
        shiftDateKey(dateKey, -1),
        dateKey,
        shiftDateKey(dateKey, 1),
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

      const dayDetection = {stayPoints: 0, travelPoints: 0, total: 0};
      const dayStayOnly = {stayPoints: 0, travelPoints: 0, total: 0};
      const dayFull = {stayPoints: 0, travelPoints: 0, total: 0};

      for (const entry of entries.filter(isPersistableTimelineEntry)) {
        if (entry.kind === 'gap') {
          continue;
        }
        if (entry.kind === 'stay') {
          stayCount += 1;
        } else {
          travelCount += 1;
          const canonicalLen = travelCanonical(entry).length;
          if (entry.points.length > 30) {
            heavyDrives.push({
              dateKey,
              raw: entry.points.length,
              canonical: canonicalLen,
              distanceKm: Number(entry.distanceKm.toFixed(2)),
            });
          }
        }

        addStage(entry, savedPlaces, moments, 'detection', detection);
        addStage(entry, savedPlaces, moments, 'stayOnly', stayOnly);
        addStage(entry, savedPlaces, moments, 'full', full);

        addStage(entry, savedPlaces, moments, 'detection', dayDetection);
        addStage(entry, savedPlaces, moments, 'stayOnly', dayStayOnly);
        addStage(entry, savedPlaces, moments, 'full', dayFull);
      }

      if (dayDetection.total > 0) {
        perDay.push({
          dateKey,
          detection: dayDetection.total,
          stayOnly: dayStayOnly.total,
          full: dayFull.total,
        });
      }
    }

    heavyDrives.sort((a, b) => b.raw - a.raw);

    const gpsInExport = points.length;
    const gpsAssignedToSegments = detection.total;
    const gpsNotInAnySegment = gpsInExport - gpsAssignedToSegments;

    const report = {
      source: 'all data.json',
      gpsDays: dateKeys.length,
      segments: {stays: stayCount, travels: travelCount},
      pipeline: {
        stage0_allGpsInExport: gpsInExport,
        stage1_afterDetection: {
          description: 'Sum of points on all stay + travel segments (1st algorithm)',
          stayPoints: detection.stayPoints,
          travelPoints: detection.travelPoints,
          totalTripGeometryPoints: detection.total,
          pctOfAllGps: Number(
            ((detection.total / gpsInExport) * 100).toFixed(1),
          ),
          gpsNotAssignedToSegments: gpsNotInAnySegment,
        },
        stage2_stayGeometryOnly: {
          description: 'Stays canonicalized; drives still full GPS',
          stayPoints: stayOnly.stayPoints,
          travelPoints: stayOnly.travelPoints,
          total: stayOnly.total,
          reducedFromStage1: detection.total - stayOnly.total,
          reductionPct: pctReduced(detection.total, stayOnly.total),
          stayReductionPct: pctReduced(
            detection.stayPoints,
            stayOnly.stayPoints,
          ),
        },
        stage3_stayPlusTravelGeometry: {
          description: 'Stays + drives both canonicalized (target persist shape)',
          stayPoints: full.stayPoints,
          travelPoints: full.travelPoints,
          total: full.total,
          reducedFromStage1: detection.total - full.total,
          reductionPct: pctReduced(detection.total, full.total),
          travelReductionPct: pctReduced(
            detection.travelPoints,
            full.travelPoints,
          ),
          stayReductionPct: pctReduced(detection.stayPoints, full.stayPoints),
        },
      },
      summary: {
        detectionToFull: `${detection.total.toLocaleString()} → ${full.total.toLocaleString()} (${pctReduced(detection.total, full.total)}% fewer)`,
        stayOnly: `${detection.stayPoints.toLocaleString()} → ${full.stayPoints.toLocaleString()} (${pctReduced(detection.stayPoints, full.stayPoints)}%)`,
        travelOnly: `${detection.travelPoints.toLocaleString()} → ${full.travelPoints.toLocaleString()} (${pctReduced(detection.travelPoints, full.travelPoints)}%)`,
        avgPointsPerStay: {
          detection: Number((detection.stayPoints / stayCount).toFixed(1)),
          full: Number((full.stayPoints / stayCount).toFixed(1)),
        },
        avgPointsPerDrive: {
          detection: Number((detection.travelPoints / travelCount).toFixed(1)),
          full: Number((full.travelPoints / travelCount).toFixed(1)),
        },
      },
      perDay: perDay.map(day => ({
        ...day,
        stayOnlyReductionPct: pctReduced(day.detection, day.stayOnly),
        fullReductionPct: pctReduced(day.detection, day.full),
      })),
      topDriveReductions: heavyDrives.slice(0, 10).map(d => ({
        ...d,
        reductionPct: pctReduced(d.raw, d.canonical),
      })),
    };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));

    expect(detection.total).toBeGreaterThan(full.total);
    expect(full.stayPoints).toBeLessThan(detection.stayPoints);
    expect(full.travelPoints).toBeLessThan(detection.travelPoints);
  });
});
