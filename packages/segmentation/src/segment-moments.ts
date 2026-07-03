import type {TripSegment} from './trips';
import type {SegmentationMoment, SegmentationMomentType} from './types';

export type SegmentMomentCounts = {
  photo: number;
  video: number;
  voice: number;
  note: number;
  activity: number;
};

export function emptySegmentMomentCounts(): SegmentMomentCounts {
  return {photo: 0, video: 0, voice: 0, note: 0, activity: 0};
}

export function hasSegmentMomentCounts(counts: SegmentMomentCounts): boolean {
  return (
    counts.photo > 0 ||
    counts.video > 0 ||
    counts.voice > 0 ||
    counts.note > 0 ||
    counts.activity > 0
  );
}

function bumpCount(
  counts: SegmentMomentCounts,
  type: SegmentationMomentType | undefined,
): void {
  if (type === 'photo') {
    counts.photo += 1;
  } else if (type === 'video') {
    counts.video += 1;
  } else if (type === 'voice') {
    counts.voice += 1;
  } else if (type === 'note') {
    counts.note += 1;
  } else if (type === 'activity') {
    counts.activity += 1;
  }
}

function countMomentsForSegment(
  segment: TripSegment,
  moments: readonly SegmentationMoment[],
): SegmentMomentCounts {
  const counts = emptySegmentMomentCounts();
  const startMs = segment.startAt.getTime();
  const endMs = segment.endAt.getTime();
  for (const moment of moments) {
    const timestampMs = new Date(moment.timestamp).getTime();
    if (timestampMs < startMs || timestampMs > endMs) {
      continue;
    }
    bumpCount(counts, moment.type);
  }
  return counts;
}

export function annotateSegmentMoments(
  segments: TripSegment[],
  moments: readonly SegmentationMoment[],
): TripSegment[] {
  if (moments.length === 0) {
    return segments;
  }
  return segments.map(segment => {
    const momentCounts = countMomentsForSegment(segment, moments);
    if (!hasSegmentMomentCounts(momentCounts)) {
      return segment;
    }
    return {...segment, momentCounts};
  });
}
