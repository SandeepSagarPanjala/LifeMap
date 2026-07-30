import type { MomentRow } from '@/db/repositories/moments';
import type { LocationPointRow } from '@/db/repositories/location-days';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import { distanceKm, type LocationPointLike } from '@/lib/location-geo';
import { matchSavedPlaceForPoint } from '@/lib/saved-places';
import type { DayTimelineEntry, DetectedTrip } from '@/lib/trip-detection';
import {
  isMaterializedEntry,
  momentCountsFromRefs,
  momentsForTripRefs,
} from '@/lib/moment-refs';
import { resolveStayAnchor } from '@/lib/trip-detection';

import { momentImageUri } from './moment-media-uri';
import {
  effectiveTimelineEntryEnd,
  findContainingTimelineEntry,
  resolveMomentPinCoordinate,
} from './moment-timeline';

export type MomentCounts = {
  photo: number;
  video: number;
  voice: number;
  note: number;
  activity: number;
  mood: number;
};

/** Latest rich previews for stay-card chips (diary/voice keep Lucide). */
export type MomentCountPreviews = {
  photoThumbUri: string | null;
  videoThumbUri: string | null;
  activityEmoji: string | null;
  moodLabel: string | null;
  moodVariant: string | null;
};

export type TravelMomentMarker = {
  key: string;
  coordinate: { latitude: number; longitude: number };
  counts: MomentCounts;
  momentIds: number[];
};

export const EMPTY_MOMENT_COUNTS: MomentCounts = {
  photo: 0,
  video: 0,
  voice: 0,
  note: 0,
  activity: 0,
  mood: 0,
};

export const EMPTY_MOMENT_COUNT_PREVIEWS: MomentCountPreviews = {
  photoThumbUri: null,
  videoThumbUri: null,
  activityEmoji: null,
  moodLabel: null,
  moodVariant: null,
};

export function emptyMomentCounts(): MomentCounts {
  return { photo: 0, video: 0, voice: 0, note: 0, activity: 0, mood: 0 };
}

export function emptyMomentCountPreviews(): MomentCountPreviews {
  return { ...EMPTY_MOMENT_COUNT_PREVIEWS };
}

/**
 * Latest moment of each rich type for map chips.
 * Photo/video use thumbnailPath only (never full contentPath).
 */
export function latestMomentCountPreviews(
  moments: readonly MomentRow[],
): MomentCountPreviews {
  let latestPhoto: MomentRow | null = null;
  let latestVideo: MomentRow | null = null;
  let latestActivity: MomentRow | null = null;
  let latestMood: MomentRow | null = null;

  for (const moment of moments) {
    if (moment.type === 'photo') {
      if (
        latestPhoto == null ||
        moment.timestamp.getTime() >= latestPhoto.timestamp.getTime()
      ) {
        latestPhoto = moment;
      }
      continue;
    }
    if (moment.type === 'video') {
      if (
        latestVideo == null ||
        moment.timestamp.getTime() >= latestVideo.timestamp.getTime()
      ) {
        latestVideo = moment;
      }
      continue;
    }
    if (moment.type === 'activity') {
      if (
        latestActivity == null ||
        moment.timestamp.getTime() >= latestActivity.timestamp.getTime()
      ) {
        latestActivity = moment;
      }
      continue;
    }
    if (moment.type === 'mood') {
      if (
        latestMood == null ||
        moment.timestamp.getTime() >= latestMood.timestamp.getTime()
      ) {
        latestMood = moment;
      }
    }
  }

  return {
    photoThumbUri: latestPhoto?.thumbnailPath
      ? momentImageUri(latestPhoto.thumbnailPath)
      : null,
    videoThumbUri: latestVideo?.thumbnailPath
      ? momentImageUri(latestVideo.thumbnailPath)
      : null,
    activityEmoji: latestActivity?.activityEmoji?.trim() || null,
    moodLabel: latestMood?.moodLabel?.trim() || null,
    moodVariant: latestMood?.moodVariant?.trim() || null,
  };
}

/** Stable signature for Marker tracksViewChanges when thumbs backfill. */
export function momentCountPreviewsSignature(
  previews: MomentCountPreviews,
): string {
  return [
    previews.photoThumbUri ?? '',
    previews.videoThumbUri ?? '',
    previews.activityEmoji ?? '',
    previews.moodLabel ?? '',
    previews.moodVariant ?? '',
  ].join('|');
}

export function hasMomentCounts(counts: MomentCounts): boolean {
  return (
    counts.photo > 0 ||
    counts.video > 0 ||
    counts.voice > 0 ||
    counts.note > 0 ||
    counts.activity > 0 ||
    counts.mood > 0
  );
}

export function countMomentTypes(counts: MomentCounts): number {
  let total = 0;
  if (counts.photo > 0) total += 1;
  if (counts.video > 0) total += 1;
  if (counts.voice > 0) total += 1;
  if (counts.note > 0) total += 1;
  if (counts.activity > 0) total += 1;
  if (counts.mood > 0) total += 1;
  return total;
}

export type MomentCountType = keyof MomentCounts;

/**
 * Chips show the latest moment of a type, so tapping one must open that same
 * moment rather than the oldest in the group.
 */
export function latestMomentIndexOfType(
  moments: readonly MomentRow[],
  type: MomentRow['type'],
): number {
  let latestIndex = -1;
  let latestTime = 0;
  moments.forEach((moment, index) => {
    if (moment.type !== type) {
      return;
    }
    const time = moment.timestamp.getTime();
    if (latestIndex < 0 || time >= latestTime) {
      latestIndex = index;
      latestTime = time;
    }
  });
  return latestIndex;
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
    addToCounts(counts, moment);
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
  if (entry.kind !== 'gap' && isMaterializedEntry(entry)) {
    return momentCountsFromRefs(entry.momentRefs ?? []);
  }
  const counts = emptyMomentCounts();
  for (const moment of moments) {
    if (!momentBelongsToEntry(moment, entry, now)) {
      continue;
    }
    addToCounts(counts, moment);
  }
  return counts;
}

export function filterMomentsForEntry(
  moments: MomentRow[],
  entry: DayTimelineEntry,
  now: Date = new Date(),
): MomentRow[] {
  if (entry.kind !== 'gap' && isMaterializedEntry(entry)) {
    return momentsForTripRefs(moments, entry.momentRefs ?? []);
  }
  return moments.filter(moment => momentBelongsToEntry(moment, entry, now));
}

export function resolveMomentLocation(
  moment: MomentRow,
  points: LocationPointRow[],
  entries: DayTimelineEntry[],
  now: Date = new Date(),
): LocationPointLike | null {
  const containingEntry = findContainingTimelineEntry(
    moment.timestamp,
    entries,
    now,
  );
  const coordinate = resolveMomentPinCoordinate(
    moment,
    points,
    containingEntry,
  );
  return coordinate != null
    ? { lat: coordinate.lat, lng: coordinate.lng }
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

  const anchor = resolveStayAnchor(stay);
  return distanceKm(location, anchor) * 1000 <= dwellRadiusMeters + 5;
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
  } else if (moment.type === 'video') {
    counts.video += 1;
  } else if (moment.type === 'voice') {
    counts.voice += 1;
  } else if (moment.type === 'note') {
    counts.note += 1;
  } else if (moment.type === 'activity') {
    counts.activity += 1;
  } else if (moment.type === 'mood') {
    counts.mood += 1;
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

    const resolved = resolveMomentPinCoordinate(moment, points, entry);
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
      coordinate: { latitude: resolved.lat, longitude: resolved.lng },
      counts,
      momentIds: [moment.id],
    });
  }

  return [...grouped.values()];
}
