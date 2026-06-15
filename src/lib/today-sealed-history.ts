import {differenceInMilliseconds} from 'date-fns';

import type {TripRow} from '@/db/repositories/trips';
import {
  isPlayableTimelineEntry,
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';

/** GPS context before the seal boundary for tail trip detection. */
export const TODAY_TAIL_CONTEXT_MS = 2 * 60 * 60 * 1000;
const BOUNDARY_CONTIGUOUS_MS = 60_000;
const MIN_TIMELINE_GAP_MS = 2 * 60_000;

export function sealedThroughMs(tripRows: readonly TripRow[]): number | null {
  if (tripRows.length === 0) {
    return null;
  }
  return Math.max(...tripRows.map(row => row.endAt.getTime()));
}

export function tailGpsStartMs(
  sealedThrough: number,
  dayStartMs: number,
): number {
  return Math.max(dayStartMs, sealedThrough - TODAY_TAIL_CONTEXT_MS);
}

export function filterLiveTailEntries(
  entries: readonly DayTimelineEntry[],
  sealedThrough: number,
): DayTimelineEntry[] {
  const result: DayTimelineEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === 'gap') {
      if (entry.endAt.getTime() > sealedThrough) {
        result.push(entry);
      }
      continue;
    }
    if (!isPlayableTimelineEntry(entry)) {
      continue;
    }
    if (entry.openThroughNow) {
      result.push(entry);
      continue;
    }
    if (entry.endAt.getTime() <= sealedThrough) {
      continue;
    }
    if (entry.startAt.getTime() < sealedThrough - BOUNDARY_CONTIGUOUS_MS) {
      continue;
    }
    result.push(entry);
  }
  return result;
}

function lastPlayable(
  entries: readonly DayTimelineEntry[],
): DetectedTrip | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (isPlayableTimelineEntry(entry)) {
      return entry;
    }
  }
  return null;
}

function firstPlayable(
  entries: readonly DayTimelineEntry[],
): DetectedTrip | null {
  for (const entry of entries) {
    if (isPlayableTimelineEntry(entry)) {
      return entry;
    }
  }
  return null;
}

export function trimSealedAtBoundary(
  sealed: readonly DayTimelineEntry[],
  liveTail: readonly DayTimelineEntry[],
): DayTimelineEntry[] {
  const firstTail = firstPlayable(liveTail);
  const lastSealed = lastPlayable(sealed);
  if (firstTail == null || lastSealed == null) {
    return [...sealed];
  }

  const gapMs = firstTail.startAt.getTime() - lastSealed.endAt.getTime();
  if (
    lastSealed.kind !== firstTail.kind ||
    gapMs > BOUNDARY_CONTIGUOUS_MS
  ) {
    return [...sealed];
  }

  const trimmed: DayTimelineEntry[] = [];
  let removedLastPlayable = false;
  for (let index = sealed.length - 1; index >= 0; index -= 1) {
    const entry = sealed[index]!;
    if (!removedLastPlayable) {
      if (entry.kind === 'gap') {
        continue;
      }
      if (isPlayableTimelineEntry(entry) && entry.id === lastSealed.id) {
        removedLastPlayable = true;
        continue;
      }
      removedLastPlayable = true;
    }
    trimmed.unshift(entry);
  }
  return trimmed;
}

function makeGap(startAt: Date, endAt: Date, index: number): DayTimelineEntry {
  return {
    id: `gap-merge-${index}-${startAt.getTime()}`,
    kind: 'gap',
    points: [],
    startAt,
    endAt,
    durationMs: Math.max(0, differenceInMilliseconds(endAt, startAt)),
    distanceKm: 0,
  };
}

export function mergeSealedAndLiveTimeline(
  sealed: readonly DayTimelineEntry[],
  live: readonly DayTimelineEntry[],
  sealedThrough: number,
): DayTimelineEntry[] {
  const tail = filterLiveTailEntries(live, sealedThrough);
  const trimmedSealed = trimSealedAtBoundary(sealed, tail);
  if (tail.length === 0) {
    return [...trimmedSealed];
  }

  const merged: DayTimelineEntry[] = [...trimmedSealed];
  const lastSealed = lastPlayable(trimmedSealed);
  const firstTail = firstPlayable(tail);
  if (lastSealed != null && firstTail != null) {
    const gapMs = differenceInMilliseconds(
      firstTail.startAt,
      lastSealed.endAt,
    );
    if (gapMs >= MIN_TIMELINE_GAP_MS) {
      merged.push(makeGap(lastSealed.endAt, firstTail.startAt, merged.length));
    }
  }

  let tailStartIndex = 0;
  if (tail[0]?.kind === 'gap' && merged[merged.length - 1]?.kind === 'gap') {
    tailStartIndex = 1;
  }
  merged.push(...tail.slice(tailStartIndex));
  return merged;
}
