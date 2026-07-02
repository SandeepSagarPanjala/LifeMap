import type {SegmentMomentCounts} from '@lifemap/segmentation';
import type {ParsedPoint} from '../types';

export type MobileTimelinePoint = ParsedPoint;

export type DetectedTrip = {
  id: string;
  kind: 'travel' | 'stay';
  points: MobileTimelinePoint[];
  startAt: Date;
  endAt: Date;
  distanceKm: number;
  durationMs: number;
  openThroughNow?: boolean;
  segmentOrder?: number;
  savedPlaceLabel?: string;
  savedPlaceId?: number;
  savedPlaceKind?: 'home' | 'work' | 'favorite';
  fromSavedPlaceLabel?: string;
  fromSavedPlaceId?: number;
  toSavedPlaceLabel?: string;
  toSavedPlaceId?: number;
  placeLookupCacheId?: number;
  placeLookupLabel?: string;
  anchorLat?: number;
  anchorLng?: number;
  momentCounts?: SegmentMomentCounts;
};

export type TimelineGap = {
  id: string;
  kind: 'gap';
  points: readonly MobileTimelinePoint[];
  startAt: Date;
  endAt: Date;
  durationMs: number;
  distanceKm: number;
  momentCounts?: SegmentMomentCounts;
};

export type DayTimelineEntry = DetectedTrip | TimelineGap;

export type MobileDayHistory = {
  dateKey: string;
  entries: DayTimelineEntry[];
  dayPoints: MobileTimelinePoint[];
};
