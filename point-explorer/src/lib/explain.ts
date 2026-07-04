import {APP_COPY} from '@lifemap/copy';
import {formatTimestamp} from './export';
import {
  DEFAULT_STOP_CONFIG,
  formatDuration,
  isMovingPoint,
  type StopDetectionConfig,
} from '@lifemap/segmentation';
import {matchSavedPlaceForPoint} from '@lifemap/segmentation';
import {
  formatDistance,
  MERGE_STAY_MAX_DISTANCE_M,
  MIN_DRIVE_DISTANCE_M,
  MISSING_MIN_DISTANCE_M,
  MISSING_MIN_GAP_MS,
  SAVED_PLACE_MIN_DWELL_MS,
  type TripSegment,
} from '@lifemap/segmentation';
import type {ParsedPoint, SavedPlaceRow} from '../types';

export type SegmentExplanation = {
  kind: 'stay' | 'drive' | 'missing';
  title: string;
  reasons: string[];
  notes: string[];
};

export type PointExplanation = {
  assignment: 'stay' | 'drive' | 'missing' | 'unassigned';
  segmentOrder: number | null;
  segmentLabel: string | null;
  reasons: string[];
  hints: string[];
};

const EARTH_RADIUS_M = 6_371_000;

function haversineM(
  a: {lat: number; lng: number},
  b: {lat: number; lng: number},
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function speedMph(speed: number | null): string {
  if (speed == null) {
    return 'unknown';
  }
  return `${(speed * 2.237).toFixed(1)} mph`;
}

export function findSegmentForPoint(
  pointId: number,
  segments: TripSegment[],
): TripSegment | null {
  for (const segment of segments) {
    if (segment.kind === 'missing') {
      continue;
    }
    if (segment.points.some(p => p.id === pointId)) {
      return segment;
    }
  }
  return null;
}

export function explainSegment(
  segment: TripSegment,
  _savedPlaces: SavedPlaceRow[] = [],
  config: StopDetectionConfig = DEFAULT_STOP_CONFIG,
): SegmentExplanation {
  if (segment.kind === 'missing') {
    return {
      kind: 'missing',
      title: 'Missing GPS gap',
      reasons: [
        `No GPS fixes recorded between ${formatTimestamp(segment.startAt.toISOString())} and ${formatTimestamp(segment.endAt.toISOString())}.`,
        `Straight-line gap is ${formatDistance(segment.distanceM)} over ${formatDuration(segment.durationMs)}.`,
        `Inserted because distance ≥ ${MISSING_MIN_DISTANCE_M} m and time ≥ ${Math.round(MISSING_MIN_GAP_MS / 60000)} min.`,
      ],
      notes: [
        `Connects a ${segment.fromKind} segment to a ${segment.toKind} segment with no track in between.`,
      ],
    };
  }

  if (segment.kind === 'stay') {
    const reasons: string[] = [];
    const notes: string[] = [];
    const movingCount = segment.points.filter(p =>
      isMovingPoint(p, config),
    ).length;
    const spreadM = Math.round(segment.stop.spreadM);

    if (segment.stop.inferred) {
      reasons.push(
        'Inferred stay from sparse GPS: long time gap with small displacement between fixes.',
      );
      reasons.push(
        `Gap ≥ ${Math.round(config.minDwellMs / 60000)} min and end displacement ≤ ${config.radiusM} m.`,
      );
    } else if (
      segment.savedPlaceLabel != null &&
      segment.durationMs >= SAVED_PLACE_MIN_DWELL_MS &&
      segment.durationMs < config.minDwellMs
    ) {
      reasons.push(
        `Saved place rule: inside “${segment.savedPlaceLabel}” for at least ${Math.round(SAVED_PLACE_MIN_DWELL_MS / 60000)} min.`,
      );
    } else {
      reasons.push(
        `Stationary cluster within ${config.radiusM} m for at least ${Math.round(config.minDwellMs / 60000)} min.`,
      );
      reasons.push(
        `Spread of member points is ${spreadM} m (limit ${config.radiusM} m).`,
      );
    }

    if (segment.savedPlaceLabel) {
      reasons.push(`Matched saved place: ${segment.savedPlaceLabel}.`);
    }

    reasons.push(
      `${segment.points.length} GPS points, ${formatDuration(segment.durationMs)} dwell.`,
    );

    if (movingCount > 0) {
      notes.push(
        `${movingCount} point(s) in this stay slice still report speed ≥ ${config.movingSpeedMps} m/s — usually GPS noise while parked.`,
      );
    }

    if (segment.id.includes('merged')) {
      notes.push(
        `Merged with an adjacent stay at the same place (within ${MERGE_STAY_MAX_DISTANCE_M} m).`,
      );
    }

    if (segment.id.includes('clipped')) {
      notes.push('Home stay clipped at midnight (day-boundary rule).');
    }

    return {
      kind: 'stay',
      title: segment.savedPlaceLabel
        ? `${APP_COPY.explorer.segmentStay} · ${segment.savedPlaceLabel}`
        : APP_COPY.explorer.segmentStay,
      reasons,
      notes,
    };
  }

  const displacementM = haversineM(
    segment.points[0]!,
    segment.points[segment.points.length - 1]!,
  );
  const movingCount = segment.points.filter(p =>
    isMovingPoint(p, config),
  ).length;
  const route = [segment.fromSavedPlaceLabel, segment.toSavedPlaceLabel]
    .filter(Boolean)
    .join(' → ');

  const reasons = [
    `Points between two stays (or trip start/end) from ${formatTimestamp(segment.startAt.toISOString())} to ${formatTimestamp(segment.endAt.toISOString())}.`,
    `Start→end displacement ${formatDistance(displacementM)} (needs ≥ ${config.radiusM} m).`,
    movingCount > 0
      ? `${movingCount} moving point(s) at ≥ ${config.movingSpeedMps} m/s.`
      : `Path length ${formatDistance(segment.distanceM)} (needs ≥ ${MIN_DRIVE_DISTANCE_M} m without moving points).`,
    `${segment.points.length} points · ${formatDistance(segment.distanceM)} path · ${formatDuration(segment.durationMs)}.`,
  ];

  const notes: string[] = [];
  if (route) {
    notes.push(`Route labels: ${route}.`);
  }
  if (displacementM < segment.distanceM * 0.5) {
    notes.push(
      'Path is much longer than displacement — likely a real drive, not jitter at one spot.',
    );
  }

  return {
    kind: 'drive',
    title: route
      ? `${APP_COPY.explorer.segmentDrive} · ${route}`
      : APP_COPY.explorer.segmentDrive,
    reasons,
    notes,
  };
}

export function explainPoint(
  point: ParsedPoint,
  segments: TripSegment[],
  savedPlaces: SavedPlaceRow[] = [],
  config: StopDetectionConfig = DEFAULT_STOP_CONFIG,
): PointExplanation {
  const segment = findSegmentForPoint(point.id, segments);
  const moving = isMovingPoint(point, config);
  const savedPlace = matchSavedPlaceForPoint(point, savedPlaces);
  const hints: string[] = [];

  if (point.accuracy != null && point.accuracy > config.maxAccuracyM) {
    return {
      assignment: 'unassigned',
      segmentOrder: null,
      segmentLabel: null,
      reasons: [
        `Point accuracy ${point.accuracy.toFixed(0)} m exceeds limit of ${config.maxAccuracyM} m.`,
        'Dropped before trip detection runs.',
      ],
      hints: ['This point never enters the merged trip track.'],
    };
  }

  if (segment == null) {
    const reasons = [
      'Not part of any stay or drive segment for this day view.',
    ];
    if (moving) {
      reasons.push(
        `Speed ${speedMph(point.speed)} (≥ ${config.movingSpeedMps} m/s) — treated as driving, so it cannot belong to a stay cluster.`,
      );
      hints.push(
        'May fall in a gap between detected stops, or in a slice that failed the drive displacement gate.',
      );
    } else if (savedPlace) {
      reasons.push(
        `Inside saved place “${savedPlace.label}” but not in a qualifying stay run.`,
      );
      hints.push(
        `Needs ≥ ${Math.round(config.minDwellMs / 60000)} min stationary cluster, or ≥ ${Math.round(SAVED_PLACE_MIN_DWELL_MS / 60000)} min saved-place dwell.`,
      );
    } else {
      reasons.push('May be a short dwell absorbed into a surrounding drive.');
      hints.push(
        `Stays need ≥ ${Math.round(config.minDwellMs / 60000)} min within ${config.radiusM} m without moving points.`,
      );
    }
    return {
      assignment: 'unassigned',
      segmentOrder: null,
      segmentLabel: null,
      reasons,
      hints,
    };
  }

  if (segment.kind === 'stay') {
    const dist = haversineM(segment.stop, point);
    const reasons = [
      `Member of stay segment #${segment.order}.`,
      moving
        ? `Speed ${speedMph(point.speed)} — marked moving, but kept in this stay slice.`
        : `Speed ${speedMph(point.speed)} — stationary (≤ ${config.movingSpeedMps} m/s), counts toward stay.`,
      `${Math.round(dist)} m from stay centre (spread limit ${config.radiusM} m).`,
    ];
    if (segment.stop.inferred) {
      reasons.push('Stay was inferred from a sparse GPS gap, not continuous fixes.');
    }
    if (segment.savedPlaceLabel) {
      reasons.push(`Stay matched saved place: ${segment.savedPlaceLabel}.`);
    } else if (savedPlace) {
      hints.push(
        `Point is inside “${savedPlace.label}” geofence but this stay was not labeled — centroid may be outside radius.`,
      );
    }
    return {
      assignment: 'stay',
      segmentOrder: segment.order,
      segmentLabel: segment.savedPlaceLabel ?? APP_COPY.explorer.segmentStay,
      reasons,
      hints,
    };
  }

  if (segment.kind === 'drive') {
    const reasons = [
      `Member of drive segment #${segment.order}.`,
      moving
        ? `Speed ${speedMph(point.speed)} — moving (≥ ${config.movingSpeedMps} m/s), supports drive classification.`
        : `Speed ${speedMph(point.speed)} — stationary fix on the drive path (common at lights or GPS lag).`,
      `Drive connects ${segment.fromSavedPlaceLabel ?? 'unknown'} → ${segment.toSavedPlaceLabel ?? 'unknown'}.`,
    ];

    if (savedPlace) {
      hints.push(
        `GPS places you inside “${savedPlace.label}” while the segment is still a drive — likely arriving, leaving, or jitter near the edge.`,
      );
    }

    return {
      assignment: 'drive',
      segmentOrder: segment.order,
      segmentLabel: [segment.fromSavedPlaceLabel, segment.toSavedPlaceLabel]
        .filter(Boolean)
        .join(' → ') || APP_COPY.explorer.segmentDrive,
      reasons,
      hints,
    };
  }

  return {
    assignment: 'unassigned',
    segmentOrder: segment.order,
    segmentLabel: 'Unknown segment',
    reasons: ['Point is in an unrecognized segment kind.'],
    hints: [],
  };
}
