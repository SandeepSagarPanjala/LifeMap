import type { LocationPointRow } from '@/db/repositories/location-days';
import type { DayTimelineEntry, DetectedTrip } from '@/lib/trip-detection';
import { resolveStayAnchor } from '@/lib/trip-detection';
import { isMaterializedEntry } from '@/lib/moment-refs';

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

/** Closest GPS fix in time — same rule as stay canonical geometry. */
export function nearestPointCoordinateAtTime(
  points: readonly LocationPointRow[],
  momentTimestamp: Date,
): { lat: number; lng: number } | null {
  const sorted = getSortedLocationPointsByTime(points);
  if (sorted.length === 0) {
    return null;
  }
  if (sorted.length === 1) {
    const only = sorted[0]!;
    return { lat: only.lat, lng: only.lng };
  }

  const timestampMs = momentTimestamp.getTime();
  let best = sorted[0]!;
  let bestDelta = Math.abs(best.timestamp.getTime() - timestampMs);
  for (let i = 1; i < sorted.length; i += 1) {
    const candidate = sorted[i]!;
    const delta = Math.abs(candidate.timestamp.getTime() - timestampMs);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return { lat: best.lat, lng: best.lng };
}

function resolveStayMomentCoordinate(
  stay: DetectedTrip,
  momentTimestamp: Date,
): { lat: number; lng: number } {
  const fromStayPoints = nearestPointCoordinateAtTime(
    stay.points,
    momentTimestamp,
  );
  if (fromStayPoints != null) {
    return fromStayPoints;
  }
  const anchor = resolveStayAnchor(stay);
  return { lat: anchor.lat, lng: anchor.lng };
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
): { lat: number; lng: number } | null {
  const timestampMs = momentTimestamp.getTime();
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  if (timestampMs <= first.timestamp.getTime()) {
    return { lat: first.lat, lng: first.lng };
  }
  if (timestampMs >= last.timestamp.getTime()) {
    return { lat: last.lat, lng: last.lng };
  }

  const index = findSegmentStartIndex(sorted, timestampMs);
  const start = sorted[index]!;
  const end = sorted[index + 1]!;
  const startMs = start.timestamp.getTime();
  const endMs = end.timestamp.getTime();

  if (timestampMs < startMs || timestampMs > endMs) {
    if (containingEntry?.kind === 'stay') {
      return resolveStayMomentCoordinate(containingEntry, momentTimestamp);
    }
    return nearestPointCoordinateAtTime(sorted, momentTimestamp);
  }

  if (endMs === startMs) {
    return { lat: start.lat, lng: start.lng };
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
): { lat: number; lng: number } | null {
  if (points.length === 0) {
    if (containingEntry?.kind === 'stay') {
      return resolveStayMomentCoordinate(containingEntry, momentTimestamp);
    }
    return null;
  }

  const sorted = getSortedLocationPointsByTime(points);
  return resolveFromSortedPoints(momentTimestamp, sorted, containingEntry);
}

/** Prefer materialized trip_points anchors; fall back to GPS interpolation. */
export function resolveMomentPinCoordinate(
  moment: { id: number; timestamp: Date },
  points: LocationPointRow[],
  containingEntry: DayTimelineEntry | null,
): { lat: number; lng: number } | null {
  if (
    containingEntry != null &&
    containingEntry.kind !== 'gap' &&
    isMaterializedEntry(containingEntry)
  ) {
    const anchor = containingEntry.routeMomentAnchors?.find(
      row => row.momentId === moment.id,
    );
    if (anchor != null) {
      return { lat: anchor.lat, lng: anchor.lng };
    }
  }
  return resolveMomentCoordinate(moment.timestamp, points, containingEntry);
}
