import type {LocationPointRow} from '@/db/repositories/location-days';
import {
  extendTravelToVisitArrival,
  getTravelDisplayPoints,
  getVisitInboundTravelPoints,
  isPlayableTimelineEntry,
  stayBeforeEntryIndex,
  staysBeforeEntryIndex,
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';
import {isArrivalVisitAfterDrive} from '@/lib/arrival-visit';
import {
  isRawGpsDayPoints,
  resolveRoutePointsForPlayableTrip,
} from '@/lib/timeline-from-trips';
import type {TripDetectionConfig} from '@/lib/trip-settings';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';

export type HistoryMapSelected = {
  entry: DetectedTrip;
  travelPoints: LocationPointRow[] | null;
  inboundPoints: LocationPointRow[] | null;
  outboundPoints: LocationPointRow[] | null;
  anchorStartStay: DetectedTrip | null;
  anchorEndStay: DetectedTrip | null;
  outboundEndStay: DetectedTrip | null;
  /** Qualifying visit immediately after a selected drive (food stop, charger, etc.). */
  arrivalVisit: DetectedTrip | null;
  /** Short drive after an arrival visit (e.g. Whataburger → Tesla charger). */
  departureDrivePoints: LocationPointRow[] | null;
};

export type HistoryMapPlan = {
  /** First playable event after the selected index (transparent blue). */
  nextDrive: LocationPointRow[] | null;
  nextStay: DetectedTrip | null;
  selected: HistoryMapSelected | null;
};

function findNextTravelAfter(
  entries: DayTimelineEntry[],
  afterIndex: number,
  config: TripDetectionConfig,
  dayPoints: LocationPointRow[],
): LocationPointRow[] | null {
  const playable = playableTrips(entries);
  for (let index = afterIndex + 1; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!isPlayableTimelineEntry(entry) || entry.kind !== 'travel') {
      continue;
    }
    const hydrated = withRoutePoints(entry, playable, dayPoints);
    const points = getTravelDisplayPoints(
      hydrated,
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

function findDepartureDriveAfterVisit(
  entries: DayTimelineEntry[],
  afterIndex: number,
  config: TripDetectionConfig,
  dayPoints: LocationPointRow[],
): LocationPointRow[] | null {
  return findNextTravelAfter(entries, afterIndex, config, dayPoints);
}

function findOutboundDriveAfterStay(
  entries: DayTimelineEntry[],
  stayIndex: number,
  config: TripDetectionConfig,
  dayPoints: LocationPointRow[],
): {points: LocationPointRow[]; endStay: DetectedTrip | null} | null {
  const playable = playableTrips(entries);
  for (let index = stayIndex + 1; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!isPlayableTimelineEntry(entry) || entry.kind !== 'travel') {
      continue;
    }
    const hydrated = withRoutePoints(entry, playable, dayPoints);
    const points = getTravelDisplayPoints(
      hydrated,
      stayBeforeEntryIndex(entries, index),
      staysBeforeEntryIndex(entries, index),
      config,
    );
    if (points.length > 0) {
      return {
        points,
        endStay: findNextStayAfter(entries, index),
      };
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
  savedPlaces: readonly SavedPlaceRow[] = [],
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
      let outboundPoints: LocationPointRow[] | null = null;
      let anchorStartStay: DetectedTrip | null = null;
      let anchorEndStay: DetectedTrip | null = null;
      let outboundEndStay: DetectedTrip | null = null;

      let arrivalVisit: DetectedTrip | null = null;
      let departureDrivePoints: LocationPointRow[] | null = null;

      if (hydrated.kind === 'travel') {
        anchorStartStay = stayBeforeEntryIndex(entries, index);
        anchorEndStay = findNextStayAfter(entries, index);
        if (
          isArrivalVisitAfterDrive(
            hydrated,
            anchorEndStay,
            config,
            savedPlaces,
          )
        ) {
          arrivalVisit = anchorEndStay;
          departureDrivePoints = findDepartureDriveAfterVisit(
            entries,
            index,
            config,
            dayPoints,
          );
        }
        travelPoints = extendTravelToVisitArrival(
          getTravelDisplayPoints(
            hydrated,
            anchorStartStay,
            staysBeforeEntryIndex(entries, index),
            config,
          ),
          anchorEndStay,
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
        const outbound = findOutboundDriveAfterStay(
          entries,
          index,
          config,
          dayPoints,
        );
        outboundPoints = outbound?.points ?? null;
        outboundEndStay = outbound?.endStay ?? null;
      }

      selected = {
        entry: hydrated,
        travelPoints,
        inboundPoints,
        outboundPoints,
        anchorStartStay,
        anchorEndStay,
        outboundEndStay,
        arrivalVisit,
        departureDrivePoints,
      };
      break;
    }
  }

  const nextDrive =
    selectedIndex >= 0
      ? findNextTravelAfter(
          entries,
          selectedIndex,
          config,
          dayPoints,
        )
      : null;
  const nextStay =
    selectedIndex >= 0 ? findNextStayAfter(entries, selectedIndex) : null;

  return {
    nextDrive,
    nextStay,
    selected,
  };
}
