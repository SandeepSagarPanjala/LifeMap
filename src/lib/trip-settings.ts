export const DEFAULT_TRIP_GAP_MINUTES = 10;
export const DEFAULT_TRIP_DWELL_MINUTES = 10;
export const DEFAULT_TRIP_DWELL_RADIUS_METERS = 150;

export const TRIP_GAP_CHOICES = [5, 10, 15, 20, 30] as const;
export const TRIP_DWELL_CHOICES = [5, 10, 15, 20, 30] as const;
export const TRIP_RADIUS_CHOICES = [75, 100, 150, 200, 300] as const;

export type TripDetectionConfig = {
  gapMinutes: number;
  dwellMinutes: number;
  dwellRadiusMeters: number;
};

export function buildTripDetectionConfig(
  gapMinutes: number,
  dwellMinutes: number,
  dwellRadiusMeters: number,
): TripDetectionConfig {
  return {
    gapMinutes,
    dwellMinutes,
    dwellRadiusMeters,
  };
}
