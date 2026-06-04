import {differenceInMilliseconds, subHours} from 'date-fns';

import type {LocationPointRow} from '@/db/repositories/location-days';
import {
  arePointsSamePlace,
  buildDayTimeline,
  dedupeLocationPoints,
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';
import type {TripDetectionConfig} from '@/lib/trip-settings';

const LOOKBACK_HOURS = 48;

function lastPointBefore(
  points: LocationPointRow[],
  dayStart: Date,
): LocationPointRow | null {
  let last: LocationPointRow | null = null;
  for (const point of points) {
    if (point.timestamp.getTime() < dayStart.getTime()) {
      last = point;
    }
  }
  return last;
}

function lastStayIndex(entries: DayTimelineEntry[]): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]!.kind === 'stay') {
      return index;
    }
  }
  return -1;
}

function overlapsToday(
  entry: DayTimelineEntry,
  dayStart: Date,
  now: Date,
): boolean {
  const end =
    entry.kind === 'stay' && entry.openThroughNow
      ? now
      : entry.endAt;
  return end.getTime() > dayStart.getTime() && entry.startAt.getTime() < now.getTime();
}

function adjustStay(
  stay: DetectedTrip,
  updates: Partial<Pick<DetectedTrip, 'startAt' | 'endAt' | 'durationMs' | 'openThroughNow'>>,
): DetectedTrip {
  return {...stay, ...updates};
}

/**
 * Today map history: detect on lookback + today, fill midnight→first save when
 * still at the same place, and run the open visit through now when no newer saves.
 */
export function prepareTodayHistoryTimeline(
  todayPoints: LocationPointRow[],
  lookbackPoints: LocationPointRow[],
  dayStart: Date,
  now: Date,
  config: TripDetectionConfig,
): DayTimelineEntry[] {
  const combined = dedupeLocationPoints([...lookbackPoints, ...todayPoints]);
  const raw = buildDayTimeline(combined, config);
  const lastBeforeDay = lastPointBefore(combined, dayStart);
  const openStayIndex = lastStayIndex(raw);

  const filtered = raw.filter(entry => overlapsToday(entry, dayStart, now));
  const firstStayIdx = filtered.findIndex(e => e.kind === 'stay');
  const openStayIdx = lastStayIndex(filtered);

  const presented = filtered.map((entry, index) => {
      if (entry.kind !== 'stay') {
        return entry;
      }

      const isFirstStay = index === firstStayIdx;
      const isOpenStay = index === openStayIdx;

      let stay = entry;
      const firstSave = stay.points[0]!;

      if (
        isFirstStay &&
        lastBeforeDay != null &&
        arePointsSamePlace(lastBeforeDay, firstSave, config)
      ) {
        stay = adjustStay(stay, {
          startAt: dayStart,
          durationMs: differenceInMilliseconds(stay.endAt, dayStart),
        });
      }

      if (isOpenStay) {
        stay = adjustStay(stay, {
          endAt: now,
          durationMs: differenceInMilliseconds(now, stay.startAt),
          openThroughNow: true,
        });
      }

      return stay;
    });

  return presented;
}

export function getTodayHistoryLookbackStart(dayStart: Date): Date {
  return subHours(dayStart, LOOKBACK_HOURS);
}
