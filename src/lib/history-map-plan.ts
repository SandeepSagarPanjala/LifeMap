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

function findNextTravelAfter(
  entries: DayTimelineEntry[],
  afterIndex: number,
  config: TripDetectionConfig,
): LocationPointRow[] | null {
  for (let index = afterIndex + 1; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!isPlayableTimelineEntry(entry) || entry.kind !== 'travel') {
      continue;
    }
    const points = getTravelDisplayPoints(
      entry,
      stayBeforeEntryIndex(entries, index),
      staysBeforeEntryIndex(entries, index),
      config,
    );
    if (points.length > 0) {
      return points;
    }
  }
  return null;
}

function findNextStayAfter(
  entries: DayTimelineEntry[],
  afterIndex: number,
): DetectedTrip | null {
  for (let index = afterIndex + 1; index < entries.length; index += 1) {
    const entry = entries[index];
    if (isPlayableTimelineEntry(entry) && entry.kind === 'stay') {
      return entry;
    }
  }
  return null;
}

export function buildHistoryMapPlan(
  entries: DayTimelineEntry[],
  selectedIndex: number,
  config: TripDetectionConfig,
): HistoryMapPlan {
  const pastDrives: LocationPointRow[][] = [];
  const pastStays: DetectedTrip[] = [];
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
      }
    } else if (isPast) {
      pastStays.push(entry);
    }
  }

  const nextDrive =
    selectedIndex >= 0
      ? findNextTravelAfter(entries, selectedIndex, config)
      : null;
  const nextStay =
    selectedIndex >= 0 ? findNextStayAfter(entries, selectedIndex) : null;

  return {
    pastDrives,
    pastStays,
    nextDrive,
    nextStay,
    selected,
  };
}
