import type { DayTimelineEntry, DetectedTrip } from './types';

export function isPlayableTimelineEntry(
  entry: DayTimelineEntry,
): entry is DetectedTrip {
  return entry.kind !== 'gap';
}

export function firstPlayableTimelineIndex(
  entries: readonly DayTimelineEntry[],
): number {
  for (let index = 0; index < entries.length; index += 1) {
    if (isPlayableTimelineEntry(entries[index]!)) {
      return index;
    }
  }
  return -1;
}

export function lastPlayableTimelineIndex(
  entries: readonly DayTimelineEntry[],
): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (isPlayableTimelineEntry(entries[index]!)) {
      return index;
    }
  }
  return -1;
}

export function findNextPlayableTimelineIndex(
  entries: readonly DayTimelineEntry[],
  fromIndex: number,
): number {
  for (let index = fromIndex + 1; index < entries.length; index += 1) {
    if (isPlayableTimelineEntry(entries[index]!)) {
      return index;
    }
  }
  return -1;
}

export function findPrevPlayableTimelineIndex(
  entries: readonly DayTimelineEntry[],
  fromIndex: number,
): number {
  for (let index = fromIndex - 1; index >= 0; index -= 1) {
    if (isPlayableTimelineEntry(entries[index]!)) {
      return index;
    }
  }
  return -1;
}
