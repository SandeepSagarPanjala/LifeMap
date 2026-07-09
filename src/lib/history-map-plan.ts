import type { LocationPointRow } from '@/db/repositories/location-days';
import {
  getTravelDisplayPoints,
  getVisitInboundTravelPoints,
  isPlayableTimelineEntry,
  stayBeforeEntryIndex,
  staysBeforeEntryIndex,
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';
import {
  isRawGpsDayPoints,
  resolveRoutePointsForPlayableTrip,
} from '@/lib/timeline-from-trips';
import type { TripDetectionConfig } from '@/lib/trip-settings';

export type HistoryMapSelected = {
  entry: DetectedTrip;
  travelPoints: LocationPointRow[] | null;
  inboundPoints: LocationPointRow[] | null;
  outboundPoints: LocationPointRow[] | null;
  anchorStartStay: DetectedTrip | null;
  anchorEndStay: DetectedTrip | null;
  outboundEndStay: DetectedTrip | null;
  /** @deprecated No longer shown on drive scrub — visit preview removed. */
  arrivalVisit: DetectedTrip | null;
  /** @deprecated No longer shown on drive scrub — next drive preview removed. */
  departureDrivePoints: LocationPointRow[] | null;
};

export type HistoryMapPlan = {
  /** @deprecated Future segment preview disabled — one segment at a time. */
  nextDrive: LocationPointRow[] | null;
  nextStay: DetectedTrip | null;
  selected: HistoryMapSelected | null;
};

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

function playableTrips(entries: DayTimelineEntry[]): DetectedTrip[] {
  return entries.filter((entry): entry is DetectedTrip =>
    isPlayableTimelineEntry(entry),
  );
}

function withRoutePoints(
  trip: DetectedTrip,
  playable: DetectedTrip[],
  dayPoints: LocationPointRow[],
): DetectedTrip {
  if (trip.points.length > 0) {
    return trip;
  }
  if (dayPoints.length === 0) {
    return trip;
  }
  if (trip.kind !== 'travel' || !isRawGpsDayPoints(dayPoints)) {
    return trip;
  }
  return {
    ...trip,
    points: resolveRoutePointsForPlayableTrip(trip, playable, dayPoints),
  };
}

export function buildHistoryMapPlan(
  entries: DayTimelineEntry[],
  selectedIndex: number,
  config: TripDetectionConfig,
  dayPoints: LocationPointRow[] = [],
  _savedPlaces: readonly unknown[] = [],
): HistoryMapPlan {
  const playable = playableTrips(entries);
  let selected: HistoryMapSelected | null = null;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!isPlayableTimelineEntry(entry)) {
      continue;
    }

    if (selectedIndex >= 0 && index === selectedIndex) {
      const hydrated = withRoutePoints(entry, playable, dayPoints);
      let travelPoints: LocationPointRow[] | null = null;
      let inboundPoints: LocationPointRow[] | null = null;
      let anchorStartStay: DetectedTrip | null = null;
      let anchorEndStay: DetectedTrip | null = null;

      if (hydrated.kind === 'travel') {
        anchorStartStay = stayBeforeEntryIndex(entries, index);
        anchorEndStay = findNextStayAfter(entries, index);
        travelPoints = getTravelDisplayPoints(
          hydrated,
          anchorStartStay,
          staysBeforeEntryIndex(entries, index),
          config,
        );
      } else if (index > 0) {
        const prior = entries[index - 1];
        if (prior?.kind === 'travel') {
          const hydratedPrior = withRoutePoints(prior, playable, dayPoints);
          anchorStartStay = stayBeforeEntryIndex(entries, index - 1);
          anchorEndStay = hydrated;
          inboundPoints = getVisitInboundTravelPoints(
            hydratedPrior,
            hydrated,
            anchorStartStay,
            staysBeforeEntryIndex(entries, index - 1),
            config,
          );
        }
      }

      selected = {
        entry: hydrated,
        travelPoints,
        inboundPoints,
        outboundPoints: null,
        anchorStartStay,
        anchorEndStay,
        outboundEndStay: null,
        arrivalVisit: null,
        departureDrivePoints: null,
      };
      break;
    }
  }

  return {
    nextDrive: null,
    nextStay: null,
    selected,
  };
}
