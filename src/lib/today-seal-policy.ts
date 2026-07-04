import {
  isPlayableTimelineEntry,
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';
import type {TripDetectionConfig} from '@/lib/trip-settings';

import {TODAY_LIVE_BUFFER_MAX_SEGMENTS} from '@/lib/app-constants';

export {TODAY_LIVE_BUFFER_MAX_SEGMENTS};

function shouldStayLive(
  entry: DetectedTrip,
  index: number,
  count: number,
  referenceNow: Date,
  config: TripDetectionConfig,
): boolean {
  if (entry.openThroughNow) {
    return true;
  }
  const dwellConfirmMs = config.dwellMinutes * 60_000;
  const endedRecently =
    entry.endAt.getTime() > referenceNow.getTime() - dwellConfirmMs;
  if (!endedRecently) {
    return false;
  }
  return index >= count - TODAY_LIVE_BUFFER_MAX_SEGMENTS;
}

/** First index of the live tail — prefix `[0, liveStart)` is sealable when closed. */
export function getTodayLiveBufferStartIndex(
  entries: readonly DayTimelineEntry[],
  referenceNow: Date,
  config: TripDetectionConfig,
): number {
  const playable = entries.filter((entry): entry is DetectedTrip =>
    isPlayableTimelineEntry(entry),
  );
  const count = playable.length;
  if (count === 0) {
    return 0;
  }

  let liveStart = count;
  for (let index = count - 1; index >= 0; index -= 1) {
    const entry = playable[index]!;
    if (shouldStayLive(entry, index, count, referenceNow, config)) {
      liveStart = index;
      continue;
    }
    break;
  }
  return liveStart;
}

/** Closed segments safe to persist for today (semantic rules + live buffer). */
export function getSealableTodayEntries(
  entries: readonly DayTimelineEntry[],
  referenceNow: Date,
  config: TripDetectionConfig,
): DetectedTrip[] {
  const playable = entries.filter((entry): entry is DetectedTrip =>
    isPlayableTimelineEntry(entry),
  );
  const liveStart = getTodayLiveBufferStartIndex(
    entries,
    referenceNow,
    config,
  );
  return playable.slice(0, liveStart).filter(entry => {
    if (entry.kind === 'travel') {
      return true;
    }
    return !entry.openThroughNow;
  });
}
