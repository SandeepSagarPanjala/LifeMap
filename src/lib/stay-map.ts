import type {DetectedTrip} from '@/lib/trip-detection';
import {stayMapCentroid} from '@/lib/trip-detection';

export type StayMapCircle = {
  key: string;
  center: {latitude: number; longitude: number};
  radiusMeters: number;
};

export function buildStayMapCircles(
  stays: DetectedTrip[],
  dwellRadiusMeters: number,
): StayMapCircle[] {
  return stays.map(stay => ({
    key: stay.id,
    center: stayMapCentroid(stay),
    radiusMeters: dwellRadiusMeters,
  }));
}
