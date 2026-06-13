import type {MomentRow} from '@/db/repositories/moments';
import type {LocationPointRow} from '@/db/repositories/location-days';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {distanceKm, type LocationPointLike} from '@/lib/location-geo';
import {matchSavedPlaceForPoint} from '@/lib/saved-places';
import type {DayTimelineEntry, DetectedTrip} from '@/lib/trip-detection';
import {stayTripCentroid} from '@/lib/trip-detection';

import {
  effectiveTimelineEntryEnd,
  findContainingTimelineEntry,
  resolveMomentCoordinate,
} from './moment-timeline';

export type MomentCounts = {
  photo: number;
  voice: number;
  note: number;
};

export type TravelMomentMarker = {
  key: string;
  coordinate: {latitude: number; longitude: number};
  counts: MomentCounts;
  momentIds: number[];
};

export function emptyMomentCounts(): MomentCounts {
  return {photo: 0, voice: 0, note: 0};
}

export function hasMomentCounts(counts: MomentCounts): boolean {
  return counts.photo > 0 || counts.voice > 0 || counts.note > 0;
}

export function momentCountsEqual(a: MomentCounts, b: MomentCounts): boolean {
  return a.photo === b.photo && a.voice === b.voice && a.note === b.note;
}

/** Hide the docked day bar when the open-visit callout already shows every moment today. */
export function shouldShowDayMomentSummaryBar(
  dayCounts: MomentCounts,
  currentOpenVisit: DayTimelineEntry | null,
  visitCounts: MomentCounts,
): boolean {
  if (!hasMomentCounts(dayCounts)) {
    return false;
  }
  if (
    currentOpenVisit?.kind === 'stay' &&
    hasMomentCounts(visitCounts) &&
    momentCountsEqual(dayCounts, visitCounts)
  ) {
    return false;
  }
  return true;
}

/** Hide the saved-place cluster pill when a stay callout already shows those moments. */
export function shouldHideSavedPlaceMomentCluster(
  placeId: number,
  calloutSavedPlaceId: number | null | undefined,
  calloutMomentCounts: MomentCounts | undefined,
): boolean {
  return (
    calloutSavedPlaceId === placeId &&
    calloutMomentCounts != null &&
    hasMomentCounts(calloutMomentCounts)
  );
}

export function countMoments(moments: MomentRow[]): MomentCounts {
  const counts = emptyMomentCounts();
  for (const moment of moments) {
    if (moment.type === 'photo') {
      counts.photo += 1;
    } else if (moment.type === 'voice') {
      counts.voice += 1;
    } else if (moment.type === 'note') {
      counts.note += 1;
    }
  }
  return counts;
}

export function momentBelongsToEntry(
  moment: MomentRow,
  entry: DayTimelineEntry,
  now: Date,
): boolean {
  const timestampMs = moment.timestamp.getTime();
  return (
    timestampMs >= entry.startAt.getTime() &&
    timestampMs <= effectiveTimelineEntryEnd(entry, now).getTime()
  );
}

export function countMomentsForEntry(
  moments: MomentRow[],
  entry: DayTimelineEntry,
  now: Date = new Date(),
): MomentCounts {
  const counts = emptyMomentCounts();
  for (const moment of moments) {
    if (!momentBelongsToEntry(moment, entry, now)) {
      continue;
    }
    if (moment.type === 'photo') {
      counts.photo += 1;
    } else if (moment.type === 'voice') {
      counts.voice += 1;
    } else if (moment.type === 'note') {
      counts.note += 1;
    }
  }
  return counts;
}

export function filterMomentsForEntry(
  moments: MomentRow[],
  entry: DayTimelineEntry,
  now: Date = new Date(),
): MomentRow[] {
  return moments.filter(moment => momentBelongsToEntry(moment, entry, now));
}

export function resolveMomentLocation(
  moment: MomentRow,
  points: LocationPointRow[],
  entries: DayTimelineEntry[],
  now: Date = new Date(),
): LocationPointLike | null {
  if (moment.lat != null && moment.lng != null) {
    return {lat: moment.lat, lng: moment.lng};
  }

  const containingEntry = findContainingTimelineEntry(
    moment.timestamp,
    entries,
    now,
  );
  const coordinate = resolveMomentCoordinate(
    moment.timestamp,
    points,
    containingEntry,
  );
  return coordinate != null
    ? {lat: coordinate.lat, lng: coordinate.lng}
    : null;
}

export function momentMatchesSavedPlace(
  moment: MomentRow,
  place: SavedPlaceRow,
  points: LocationPointRow[],
  entries: DayTimelineEntry[],
  now: Date = new Date(),
): boolean {
  const location = resolveMomentLocation(moment, points, entries, now);
  if (location == null) {
    return false;
  }
  return matchSavedPlaceForPoint(location, [place])?.id === place.id;
}

export function momentMatchesStayLocation(
  moment: MomentRow,
  stay: DetectedTrip,
  savedPlace: SavedPlaceRow | null,
  dwellRadiusMeters: number,
  points: LocationPointRow[],
  entries: DayTimelineEntry[],
  now: Date = new Date(),
): boolean {
  if (savedPlace != null) {
    return momentMatchesSavedPlace(moment, savedPlace, points, entries, now);
  }

  const location = resolveMomentLocation(moment, points, entries, now);
  if (location == null) {
    return momentBelongsToEntry(moment, stay, now);
  }

  const centroid = stayTripCentroid(stay);
  return distanceKm(location, centroid) * 1000 <= dwellRadiusMeters + 5;
}

export function filterMomentsForStayEntry(
  moments: MomentRow[],
  entry: DayTimelineEntry,
  options: {
    savedPlace: SavedPlaceRow | null;
    dwellRadiusMeters: number;
    points: LocationPointRow[];
    entries: DayTimelineEntry[];
    /** Live stay callout clubs by place; history scrub uses visit time window. */
    aggregation?: 'place' | 'visit';
    now?: Date;
  },
): MomentRow[] {
  const now = options.now ?? new Date();
  const aggregation = options.aggregation ?? 'visit';
  if (entry.kind !== 'stay' || aggregation === 'visit') {
    return filterMomentsForEntry(moments, entry, now);
  }

  return moments.filter(moment =>
    momentMatchesStayLocation(
      moment,
      entry,
      options.savedPlace,
      options.dwellRadiusMeters,
      options.points,
      options.entries,
      now,
    ),
  );
}

export function countMomentsForStayEntry(
  moments: MomentRow[],
  entry: DayTimelineEntry,
  options: {
    savedPlace: SavedPlaceRow | null;
    dwellRadiusMeters: number;
    points: LocationPointRow[];
    entries: DayTimelineEntry[];
    aggregation?: 'place' | 'visit';
    now?: Date;
  },
): MomentCounts {
  return countMoments(filterMomentsForStayEntry(moments, entry, options));
}

export function addToCounts(counts: MomentCounts, moment: MomentRow): void {
  if (moment.type === 'photo') {
    counts.photo += 1;
  } else if (moment.type === 'voice') {
    counts.voice += 1;
  } else if (moment.type === 'note') {
    counts.note += 1;
  }
}

function coordinateBucket(lat: number, lng: number): string {
  return `${lat.toFixed(4)}:${lng.toFixed(4)}`;
}

export function buildTravelMomentMarkers(
  moments: MomentRow[],
  entries: DayTimelineEntry[],
  points: LocationPointRow[],
  now: Date = new Date(),
): TravelMomentMarker[] {
  const grouped = new Map<string, TravelMomentMarker>();

  for (const moment of moments) {
    const entry = findContainingTimelineEntry(moment.timestamp, entries, now);
    if (entry?.kind !== 'travel') {
      continue;
    }

    const resolved = resolveMomentCoordinate(moment.timestamp, points, entry);
    if (!resolved) {
      continue;
    }

    const bucket = coordinateBucket(resolved.lat, resolved.lng);
    const existing = grouped.get(bucket);
    if (existing) {
      addToCounts(existing.counts, moment);
      existing.momentIds.push(moment.id);
      continue;
    }

    const counts = emptyMomentCounts();
    addToCounts(counts, moment);
    grouped.set(bucket, {
      key: `${bucket}-${moment.id}`,
      coordinate: {latitude: resolved.lat, longitude: resolved.lng},
      counts,
      momentIds: [moment.id],
    });
  }

  return [...grouped.values()];
}
