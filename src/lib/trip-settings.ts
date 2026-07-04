import {
  DEFAULT_TRIP_DWELL_MINUTES,
  DEFAULT_TRIP_DWELL_RADIUS_METERS,
  DEFAULT_TRIP_GAP_MINUTES,
  TRIP_DWELL_CHOICES,
  TRIP_RADIUS_CHOICES,
} from '@/lib/app-constants';

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
