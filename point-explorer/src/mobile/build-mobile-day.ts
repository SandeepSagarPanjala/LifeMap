import {detectTripsForDay} from '@lifemap/segmentation';

import type {MomentRow, ParsedPoint, PlaceLookupRow, SavedPlaceRow} from '../types';

import {segmentsToTimelineEntries} from './segments-to-entries';
import type {MobileDayHistory} from './types';

export function buildMobileDayHistory(
  dateKey: string,
  allPoints: readonly ParsedPoint[],
  savedPlaces: readonly SavedPlaceRow[],
  placeLookupCache: readonly PlaceLookupRow[],
  moments: readonly MomentRow[],
): MobileDayHistory {
  const result = detectTripsForDay(
    dateKey,
    [...allPoints],
    undefined,
    [...savedPlaces],
    placeLookupCache,
    moments,
  );
  return {
    dateKey,
    entries: segmentsToTimelineEntries(result.segments, savedPlaces),
    dayPoints: allPoints.filter(point => point.dateKey === dateKey),
  };
}
