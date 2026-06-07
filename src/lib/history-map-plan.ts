import type {LocationPointRow} from '@/db/repositories/location-days';
import {
  getTravelDisplayPoints,
  getVisitInboundTravelPoints,
  isPlayableTimelineEntry,
  stayBeforeEntryIndex,
  staysBeforeEntryIndex,
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';
import type {TripDetectionConfig} from '@/lib/trip-settings';

export type HistoryMapSelected = {
  entry: DetectedTrip;
  travelPoints: LocationPointRow[] | null;
  inboundPoints: LocationPointRow[] | null;
};

export type HistoryMapPlan = {
  pastDrives: LocationPointRow[][];
  pastStays: DetectedTrip[];
  /** First playable event after the selected index (transparent blue). */
  nextDrive: LocationPointRow[] | null;
  nextStay: DetectedTrip | null;
  selected: HistoryMapSelected | null;
};

export function buildHistoryMapPlan(
  entries: DayTimelineEntry[],
  selectedIndex: number,
  config: TripDetectionConfig,
): HistoryMapPlan {
  const pastDrives: LocationPointRow[][] = [];
  const pastStays: DetectedTrip[] = [];
  let nextDrive: LocationPointRow[] | null = null;
  let nextStay: DetectedTrip | null = null;
  let nextCaptured = false;
  let selected: HistoryMapSelected | null = null;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!isPlayableTimelineEntry(entry)) {
      continue;
    }

    if (selectedIndex >= 0 && index === selectedIndex) {
      let travelPoints: LocationPointRow[] | null = null;
      let inboundPoints: LocationPointRow[] | null = null;

      if (entry.kind === 'travel') {
        travelPoints = getTravelDisplayPoints(
          entry,
          stayBeforeEntryIndex(entries, index),
          staysBeforeEntryIndex(entries, index),
          config,
        );
      } else if (index > 0) {
        const prior = entries[index - 1];
        if (prior?.kind === 'travel') {
          inboundPoints = getVisitInboundTravelPoints(
            prior,
            entry,
            stayBeforeEntryIndex(entries, index - 1),
            staysBeforeEntryIndex(entries, index - 1),
            config,
          );
        }
      }

      selected = {entry, travelPoints, inboundPoints};
      continue;
    }

    const isPast = selectedIndex >= 0 && index < selectedIndex;
    const isNext =
      selectedIndex >= 0 && index > selectedIndex && !nextCaptured;

    if (entry.kind === 'travel') {
      const points = getTravelDisplayPoints(
        entry,
        stayBeforeEntryIndex(entries, index),
        staysBeforeEntryIndex(entries, index),
        config,
      );
      if (points.length === 0) {
        continue;
      }
      if (isPast) {
        pastDrives.push(points);
      } else if (isNext) {
        nextDrive = points;
        nextCaptured = true;
      }
    } else if (isPast) {
      pastStays.push(entry);
    } else if (isNext) {
      nextStay = entry;
      nextCaptured = true;
    }
  }

  return {pastDrives, pastStays, nextDrive, nextStay, selected};
}
