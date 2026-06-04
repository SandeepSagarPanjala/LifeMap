export const DEFAULT_TRIP_GAP_MINUTES = 10;
export const DEFAULT_TRIP_DWELL_MINUTES = 10;
export const DEFAULT_TRIP_DWELL_RADIUS_METERS = 150;

/** Minimum time at one place before it counts as a visit (stay). */
export const TRIP_DWELL_CHOICES = [10, 20, 30, 40, 50, 60] as const;

/** How close saves must be to count as the same place. */
export const TRIP_RADIUS_CHOICES = [25, 50, 100, 150] as const;

export type TripDwellMinutes = (typeof TRIP_DWELL_CHOICES)[number];
export type TripRadiusMeters = (typeof TRIP_RADIUS_CHOICES)[number];

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

export function normalizeTripDwellMinutes(value: number): TripDwellMinutes {
  if (TRIP_DWELL_CHOICES.includes(value as TripDwellMinutes)) {
    return value as TripDwellMinutes;
  }
  return DEFAULT_TRIP_DWELL_MINUTES;
}

export function normalizeTripRadiusMeters(value: number): TripRadiusMeters {
  if (TRIP_RADIUS_CHOICES.includes(value as TripRadiusMeters)) {
    return value as TripRadiusMeters;
  }
  return DEFAULT_TRIP_DWELL_RADIUS_METERS;
}

export function buildTripDetectionConfigFromPreferences(
  dwellMinutes: number,
  dwellRadiusMeters: number,
): TripDetectionConfig {
  return buildTripDetectionConfig(
    DEFAULT_TRIP_GAP_MINUTES,
    normalizeTripDwellMinutes(dwellMinutes),
    normalizeTripRadiusMeters(dwellRadiusMeters),
  );
}

export function formatTripDwellLabel(minutes: TripDwellMinutes): string {
  if (minutes === 60) {
    return '1 hr';
  }
  return `${minutes} min`;
}

export function formatTripRadiusLabel(meters: TripRadiusMeters): string {
  return `${meters} m`;
}
