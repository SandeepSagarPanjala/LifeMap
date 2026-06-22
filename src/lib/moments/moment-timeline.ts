import type {LocationPointRow} from '@/db/repositories/location-days';
import type {DayTimelineEntry} from '@/lib/trip-detection';
import {stayTripCentroid} from '@/lib/trip-detection';

export type MomentTimelineMoment = {
  id: number;
  type: 'photo' | 'note' | 'video' | 'voice';
  timestamp: Date;
  finishedAt?: Date | null;
};

export type MomentTimelineAttachment = {
  moment: MomentTimelineMoment;
  entry: DayTimelineEntry | null;
};

const sortedPointsByTrail = new WeakMap<
  readonly LocationPointRow[],
  ReadonlyArray<LocationPointRow>
>();

/** Sort once per GPS trail reference — resolveMomentCoordinate reuses this cache. */
export function getSortedLocationPointsByTime(
  points: readonly LocationPointRow[],
): ReadonlyArray<LocationPointRow> {
  const cached = sortedPointsByTrail.get(points);
  if (cached) {
    return cached;
  }
  const sorted = [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  sortedPointsByTrail.set(points, sorted);
  return sorted;
}

export function effectiveTimelineEntryEnd(
  entry: DayTimelineEntry,
  now: Date,
): Date {
  return entry.kind === 'stay' && entry.openThroughNow ? now : entry.endAt;
}

export function findContainingTimelineEntry(
  momentTimestamp: Date,
  entries: DayTimelineEntry[],
  now: Date,
): DayTimelineEntry | null {
  const timestampMs = momentTimestamp.getTime();

  const stayMatch = entries.find(entry => {
    if (entry.kind !== 'stay') {
      return false;
    }
    return (
      timestampMs >= entry.startAt.getTime() &&
      timestampMs <= effectiveTimelineEntryEnd(entry, now).getTime()
    );
  });
  if (stayMatch) {
    return stayMatch;
  }

  return (
    entries.find(entry => {
      return (
        timestampMs >= entry.startAt.getTime() &&
        timestampMs <= effectiveTimelineEntryEnd(entry, now).getTime()
      );
    }) ?? null
  );
}

export function attachMomentsToTimeline(
  moments: MomentTimelineMoment[],
  entries: DayTimelineEntry[],
  now: Date,
): MomentTimelineAttachment[] {
  return [...moments]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .map(moment => ({
      moment,
      entry: findContainingTimelineEntry(moment.timestamp, entries, now),
    }));
}

function findSegmentStartIndex(
  sorted: ReadonlyArray<LocationPointRow>,
  timestampMs: number,
): number {
  const lastIndex = sorted.length - 1;
  const firstMs = sorted[0]!.timestamp.getTime();
  const lastMs = sorted[lastIndex]!.timestamp.getTime();

  if (timestampMs <= firstMs) {
    return 0;
  }
  if (timestampMs >= lastMs) {
    return Math.max(0, lastIndex - 1);
  }

  let lo = 0;
  let hi = lastIndex - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (sorted[mid]!.timestamp.getTime() <= timestampMs) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

function resolveFromSortedPoints(
  momentTimestamp: Date,
  sorted: ReadonlyArray<LocationPointRow>,
  containingEntry: DayTimelineEntry | null,
): {lat: number; lng: number} | null {
  const timestampMs = momentTimestamp.getTime();
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  if (timestampMs <= first.timestamp.getTime()) {
    return {lat: first.lat, lng: first.lng};
  }
  if (timestampMs >= last.timestamp.getTime()) {
    return {lat: last.lat, lng: last.lng};
  }

  const index = findSegmentStartIndex(sorted, timestampMs);
  const start = sorted[index]!;
  const end = sorted[index + 1]!;
  const startMs = start.timestamp.getTime();
  const endMs = end.timestamp.getTime();

  if (timestampMs < startMs || timestampMs > endMs) {
    if (containingEntry?.kind === 'stay') {
      const centroid = stayTripCentroid(containingEntry);
      return {lat: centroid.latitude, lng: centroid.longitude};
    }
    return null;
  }

  if (endMs === startMs) {
    return {lat: start.lat, lng: start.lng};
  }

  const progress = (timestampMs - startMs) / (endMs - startMs);
  return {
    lat: start.lat + (end.lat - start.lat) * progress,
    lng: start.lng + (end.lng - start.lng) * progress,
  };
}

export function resolveMomentCoordinate(
  momentTimestamp: Date,
  points: LocationPointRow[],
  containingEntry: DayTimelineEntry | null,
): {lat: number; lng: number} | null {
  if (points.length === 0) {
    if (containingEntry?.kind === 'stay') {
      const centroid = stayTripCentroid(containingEntry);
      return {lat: centroid.latitude, lng: centroid.longitude};
    }
    return null;
  }

  const sorted = getSortedLocationPointsByTime(points);
  return resolveFromSortedPoints(momentTimestamp, sorted, containingEntry);
}
