import type {SavedPlaceRow} from '../types';
import type {
  DriveSegment,
  MissingSegment,
  StaySegment,
  TripSegment,
} from '@lifemap/segmentation';

import type {DayTimelineEntry, DetectedTrip, TimelineGap} from './types';

function savedPlaceKind(
  savedPlaces: readonly SavedPlaceRow[],
  savedPlaceId: number | undefined,
): DetectedTrip['savedPlaceKind'] {
  if (savedPlaceId == null) {
    return undefined;
  }
  return savedPlaces.find(place => place.id === savedPlaceId)?.kind;
}

function stayToEntry(
  segment: StaySegment,
  savedPlaces: readonly SavedPlaceRow[],
): DetectedTrip {
  return {
    id: segment.id,
    kind: 'stay',
    points: segment.points,
    startAt: segment.startAt,
    endAt: segment.endAt,
    durationMs: segment.durationMs,
    distanceKm: 0,
    segmentOrder: segment.order,
    savedPlaceLabel: segment.savedPlaceLabel,
    savedPlaceId: segment.savedPlaceId,
    savedPlaceKind: savedPlaceKind(savedPlaces, segment.savedPlaceId),
    placeLookupCacheId: segment.placeLookupCacheId,
    placeLookupLabel: segment.placeLookupLabel,
    anchorLat: segment.stop.lat,
    anchorLng: segment.stop.lng,
    momentCounts: segment.momentCounts,
  };
}

function driveToEntry(segment: DriveSegment): DetectedTrip {
  return {
    id: segment.id,
    kind: 'travel',
    points: segment.points,
    startAt: segment.startAt,
    endAt: segment.endAt,
    durationMs: segment.durationMs,
    distanceKm: segment.distanceM / 1000,
    segmentOrder: segment.order,
    fromSavedPlaceLabel: segment.fromSavedPlaceLabel,
    fromSavedPlaceId: segment.fromSavedPlaceId,
    toSavedPlaceLabel: segment.toSavedPlaceLabel,
    toSavedPlaceId: segment.toSavedPlaceId,
    savedPlaceLabel: segment.toSavedPlaceLabel ?? segment.fromSavedPlaceLabel,
    savedPlaceId: segment.toSavedPlaceId ?? segment.fromSavedPlaceId,
    momentCounts: segment.momentCounts,
  };
}

function missingToGap(segment: MissingSegment): TimelineGap {
  return {
    id: segment.id,
    kind: 'gap',
    points: [],
    startAt: segment.startAt,
    endAt: segment.endAt,
    durationMs: segment.durationMs,
    distanceKm: segment.distanceM / 1000,
    momentCounts: segment.momentCounts,
  };
}

export function segmentsToTimelineEntries(
  segments: readonly TripSegment[],
  savedPlaces: readonly SavedPlaceRow[],
): DayTimelineEntry[] {
  return segments.map(segment => {
    if (segment.kind === 'stay') {
      return stayToEntry(segment, savedPlaces);
    }
    if (segment.kind === 'drive') {
      return driveToEntry(segment);
    }
    return missingToGap(segment);
  });
}
