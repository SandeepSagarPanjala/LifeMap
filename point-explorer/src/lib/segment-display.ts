import {formatDuration} from '@lifemap/segmentation';
import {
  formatDistance,
  type SegmentMomentCounts,
  type StaySegment,
  type TripSegment,
} from '@lifemap/segmentation';
import {canonicalizeStaySegmentPoints} from '@lifemap/segmentation';
import {canonicalizeTravelSegmentPoints} from '@lifemap/segmentation';
import type {SegmentationMoment} from '@lifemap/segmentation';
import type {DriveSegment} from '@lifemap/segmentation';

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
  subtitle?: string;
  placeLookupCacheId?: number;
  momentCounts?: SegmentMomentCounts;
  timeRange: string;
  stats: string[];
};

const MOMENT_TYPE_LABELS: Record<keyof SegmentMomentCounts, string> = {
  photo: 'photo',
  video: 'video',
  voice: 'voice',
  note: 'note',
  activity: 'activity',
};

function canonicalPointCountLabel(
  rawCount: number,
  plottedCount: number,
): string {
  if (plottedCount >= rawCount) {
    return `${rawCount} pts`;
  }
  return `${rawCount} pts → ${plottedCount} plotted`;
}

export function stayPointCountLabel(
  segment: StaySegment,
  canonicalizeStays: boolean,
  moments: readonly SegmentationMoment[] = [],
): string {
  const rawCount = segment.points.length;
  if (!canonicalizeStays) {
    return `${rawCount} pts`;
  }
  return canonicalPointCountLabel(
    rawCount,
    canonicalizeStaySegmentPoints(segment, moments).length,
  );
}

export function drivePointCountLabel(
  segment: DriveSegment,
  canonicalizeDrives: boolean,
): string {
  const rawCount = segment.points.length;
  if (!canonicalizeDrives) {
    return `${rawCount} pts`;
  }
  return canonicalPointCountLabel(
    rawCount,
    canonicalizeTravelSegmentPoints(segment).length,
  );
}

export function describeTripSegment(segment: TripSegment): SegmentDisplay {
  const timeRange = formatTimeRange(segment.startAt, segment.endAt);

  if (segment.kind === 'stay') {
    return {
      kind: 'Stay',
      variant: 'stay',
      subtitle: segment.savedPlaceLabel ?? segment.placeLookupLabel,
      placeLookupCacheId: segment.placeLookupCacheId,
      momentCounts: segment.momentCounts,
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
      momentCounts: segment.momentCounts,
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
    momentCounts: segment.momentCounts,
    timeRange,
    stats: [
      `${formatDuration(segment.durationMs)} lost`,
      formatDistance(segment.distanceM),
      'no GPS',
    ],
  };
}

export function formatMomentCountChips(counts: SegmentMomentCounts): string[] {
  return (Object.keys(MOMENT_TYPE_LABELS) as Array<keyof SegmentMomentCounts>)
    .filter(key => counts[key] > 0)
    .map(
      key =>
        `${counts[key]} ${MOMENT_TYPE_LABELS[key]}${counts[key] === 1 ? '' : 's'}`,
    );
}
