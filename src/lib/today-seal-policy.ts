import {
  isPlayableTimelineEntry,
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';
import type { TripDetectionConfig } from '@/lib/trip-settings';

import { TODAY_LIVE_BUFFER_MAX_SEGMENTS } from '@/lib/app-constants';

/**
 * First index of the live tail — prefix `[0, liveStart)` is sealable.
 * Hard rule: always leave the last {@link TODAY_LIVE_BUFFER_MAX_SEGMENTS}
 * playable segments for tail (Y = X − 2). Those finalize next day via
 * sealYesterdayIfNeeded — not via dwell-based early seal.
 */
export function getTodayLiveBufferStartIndex(
  entries: readonly DayTimelineEntry[],
  _referenceNow: Date,
  _config: TripDetectionConfig,
): number {
  const playable = entries.filter((entry): entry is DetectedTrip =>
    isPlayableTimelineEntry(entry),
  );
  const count = playable.length;
  if (count === 0) {
    return 0;
  }
  return Math.max(0, count - TODAY_LIVE_BUFFER_MAX_SEGMENTS);
}

/** Closed segments safe to persist for today (hard X − 2 live buffer). */
export function getSealableTodayEntries(
  entries: readonly DayTimelineEntry[],
  referenceNow: Date,
  config: TripDetectionConfig,
): DetectedTrip[] {
  const playable = entries.filter((entry): entry is DetectedTrip =>
    isPlayableTimelineEntry(entry),
  );
  const liveStart = getTodayLiveBufferStartIndex(entries, referenceNow, config);
  return playable.slice(0, liveStart).filter(entry => {
    if (entry.kind === 'travel') {
      return true;
    }
    return !entry.openThroughNow;
  });
}
