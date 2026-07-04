import {formatDuration} from '@/lib/segmentation/stops';
import {
  formatDistance,
  type TripSegment,
} from '@/lib/segmentation/trips';

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dateFmt = new Intl.DateTimeFormat(undefined, {
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
  timeRange: string;
  stats: string[];
};

export function describeTripSegment(segment: TripSegment): SegmentDisplay {
  const timeRange = formatTimeRange(segment.startAt, segment.endAt);

  if (segment.kind === 'stay') {
    return {
      kind: 'Stay',
      variant: 'stay',
      subtitle: segment.placeLabel,
      timeRange,
      stats: [formatDuration(segment.durationMs), `${segment.points.length} pts`],
    };
  }

  if (segment.kind === 'drive') {
    let subtitle: string | undefined;
    const from = segment.fromPlaceLabel;
    const to = segment.toPlaceLabel;
    if (from && to) {
      subtitle = from === to ? from : `${from} → ${to}`;
    } else if (from) {
      subtitle = from;
    } else if (to) {
      subtitle = to;
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
    timeRange,
    stats: [
      formatDuration(segment.durationMs),
      formatDistance(segment.distanceM),
    ],
  };
}
