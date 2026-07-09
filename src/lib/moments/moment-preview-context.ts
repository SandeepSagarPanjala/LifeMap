import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import { findContainingTimelineEntry } from '@/lib/moments/moment-timeline';
import { formatDistance, type DistanceUnit } from '@/lib/location-geo';
import {
  matchSavedPlaceForStay,
  savedPlaceDisplayLabel,
} from '@/lib/saved-places';
import type { DayTimelineEntry, DetectedTrip } from '@/lib/trip-detection';
import {
  formatStayVisitLabel,
  formatTimelineKindLabel,
  formatTimelineStats,
  formatTripDuration,
  formatTripTimeRange,
} from '@/lib/trip-format';

export type MomentPreviewContext = {
  entryKind: DayTimelineEntry['kind'];
  kindLabel: string;
  placeLabel: string | null;
  timeLabel: string;
  statsLabel: string;
  entryId: string;
};

function formatMomentPreviewStats(
  entry: DayTimelineEntry,
  distanceUnit: DistanceUnit,
): string {
  if (entry.kind === 'travel') {
    const distance =
      entry.distanceKm > 0
        ? formatDistance(entry.distanceKm, distanceUnit)
        : '0 m';
    return `${distance} · ${formatTripDuration(entry.durationMs)}`;
  }
  return formatTimelineStats(entry, distanceUnit);
}

export function resolveMomentPreviewContext(
  momentTimestamp: Date,
  entries: DayTimelineEntry[],
  savedPlaces: readonly SavedPlaceRow[],
  distanceUnit: DistanceUnit = 'mi',
  now: Date = new Date(),
): MomentPreviewContext | null {
  const entry = findContainingTimelineEntry(momentTimestamp, entries, now);
  if (!entry) {
    return null;
  }
  return buildMomentPreviewContextForEntry(
    entry,
    savedPlaces,
    distanceUnit,
    now,
  );
}

export function buildMomentPreviewContextForEntry(
  entry: DayTimelineEntry,
  savedPlaces: readonly SavedPlaceRow[],
  distanceUnit: DistanceUnit = 'mi',
  now: Date = new Date(),
): MomentPreviewContext {
  if (entry.kind === 'stay') {
    const savedPlace = matchSavedPlaceForStay(entry, savedPlaces);
    const visit = formatStayVisitLabel(
      entry.startAt,
      entry.endAt,
      entry.durationMs,
      { openThroughNow: entry.openThroughNow, now },
    );
    return {
      entryKind: 'stay',
      kindLabel: 'Visit',
      placeLabel:
        savedPlace != null
          ? savedPlaceDisplayLabel(savedPlace)
          : entry.placeLabel ?? null,
      timeLabel: visit.title,
      statsLabel: visit.subtitle,
      entryId: entry.id,
    };
  }

  return {
    entryKind: entry.kind,
    kindLabel: formatTimelineKindLabel(entry),
    placeLabel: null,
    timeLabel: formatTripTimeRange(entry.startAt, entry.endAt),
    statsLabel: formatMomentPreviewStats(entry, distanceUnit),
    entryId: entry.id,
  };
}

export function findTimelineEntryById(
  entries: DayTimelineEntry[],
  entryId: string,
): DayTimelineEntry | null {
  return entries.find(entry => entry.id === entryId) ?? null;
}

export function findStayForMomentPreviewContext(
  entries: DayTimelineEntry[],
  context: MomentPreviewContext,
): DetectedTrip | null {
  if (context.entryKind !== 'stay') {
    return null;
  }
  const entry = findTimelineEntryById(entries, context.entryId);
  return entry?.kind === 'stay' ? entry : null;
}

export function formatMomentPreviewContextLine(
  context: MomentPreviewContext,
): string {
  const place = context.placeLabel?.trim();
  if (context.entryKind === 'stay' && place) {
    return `Visit · ${place}`;
  }
  if (context.entryKind === 'stay') {
    return 'Visit';
  }
  if (context.entryKind === 'travel') {
    return 'Drive';
  }
  return context.kindLabel;
}

export function formatMomentsPreviewSheetTitle(
  scope:
    | { kind: 'day' }
    | { kind: 'entry'; entry: DayTimelineEntry }
    | { kind: 'moment-ids'; title: string }
    | null,
  moments: { timestamp: Date }[],
  entries: DayTimelineEntry[],
  savedPlaces: readonly SavedPlaceRow[],
  dayNavLabel: string,
  distanceUnit: DistanceUnit = 'mi',
  now: Date = new Date(),
): string {
  if (!scope) {
    return '';
  }

  if (scope.kind === 'day') {
    return `${dayNavLabel} moments`;
  }

  if (scope.kind === 'entry') {
    const context = buildMomentPreviewContextForEntry(
      scope.entry,
      savedPlaces,
      distanceUnit,
      now,
    );
    const place = context.placeLabel?.trim();
    if (context.entryKind === 'stay' && place) {
      return `${place} moments`;
    }
    return context.entryKind === 'stay' ? 'Visit moments' : 'Drive moments';
  }

  if (scope.title !== 'Moment') {
    return scope.title;
  }

  const first = moments[0];
  if (!first) {
    return scope.title;
  }

  const context = resolveMomentPreviewContext(
    first.timestamp,
    entries,
    savedPlaces,
    distanceUnit,
    now,
  );
  if (!context) {
    return scope.title;
  }

  const place = context.placeLabel?.trim();
  if (context.entryKind === 'stay' && place) {
    return `${place} moments`;
  }
  if (context.entryKind === 'stay') {
    return 'Visit moments';
  }
  if (context.entryKind === 'travel') {
    return 'Drive moments';
  }
  return scope.title;
}
