import { toDateKey } from '@/lib/day-utils';
import {
  isPlayableTimelineEntry,
  type DayTimelineEntry,
  type DetectedTrip,
  type TimelineGap,
} from '@/lib/trip-detection';

function isPersistableTimelineEntry(
  entry: DayTimelineEntry,
): entry is DetectedTrip | TimelineGap {
  if (entry.kind === 'gap') {
    return true;
  }
  if (!isPlayableTimelineEntry(entry)) {
    return false;
  }
  if (entry.kind === 'travel') {
    return true;
  }
  return !entry.openThroughNow;
}

function lastPlayableEntry(
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

/** Travel that ends on a later calendar day than the day being sealed. */
export function isCrossMidnightTravelForDay(
  entry: Pick<DetectedTrip, 'kind' | 'endAt'>,
  dateKey: string,
): boolean {
  if (entry.kind !== 'travel') {
    return false;
  }
  return toDateKey(entry.endAt) !== dateKey;
}

export type PastDaySealSplit = {
  sealable: Array<DetectedTrip | TimelineGap>;
  excludedCrossMidnightFromMs: number | null;
};

/**
 * Past-day seal: persist only trips that belong on this calendar day.
 * Drops the last segment when it is a drive continuing past midnight.
 */
export function splitEntriesForPastDaySeal(
  entries: readonly DayTimelineEntry[],
  dateKey: string,
): PastDaySealSplit {
  const persistable = entries.filter(isPersistableTimelineEntry);
  const last = lastPlayableEntry(persistable);
  if (last == null || !isCrossMidnightTravelForDay(last, dateKey)) {
    return {
      sealable: persistable,
      excludedCrossMidnightFromMs: null,
    };
  }
  const lastKey = `${last.kind}:${last.startAt.getTime()}:${last.endAt.getTime()}`;
  return {
    sealable: persistable.filter(entry => {
      if (!isPlayableTimelineEntry(entry)) {
        return true;
      }
      const key = `${entry.kind}:${entry.startAt.getTime()}:${entry.endAt.getTime()}`;
      return key !== lastKey;
    }),
    excludedCrossMidnightFromMs: last.startAt.getTime(),
  };
}

/** @deprecated Prefer splitEntriesForPastDaySeal */
export function filterEntriesForPastDaySeal(
  entries: readonly DayTimelineEntry[],
  dateKey: string,
): Array<DetectedTrip | TimelineGap> {
  return splitEntriesForPastDaySeal(entries, dateKey).sealable;
}
