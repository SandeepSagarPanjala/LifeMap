import {format} from 'date-fns';

import type {DetectedTrip, TripKind} from '@/lib/trip-detection';
import {formatDistance, type DistanceUnit} from '@/lib/location-geo';

export function formatTripDuration(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000));
  if (totalMinutes < 1) {
    return '< 1 min';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${minutes} min`;
}

export function formatTripTimeRange(startAt: Date, endAt: Date): string {
  return `${format(startAt, 'h:mm a')} – ${format(endAt, 'h:mm a')}`;
}

export function formatTripKindLabel(kind: TripKind): string {
  return kind === 'travel' ? 'Drive' : 'Stay';
}

export function formatTripStats(trip: DetectedTrip, distanceUnit: DistanceUnit): string {
  const duration = formatTripDuration(trip.durationMs);
  if (trip.kind === 'stay') {
    return `${formatTripKindLabel(trip.kind)} · ${duration}`;
  }

  const distance =
    trip.distanceKm > 0
      ? formatDistance(trip.distanceKm, distanceUnit)
      : '0 m';
  return `${formatTripKindLabel(trip.kind)} · ${distance} · ${duration}`;
}
