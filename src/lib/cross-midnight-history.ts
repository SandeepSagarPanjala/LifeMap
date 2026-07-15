import type { MaterializedDayRow } from '@/db/repositories/materialized-days';
import { getMaterializedDay } from '@/db/repositories/materialized-days';
import { listTripPointsForTrip } from '@/db/repositories/trip-points';
import { listTripsForDay, type TripRow } from '@/db/repositories/trips';
import { shiftDateKey } from '@/lib/day-utils';
import {
  locationPointsForTripRow,
  tripRowToDetectedTripWithGeometry,
} from '@/lib/trip-geometry';
import {
  isPlayableTimelineEntry,
  type DayTimelineEntry,
  type DetectedTrip,
} from '@/lib/trip-detection';

/** Exact start match for the overnight drive excluded from day D's seal. */
export function findExcludedCrossMidnightTravel(
  nextDayTrips: readonly TripRow[],
  excludedCrossMidnightFromMs: number,
): TripRow | null {
  for (const trip of nextDayTrips) {
    if (
      trip.kind === 'travel' &&
      trip.startAt.getTime() === excludedCrossMidnightFromMs
    ) {
      return trip;
    }
  }
  return null;
}

function timelineAlreadyHasTravelStart(
  entries: readonly DayTimelineEntry[],
  startAtMs: number,
): boolean {
  return entries.some(
    entry =>
      isPlayableTimelineEntry(entry) &&
      entry.kind === 'travel' &&
      entry.startAt.getTime() === startAtMs,
  );
}

/**
 * Display-only: when day D sealed away an overnight drive, borrow that sealed
 * travel from D+1 (no GPS re-detect). No-op when the flag is null or D+1
 * is not sealed yet.
 */
export async function appendExcludedCrossMidnightTravel(
  dateKey: string,
  entries: readonly DayTimelineEntry[],
  materializedDay: MaterializedDayRow | null = null,
): Promise<DayTimelineEntry[]> {
  const dayMeta = materializedDay ?? (await getMaterializedDay(dateKey));
  const excludedMs = dayMeta?.excludedCrossMidnightFromMs;
  if (excludedMs == null || timelineAlreadyHasTravelStart(entries, excludedMs)) {
    return entries as DayTimelineEntry[];
  }

  const nextKey = shiftDateKey(dateKey, 1);
  const nextTrips = await listTripsForDay(nextKey);
  const travel = findExcludedCrossMidnightTravel(nextTrips, excludedMs);
  if (travel == null) {
    return entries as DayTimelineEntry[];
  }

  const route = await listTripPointsForTrip(travel.id);
  const points = locationPointsForTripRow(travel, route);
  const detected: DetectedTrip = tripRowToDetectedTripWithGeometry(
    travel,
    points,
    route,
  );

  // Overnight drive is almost always last on day D — avoid a full reorder.
  const travelStart = detected.startAt.getTime();
  const last = entries[entries.length - 1];
  if (last == null || last.startAt.getTime() <= travelStart) {
    return last == null ? [detected] : [...entries, detected];
  }

  const next: DayTimelineEntry[] = [];
  let inserted = false;
  for (const entry of entries) {
    if (!inserted && entry.startAt.getTime() > travelStart) {
      next.push(detected);
      inserted = true;
    }
    next.push(entry);
  }
  if (!inserted) {
    next.push(detected);
  }
  return next;
}
