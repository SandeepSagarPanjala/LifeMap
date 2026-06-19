import {formatDuration} from './stops';
import {formatDistance, type StaySegment, type TripSegment} from './trips';
import {canonicalizeStaySegmentPoints} from './stay-geometry';
import type {MomentRow} from '../types';

const TZ = 'America/Chicago';

const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dateFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  month: 'short',
  day: 'numeric',
});

export function formatTimeRange(startAt: Date, endAt: Date): string {
  const startDate = dateFmt.format(startAt);
  const endDate = dateFmt.format(endAt);
  const startTime = timeFmt.format(startAt);
  const endTime = timeFmt.format(endAt);
  if (startDate === endDate) {
    return `${startDate} · ${startTime} – ${endTime}`;
  }
  return `${startDate} ${startTime} → ${endDate} ${endTime}`;
}

export type SegmentDisplay = {
  kind: 'Stay' | 'Drive' | 'Missing';
  variant: 'stay' | 'drive' | 'missing';
  /** Place name or route, e.g. "Home" or "Home → Work". */
  subtitle?: string;
  timeRange: string;
  stats: string[];
};

export function stayPointCountLabel(
  segment: StaySegment,
  canonicalizeStays: boolean,
  moments: readonly MomentRow[] = [],
): string {
  const rawCount = segment.points.length;
  if (!canonicalizeStays) {
    return `${rawCount} pts`;
  }
  const plottedCount = canonicalizeStaySegmentPoints(segment, moments).length;
  if (plottedCount >= rawCount) {
    return `${rawCount} pts`;
  }
  return `${rawCount} pts → ${plottedCount} plotted`;
}

export function describeTripSegment(segment: TripSegment): SegmentDisplay {
  const timeRange = formatTimeRange(segment.startAt, segment.endAt);

  if (segment.kind === 'stay') {
    return {
      kind: 'Stay',
      variant: 'stay',
      subtitle: segment.savedPlaceLabel,
      timeRange,
      stats: [
        formatDuration(segment.durationMs),
        `${segment.points.length} pts`,
      ],
    };
  }

  if (segment.kind === 'drive') {
    let subtitle: string | undefined;
    const from = segment.fromSavedPlaceLabel;
    const to = segment.toSavedPlaceLabel;
    if (from && to) {
      subtitle = `${from} → ${to}`;
    } else if (from) {
      subtitle = `${from} →`;
    } else if (to) {
      subtitle = `→ ${to}`;
    }

    return {
      kind: 'Drive',
      variant: 'drive',
      subtitle,
      timeRange,
      stats: [
        formatDuration(segment.durationMs),
        formatDistance(segment.distanceM),
        `${segment.points.length} pts`,
      ],
    };
  }

  return {
    kind: 'Missing',
    variant: 'missing',
    subtitle: `${segment.fromKind} → ${segment.toKind}`,
    timeRange,
    stats: [
      `${formatDuration(segment.durationMs)} lost`,
      formatDistance(segment.distanceM),
      'no GPS',
    ],
  };
}
