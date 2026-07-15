import type { MaterializedDayRow } from '@/db/repositories/materialized-days';
import { getMaterializedDay } from '@/db/repositories/materialized-days';
import { listTripPointsForTrip } from '@/db/repositories/trip-points';
import { listTripsForDay, type TripRow } from '@/db/repositories/trips';
import { shiftDateKey, toDateKey } from '@/lib/day-utils';
import {
  locationPointsForTripRow,
  tripRowToDetectedTripWithGeometry,
} from '@/lib/trip-geometry';
import {
  isPlayableTimelineEntry,
  stayBeforeEntryIndex,
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

/** First stay at/after travel end — arrival for From→To on the start day. */
export function findStayAfterTravel(
  trips: readonly TripRow[],
  travel: Pick<TripRow, 'endAt'>,
): TripRow | null {
  const minStartMs = travel.endAt.getTime() - 60_000;
  let best: TripRow | null = null;
  for (const trip of trips) {
    if (trip.kind !== 'stay') {
      continue;
    }
    const startMs = trip.startAt.getTime();
    if (startMs < minStartMs) {
      continue;
    }
    if (best == null || startMs < best.startAt.getTime()) {
      best = trip;
    }
  }
  return best;
}

/** Last stay at/before travel start — departure for From→To on the end day. */
export function findStayBeforeTravel(
  trips: readonly TripRow[],
  travel: Pick<TripRow, 'startAt'>,
): TripRow | null {
  const maxEndMs = travel.startAt.getTime() + 60_000;
  let best: TripRow | null = null;
  for (const trip of trips) {
    if (trip.kind !== 'stay') {
      continue;
    }
    const endMs = trip.endAt.getTime();
    if (endMs > maxEndMs) {
      continue;
    }
    if (best == null || endMs > best.endAt.getTime()) {
      best = trip;
    }
  }
  return best;
}

/** Place fields only — enough for drive endpoint labels / edit sheet. */
export function tripRowToLabelStay(row: TripRow): DetectedTrip {
  return tripRowToDetectedTripWithGeometry(row, []);
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

function insertChronologically(
  entries: readonly DayTimelineEntry[],
  detected: DetectedTrip,
): DayTimelineEntry[] {
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

/**
 * Display-only: when day D sealed away an overnight drive, borrow that travel
 * from D+1 by exact start ms (no GPS re-detect). Same next-day trip list also
 * supplies the arrival stay for the To label. No-op when the flag is null or
 * D+1 does not yet have that travel row.
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
  const arrival = findStayAfterTravel(nextTrips, travel);
  const detected: DetectedTrip = {
    ...tripRowToDetectedTripWithGeometry(travel, points, route),
    crossDayLabelStayNext: arrival ? tripRowToLabelStay(arrival) : undefined,
  };

  return insertChronologically(entries, detected);
}

/**
 * End day of an overnight drive: one previous-day trips read to attach the
 * departure stay for the From label when this day has no stay before the travel.
 */
export async function attachCrossMidnightDepartureLabelStays(
  dateKey: string,
  entries: readonly DayTimelineEntry[],
): Promise<DayTimelineEntry[]> {
  const overnightIndexes: number[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    if (
      !isPlayableTimelineEntry(entry) ||
      entry.kind !== 'travel' ||
      toDateKey(entry.startAt) === dateKey ||
      entry.crossDayLabelStayPrevious != null ||
      stayBeforeEntryIndex(entries, index) != null
    ) {
      continue;
    }
    overnightIndexes.push(index);
  }
  if (overnightIndexes.length === 0) {
    return entries as DayTimelineEntry[];
  }

  const prevTrips = await listTripsForDay(shiftDateKey(dateKey, -1));
  if (prevTrips.length === 0) {
    return entries as DayTimelineEntry[];
  }

  const next = entries.slice() as DayTimelineEntry[];
  for (const index of overnightIndexes) {
    const travel = next[index] as DetectedTrip;
    const departure = findStayBeforeTravel(prevTrips, travel);
    if (departure == null) {
      continue;
    }
    next[index] = {
      ...travel,
      crossDayLabelStayPrevious: tripRowToLabelStay(departure),
    };
  }
  return next;
}
