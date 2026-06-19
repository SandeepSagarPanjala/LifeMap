export const DEFAULT_TRIP_GAP_MINUTES = 10;
export const DEFAULT_TRIP_DWELL_MINUTES = 5;
/** Fixed same-place radius for visit detection (not exposed in Settings). */
export const HISTORY_SAME_PLACE_RADIUS_METERS = 75;
export const DEFAULT_TRIP_DWELL_RADIUS_METERS = HISTORY_SAME_PLACE_RADIUS_METERS;

/** Stops during a drive (Whataburger, charger, etc.) — lower than home dwell. */
export const MIN_TRIP_STOP_MINUTES = 5;

/** Minimum radius when grouping pings at a stop (GPS drift in parking lots). */
export const MIN_STOP_CLUSTER_RADIUS_METERS = 50;

/** Minimum time at one place before it counts as a visit (stay). */
export const TRIP_DWELL_CHOICES = [5, 10, 20, 30, 40, 50, 60] as const;

/** How close saves must be to count as the same place. */
export const TRIP_RADIUS_CHOICES = [20, 25, 50, 75, 100, 150] as const;

export type TripDwellMinutes = (typeof TRIP_DWELL_CHOICES)[number];
export type TripRadiusMeters = (typeof TRIP_RADIUS_CHOICES)[number];

export type TripDetectionConfig = {
  gapMinutes: number;
  dwellMinutes: number;
  dwellRadiusMeters: number;
};

/** Minimum dwell at a saved place (Home, Work, favorites) before it counts as a visit. */
export const SAVED_PLACE_MIN_DWELL_MINUTES = 1;

/** Bump when visit/drive detection rules change — invalidates sealed day cache. */
export const TRIP_DETECTION_VERSION = 14;

/** Bump when stored route/visit geometry rules change — invalidates fast load path. */
export const TRIP_GEOMETRY_VERSION = 3;

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
