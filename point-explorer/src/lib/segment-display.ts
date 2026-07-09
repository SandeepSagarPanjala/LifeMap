import { formatDuration } from '@lifemap/segmentation';
import {
  formatDistance,
  type SegmentMomentCounts,
  type StaySegment,
  type TripSegment,
} from '@lifemap/segmentation';
import { canonicalizeStaySegmentPoints } from '@lifemap/segmentation';
import { canonicalizeTravelSegmentPoints } from '@lifemap/segmentation';
import type { SegmentationMoment } from '@lifemap/segmentation';
import type { DriveSegment } from '@lifemap/segmentation';
import { APP_TIMEZONE } from '@lifemap/constants';
import { APP_COPY } from '@lifemap/copy';

const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dateFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
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
  kind:
    | typeof APP_COPY.explorer.segmentStay
    | typeof APP_COPY.explorer.segmentDrive
    | typeof APP_COPY.explorer.segmentMissing;
  variant: 'stay' | 'drive' | 'missing';
  subtitle?: string;
  placeId?: number;
  placeKind?: 'saved' | 'cache';
  momentCounts?: SegmentMomentCounts;
  timeRange: string;
  stats: string[];
};

const MOMENT_TYPE_LABELS: Record<keyof SegmentMomentCounts, string> = {
  photo: APP_COPY.explorer.momentPhoto,
  video: APP_COPY.explorer.momentVideo,
  voice: APP_COPY.explorer.momentVoice,
  note: APP_COPY.explorer.momentNote,
  activity: APP_COPY.explorer.momentActivity,
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
      kind: APP_COPY.explorer.segmentStay,
      variant: 'stay',
      subtitle: segment.placeLabel,
      placeId: segment.placeId,
      placeKind: segment.placeKind,
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
    const from = segment.fromPlaceLabel;
    const to = segment.toPlaceLabel;
    if (from && to) {
      subtitle = `${from} → ${to}`;
    } else if (from) {
      subtitle = `${from} →`;
    } else if (to) {
      subtitle = `→ ${to}`;
    }

    return {
      kind: APP_COPY.explorer.segmentDrive,
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
    kind: APP_COPY.explorer.segmentMissing,
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
        `${counts[key]} ${MOMENT_TYPE_LABELS[key]}${
          counts[key] === 1 ? '' : 's'
        }`,
    );
}
