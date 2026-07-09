import type { SavedPlaceRow } from '../types';
import type {
  DriveSegment,
  MissingSegment,
  PlaceKind,
  StaySegment,
  TripSegment,
} from '@lifemap/segmentation';

import type { DayTimelineEntry, DetectedTrip, TimelineGap } from './types';

function savedPlaceKind(
  savedPlaces: readonly SavedPlaceRow[],
  placeId: number | undefined,
  placeKind: PlaceKind | undefined,
): DetectedTrip['savedPlaceKind'] {
  if (placeKind !== 'saved' || placeId == null) {
    return undefined;
  }
  return savedPlaces.find(place => place.id === placeId)?.kind;
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
    placeLabel: segment.placeLabel,
    placeId: segment.placeId,
    placeKind: segment.placeKind,
    savedPlaceKind: savedPlaceKind(
      savedPlaces,
      segment.placeId,
      segment.placeKind,
    ),
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
    fromPlaceLabel: segment.fromPlaceLabel,
    fromPlaceId: segment.fromPlaceId,
    fromPlaceKind: segment.fromPlaceKind,
    toPlaceLabel: segment.toPlaceLabel,
    toPlaceId: segment.toPlaceId,
    toPlaceKind: segment.toPlaceKind,
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
