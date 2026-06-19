import type {LocationPointRow} from '@/db/repositories/location-days';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';

export type {SavedPlaceRow};

export type ParsedPoint = LocationPointRow & {
  at: Date;
  dateKey: string;
};
