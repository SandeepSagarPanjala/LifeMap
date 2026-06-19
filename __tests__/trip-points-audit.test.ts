import fs from 'node:fs';
import path from 'node:path';

import type {LocationPointRow} from '@/db/repositories/location-days';
import type {MomentRow} from '@/db/repositories/moments';
import {mapExportMoment, mapExportSavedPlace} from './helpers/fixtures';
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

const DEVICE_TRIP_POINTS = 32_906;
const DEVICE_LOCATION_POINTS = 69_700;
const DEVICE_TRIPS = 145;
const DEVICE_MATERIALIZED_DAYS = 18;

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
    savedPlaces: raw.tables.saved_places.map(mapExportSavedPlace),
    moments: raw.tables.moments.map(mapExportMoment),
  };
}

function shiftDateKey(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + delta));
  return date.toISOString().slice(0, 10);
}

function geometryForPersist(
  entry: DetectedTrip,
  savedPlaces: SavedPlaceRow[],
  moments: MomentRow[],
  canonicalizeStays: boolean,
): LocationPointRow[] {
  if (entry.kind === 'travel') {
    return entry.points.length > 0 ? entry.points : [];
  }
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
  if (canonicalizeStays) {
    return canonicalizeStayGeometry(entry, centroid, moments);
  }
  return entry.points;
}

describe('trip_points audit from all data.json', () => {
  it('reports expected trip_points vs device DB', () => {
    const {points, savedPlaces, moments} = loadExport();
    const config = getDefaultTripDetectionConfig();
    const dateKeys = [...new Set(points.map(p => toDateKey(p.timestamp)))].sort();

    let tripsCanonical = 0;
    let tripsRaw = 0;
    let stayPointsCanonical = 0;
    let stayPointsRaw = 0;
    let travelPointsCanonical = 0;
    let tripCount = 0;
    let stayCount = 0;
    let travelCount = 0;
    let gapCount = 0;

    const heavyStays: Array<{
      dateKey: string;
      label: string | null;
      raw: number;
      canonical: number;
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

      for (const entry of entries.filter(isPersistableTimelineEntry)) {
        if (entry.kind === 'gap') {
          gapCount += 1;
          continue;
        }
        tripCount += 1;
        const raw = entry.points.length;
        const canonical = geometryForPersist(
          entry,
          savedPlaces,
          moments,
          true,
        ).length;

        tripsRaw += raw;
        tripsCanonical += canonical;

        if (entry.kind === 'stay') {
          stayCount += 1;
          stayPointsRaw += raw;
          stayPointsCanonical += canonical;
          if (raw > 50) {
            heavyStays.push({
              dateKey,
              label: entry.savedPlaceLabel ?? null,
              raw,
              canonical,
            });
          }
        } else {
          travelCount += 1;
          travelPointsCanonical += raw;
        }
      }
    }

    heavyStays.sort((a, b) => b.raw - a.raw);

    const report = {
      exportLocationPoints: points.length,
      deviceLocationPoints: DEVICE_LOCATION_POINTS,
      dateKeysWithGps: dateKeys.length,
      deviceMaterializedDays: DEVICE_MATERIALIZED_DAYS,
      tripsDetected: tripCount,
      deviceTrips: DEVICE_TRIPS,
      stays: stayCount,
      travels: travelCount,
      gaps: gapCount,
      tripPointsFromExport: {
        withCanonicalStayGeometry: tripsCanonical,
        withoutStayGeometry: tripsRaw,
        stayOnlyCanonical: stayPointsCanonical,
        stayOnlyRaw: stayPointsRaw,
        travelOnly: travelPointsCanonical,
        stayShareCanonicalPct: Number(
          ((stayPointsCanonical / tripsCanonical) * 100).toFixed(2),
        ),
        travelShareCanonicalPct: Number(
          ((travelPointsCanonical / tripsCanonical) * 100).toFixed(2),
        ),
        stayReductionPct: Number(
          (
            ((stayPointsRaw - stayPointsCanonical) / stayPointsRaw) *
            100
          ).toFixed(1),
        ),
        overallReductionFromCanonicalPct: Number(
          (
            ((tripsRaw - tripsCanonical) / tripsRaw) *
            100
          ).toFixed(1),
        ),
      },
      deviceTripPoints: DEVICE_TRIP_POINTS,
      deltaDeviceVsExportCanonical: DEVICE_TRIP_POINTS - tripsCanonical,
      deltaDeviceVsExportRaw: DEVICE_TRIP_POINTS - tripsRaw,
      deviceLooksLike: (() => {
        const nearCanonical =
          Math.abs(DEVICE_TRIP_POINTS - tripsCanonical) / tripsCanonical < 0.05;
        const nearRaw =
          Math.abs(DEVICE_TRIP_POINTS - tripsRaw) / tripsRaw < 0.05;
        if (nearCanonical && !nearRaw) {
          return 'canonical_stay_geometry';
        }
        if (nearRaw && !nearCanonical) {
          return 'pre_geometry_full_stay_points';
        }
        if (nearCanonical && nearRaw) {
          return 'ambiguous';
        }
        return 'partial_or_different_data';
      })(),
      avgPointsPerTravel: travelCount
        ? Number((travelPointsCanonical / travelCount).toFixed(1))
        : 0,
      avgPointsPerStayCanonical: stayCount
        ? Number((stayPointsCanonical / stayCount).toFixed(1))
        : 0,
      avgPointsPerStayRaw: stayCount
        ? Number((stayPointsRaw / stayCount).toFixed(1))
        : 0,
      topHeavyStays: heavyStays.slice(0, 8),
    };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));

    expect(tripCount).toBeGreaterThan(0);
    expect(tripsCanonical).toBeLessThan(tripsRaw);
  });
});
