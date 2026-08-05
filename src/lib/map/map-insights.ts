import { TZDate } from '@date-fns/tz';

import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import type { TripRow } from '@/db/repositories/trips';
import { insightRangeBounds } from '@/lib/activities/activity-insights';
import {
  getDayRange,
  parseDateKey,
  shiftDateKey,
  toDateKey,
} from '@/lib/day-utils';
import { APP_TIMEZONE } from '@/lib/timezone';

export type MapInsightPeriod = 'today' | 'week' | 'month' | 'year';

export type MapPlaceTimeRow = {
  key: string;
  label: string;
  kind: 'home' | 'work' | 'favorite';
  /** Time shown for this place (home already has sleep subtracted when sleep is on). */
  durationMs: number;
  visitCount: number;
};

export type MapTopPlaceRow = {
  key: string;
  label: string;
  kind: 'poi' | 'other';
  durationMs: number;
  visitCount: number;
};

export type MapFrequentTravel = {
  key: string;
  fromLabel: string;
  toLabel: string;
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
};

export type MapNewPlaceRow = {
  key: string;
  label: string;
  visitCount: number;
  durationMs: number;
};

export type MapRhythmSummary = {
  /** Local minutes from midnight; null when fewer than 2 samples. */
  typicalLeaveHomeMinutes: number | null;
  typicalReturnHomeMinutes: number | null;
  leaveSampleCount: number;
  returnSampleCount: number;
};

export type MapPeriodComparison = {
  distanceKmDelta: number;
  homeMsDelta: number | null;
  daysWithDataDelta: number;
  nightsAwayDelta: number;
};

export type MapInsightsSummary = {
  period: MapInsightPeriod;
  startDateKey: string;
  endDateKey: string;
  daysWithData: number;
  distanceKm: number;
  nightsAway: number;
  /** Saved-place dwell rows: home, work, then favorites by time. */
  placeTimes: MapPlaceTimeRow[];
  /** Recurring / notable places beyond home & work (POIs, labeled, favorites). */
  topPlaces: MapTopPlaceRow[];
  sleepEnabled: boolean;
  /** Sleep overlapping home stays; only set when sleep is enabled. */
  sleepMs: number;
  frequentTravels: MapFrequentTravel[];
  rhythm: MapRhythmSummary;
  /** Places visited in this period that were not seen in the lookback history. */
  newPlaces: MapNewPlaceRow[];
  comparison: MapPeriodComparison;
};

type PlaceIdentity = {
  key: string;
  label: string;
  kind: 'home' | 'work' | 'favorite' | 'poi' | 'other';
};

type PlaceAgg = {
  label: string;
  kind: PlaceIdentity['kind'];
  durationMs: number;
  visitCount: number;
};

const NEW_PLACE_LOOKBACK_DAYS = 365;
const RHYTHM_MIN_SAMPLES = 2;
const TOP_PLACES_LIMIT = 12;
const NEW_PLACES_LIMIT = 10;

export function mapInsightPeriodBounds(
  period: MapInsightPeriod,
  now: Date = new Date(),
): { startDateKey: string; endDateKey: string; start: Date; end: Date } {
  const { start, end } = insightRangeBounds(period, now);
  const rangeStart = start ?? end;
  return {
    startDateKey: toDateKey(rangeStart),
    endDateKey: toDateKey(end),
    start: rangeStart,
    end,
  };
}

/** Same-length window ending the day before `startDateKey`. */
export function mapInsightPreviousBoundsForRange(
  startDateKey: string,
  endDateKey: string,
): { startDateKey: string; endDateKey: string; start: Date; end: Date } {
  const dayCount =
    Math.round(
      (parseDateKey(endDateKey).getTime() -
        parseDateKey(startDateKey).getTime()) /
        86_400_000,
    ) + 1;
  const prevEndDateKey = shiftDateKey(startDateKey, -1);
  const prevStartDateKey = shiftDateKey(prevEndDateKey, -(dayCount - 1));
  return {
    startDateKey: prevStartDateKey,
    endDateKey: prevEndDateKey,
    start: getDayRange(prevStartDateKey).start,
    end: getDayRange(prevEndDateKey).end,
  };
}

/** @deprecated Prefer mapInsightPreviousBoundsForRange with an explicit range. */
export function mapInsightPreviousPeriodBounds(
  period: MapInsightPeriod,
  now: Date = new Date(),
): { startDateKey: string; endDateKey: string; start: Date; end: Date } {
  const current = mapInsightPeriodBounds(period, now);
  return mapInsightPreviousBoundsForRange(
    current.startDateKey,
    current.endDateKey,
  );
}

/** Earliest date key to fetch so new-place + comparison math has history. */
export function mapInsightFetchStartForRange(
  startDateKey: string,
  endDateKey: string,
): string {
  const previous = mapInsightPreviousBoundsForRange(startDateKey, endDateKey);
  const lookback = shiftDateKey(startDateKey, -NEW_PLACE_LOOKBACK_DAYS);
  return lookback < previous.startDateKey ? lookback : previous.startDateKey;
}

/** @deprecated Prefer mapInsightFetchStartForRange with an explicit range. */
export function mapInsightFetchStartDateKey(
  period: MapInsightPeriod,
  now: Date = new Date(),
): string {
  const current = mapInsightPeriodBounds(period, now);
  return mapInsightFetchStartForRange(
    current.startDateKey,
    current.endDateKey,
  );
}

function overlapMs(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start);
}

function placeIdentity(
  trip: TripRow,
  savedById: Map<number, SavedPlaceRow>,
): PlaceIdentity | null {
  if (trip.kind !== 'stay') {
    return null;
  }
  if (trip.placeKind === 'saved' && trip.placeId != null) {
    const saved = savedById.get(trip.placeId);
    if (saved != null) {
      return {
        key: `saved:${saved.id}`,
        label: saved.label,
        kind: saved.kind,
      };
    }
    const label = trip.placeLabel?.trim();
    if (label) {
      return { key: `saved:${trip.placeId}`, label, kind: 'favorite' };
    }
  }
  if (trip.poiId != null) {
    const label =
      trip.poiLabel?.trim() || trip.placeLabel?.trim() || 'Place';
    return { key: `poi:${trip.poiId}`, label, kind: 'poi' };
  }
  const label = trip.placeLabel?.trim();
  if (label) {
    return { key: `label:${label.toLowerCase()}`, label, kind: 'other' };
  }
  return null;
}

function stayIdentityForTravelEdge(
  trip: TripRow | null | undefined,
  savedById: Map<number, SavedPlaceRow>,
): PlaceIdentity | null {
  if (trip == null || trip.kind !== 'stay') {
    return null;
  }
  return placeIdentity(trip, savedById);
}

function isHomeIdentity(identity: PlaceIdentity | null): boolean {
  return identity?.kind === 'home';
}

function sortTrips(trips: readonly TripRow[]): TripRow[] {
  return trips.slice().sort((a, b) => {
    if (a.startAt.getTime() !== b.startAt.getTime()) {
      return a.startAt.getTime() - b.startAt.getTime();
    }
    return a.segmentOrder - b.segmentOrder;
  });
}

function filterTripsInRange(
  trips: readonly TripRow[],
  startDateKey: string,
  endDateKey: string,
): TripRow[] {
  return sortTrips(
    trips.filter(
      trip => trip.dateKey >= startDateKey && trip.dateKey <= endDateKey,
    ),
  );
}

function localMinutesOf(date: Date): number {
  const zoned = new TZDate(date, APP_TIMEZONE);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

function medianMinutes(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function aggregatePlaceStays(
  stays: readonly TripRow[],
  savedById: Map<number, SavedPlaceRow>,
): Map<string, PlaceAgg> {
  const agg = new Map<string, PlaceAgg>();
  for (const trip of stays) {
    if (trip.kind !== 'stay') {
      continue;
    }
    const identity = placeIdentity(trip, savedById);
    if (identity == null) {
      continue;
    }
    const prev = agg.get(identity.key);
    if (prev == null) {
      agg.set(identity.key, {
        label: identity.label,
        kind: identity.kind,
        durationMs: trip.durationMs,
        visitCount: 1,
      });
    } else {
      prev.durationMs += trip.durationMs;
      prev.visitCount += 1;
    }
  }
  return agg;
}

function sleepOverlapMs(
  homeStays: readonly TripRow[],
  sleepSessions: readonly { startAt: Date; endAt: Date }[],
): number {
  let sleepMs = 0;
  for (const trip of homeStays) {
    for (const session of sleepSessions) {
      sleepMs += overlapMs(
        trip.startAt,
        trip.endAt,
        session.startAt,
        session.endAt,
      );
    }
  }
  return sleepMs;
}

function buildSavedPlaceTimes(
  placeAgg: Map<string, PlaceAgg>,
  sleepEnabled: boolean,
  sleepMs: number,
): MapPlaceTimeRow[] {
  return [...placeAgg.entries()]
    .filter(
      ([, value]) =>
        value.kind === 'home' ||
        value.kind === 'work' ||
        value.kind === 'favorite',
    )
    .map(([key, value]) => {
      let durationMs = value.durationMs;
      if (sleepEnabled && value.kind === 'home') {
        durationMs = Math.max(0, durationMs - sleepMs);
      }
      return {
        key,
        label: value.label,
        kind: value.kind as MapPlaceTimeRow['kind'],
        durationMs,
        visitCount: value.visitCount,
      };
    })
    .sort((a, b) => {
      const rank = (kind: MapPlaceTimeRow['kind']) =>
        kind === 'home' ? 0 : kind === 'work' ? 1 : 2;
      const rankDiff = rank(a.kind) - rank(b.kind);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      if (b.durationMs !== a.durationMs) {
        return b.durationMs - a.durationMs;
      }
      return a.label.localeCompare(b.label);
    });
}

function buildTopPlaces(
  placeAgg: Map<string, PlaceAgg>,
  limit: number,
): MapTopPlaceRow[] {
  return [...placeAgg.entries()]
    .filter(([, value]) => value.kind === 'poi' || value.kind === 'other')
    .map(([key, value]) => ({
      key,
      label: value.label,
      kind: value.kind as MapTopPlaceRow['kind'],
      durationMs: value.durationMs,
      visitCount: value.visitCount,
    }))
    .sort((a, b) => {
      if (b.durationMs !== a.durationMs) {
        return b.durationMs - a.durationMs;
      }
      if (b.visitCount !== a.visitCount) {
        return b.visitCount - a.visitCount;
      }
      return a.label.localeCompare(b.label);
    })
    .slice(0, limit);
}

function buildFrequentTravels(
  inRange: readonly TripRow[],
  savedById: Map<number, SavedPlaceRow>,
  travelLimit: number,
): MapFrequentTravel[] {
  const travelAgg = new Map<
    string,
    { fromLabel: string; toLabel: string; durations: number[] }
  >();

  for (let i = 0; i < inRange.length; i++) {
    const trip = inRange[i]!;
    if (trip.kind !== 'travel') {
      continue;
    }
    const from = stayIdentityForTravelEdge(inRange[i - 1], savedById);
    const to = stayIdentityForTravelEdge(inRange[i + 1], savedById);
    if (from == null || to == null) {
      continue;
    }
    const key = `${from.key}->${to.key}`;
    const prev = travelAgg.get(key);
    if (prev == null) {
      travelAgg.set(key, {
        fromLabel: from.label,
        toLabel: to.label,
        durations: [trip.durationMs],
      });
    } else {
      prev.durations.push(trip.durationMs);
    }
  }

  return [...travelAgg.entries()]
    .map(([key, value]) => {
      const count = value.durations.length;
      const total = value.durations.reduce((sum, ms) => sum + ms, 0);
      return {
        key,
        fromLabel: value.fromLabel,
        toLabel: value.toLabel,
        count,
        avgMs: Math.round(total / count),
        minMs: Math.min(...value.durations),
        maxMs: Math.max(...value.durations),
      };
    })
    .filter(row => row.count >= 2)
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.fromLabel.localeCompare(b.fromLabel);
    })
    .slice(0, travelLimit);
}

function buildRhythm(
  inRange: readonly TripRow[],
  savedById: Map<number, SavedPlaceRow>,
): MapRhythmSummary {
  const leaveMinutes: number[] = [];
  const returnMinutes: number[] = [];

  for (let i = 0; i < inRange.length; i++) {
    const trip = inRange[i]!;
    if (trip.kind !== 'travel') {
      continue;
    }
    const from = stayIdentityForTravelEdge(inRange[i - 1], savedById);
    const to = stayIdentityForTravelEdge(inRange[i + 1], savedById);
    if (isHomeIdentity(from)) {
      leaveMinutes.push(localMinutesOf(trip.startAt));
    }
    if (isHomeIdentity(to)) {
      returnMinutes.push(localMinutesOf(trip.endAt));
    }
  }

  return {
    typicalLeaveHomeMinutes:
      leaveMinutes.length >= RHYTHM_MIN_SAMPLES
        ? medianMinutes(leaveMinutes)
        : null,
    typicalReturnHomeMinutes:
      returnMinutes.length >= RHYTHM_MIN_SAMPLES
        ? medianMinutes(returnMinutes)
        : null,
    leaveSampleCount: leaveMinutes.length,
    returnSampleCount: returnMinutes.length,
  };
}

/**
 * Nights where something was recorded at local midnight but home did not
 * cover that midnight.
 */
function countNightsAway(
  inRange: readonly TripRow[],
  savedById: Map<number, SavedPlaceRow>,
  startDateKey: string,
  endDateKey: string,
): number {
  let away = 0;
  let dateKey = startDateKey;
  while (dateKey < endDateKey) {
    const midnight = parseDateKey(shiftDateKey(dateKey, 1));
    const midnightMs = midnight.getTime();
    let homeCovers = false;
    let dataCovers = false;
    for (const trip of inRange) {
      if (
        trip.startAt.getTime() > midnightMs ||
        trip.endAt.getTime() <= midnightMs
      ) {
        continue;
      }
      dataCovers = true;
      if (trip.kind === 'stay' && isHomeIdentity(placeIdentity(trip, savedById))) {
        homeCovers = true;
        break;
      }
    }
    if (dataCovers && !homeCovers) {
      away += 1;
    }
    dateKey = shiftDateKey(dateKey, 1);
  }
  return away;
}

function pulseForRange(
  inRange: readonly TripRow[],
  savedById: Map<number, SavedPlaceRow>,
  startDateKey: string,
  endDateKey: string,
  sleepEnabled: boolean,
  sleepSessions: readonly { startAt: Date; endAt: Date }[],
): {
  daysWithData: number;
  distanceKm: number;
  nightsAway: number;
  homeMs: number | null;
} {
  const daysWithData = new Set<string>();
  let distanceKm = 0;
  const homeStays: TripRow[] = [];

  for (const trip of inRange) {
    daysWithData.add(trip.dateKey);
    if (trip.kind === 'travel') {
      distanceKm += Math.max(0, trip.distanceKm);
      continue;
    }
    if (trip.kind !== 'stay') {
      continue;
    }
    if (isHomeIdentity(placeIdentity(trip, savedById))) {
      homeStays.push(trip);
    }
  }

  let homeMs: number | null =
    homeStays.length > 0
      ? homeStays.reduce((sum, trip) => sum + trip.durationMs, 0)
      : null;

  if (homeMs != null && sleepEnabled) {
    const sleepMs = Math.min(sleepOverlapMs(homeStays, sleepSessions), homeMs);
    homeMs = Math.max(0, homeMs - sleepMs);
  }

  return {
    daysWithData: daysWithData.size,
    distanceKm,
    nightsAway: countNightsAway(
      inRange,
      savedById,
      startDateKey,
      endDateKey,
    ),
    homeMs,
  };
}

/**
 * Aggregate sealed trips into a dense map-insights summary: pulse, places,
 * routes, rhythm, new places, and vs-previous-period deltas.
 */
export function buildMapInsightsSummary(input: {
  trips: readonly TripRow[];
  savedPlaces: readonly SavedPlaceRow[];
  period: MapInsightPeriod;
  /** Explicit selected range; defaults to current period through `now`. */
  range?: { startDateKey: string; endDateKey: string };
  now?: Date;
  sleepEnabled?: boolean;
  sleepSessions?: readonly { startAt: Date; endAt: Date }[];
  travelLimit?: number;
  topPlacesLimit?: number;
  newPlacesLimit?: number;
}): MapInsightsSummary {
  const now = input.now ?? new Date();
  const sleepEnabled = input.sleepEnabled === true;
  const sleepSessions = input.sleepSessions ?? [];
  const travelLimit = input.travelLimit ?? 8;
  const topPlacesLimit = input.topPlacesLimit ?? TOP_PLACES_LIMIT;
  const newPlacesLimit = input.newPlacesLimit ?? NEW_PLACES_LIMIT;

  const defaultBounds = mapInsightPeriodBounds(input.period, now);
  const currentBounds =
    input.range != null
      ? {
          startDateKey: input.range.startDateKey,
          endDateKey: input.range.endDateKey,
          start: getDayRange(input.range.startDateKey).start,
          end: getDayRange(input.range.endDateKey).end,
        }
      : defaultBounds;
  const previousBounds = mapInsightPreviousBoundsForRange(
    currentBounds.startDateKey,
    currentBounds.endDateKey,
  );
  const savedById = new Map(
    input.savedPlaces.map(place => [place.id, place] as const),
  );

  const inRange = filterTripsInRange(
    input.trips,
    currentBounds.startDateKey,
    currentBounds.endDateKey,
  );
  const previousRange = filterTripsInRange(
    input.trips,
    previousBounds.startDateKey,
    previousBounds.endDateKey,
  );

  const placeAgg = aggregatePlaceStays(inRange, savedById);

  const homeStays = inRange.filter(
    trip =>
      trip.kind === 'stay' && isHomeIdentity(placeIdentity(trip, savedById)),
  );
  let sleepMs = sleepEnabled
    ? sleepOverlapMs(homeStays, sleepSessions)
    : 0;
  const homeRaw = homeStays.reduce((sum, trip) => sum + trip.durationMs, 0);
  sleepMs = Math.min(sleepMs, homeRaw);

  const placeTimes = buildSavedPlaceTimes(placeAgg, sleepEnabled, sleepMs);
  const topPlaces = buildTopPlaces(placeAgg, topPlacesLimit);
  const frequentTravels = buildFrequentTravels(
    inRange,
    savedById,
    travelLimit,
  );
  const rhythm = buildRhythm(inRange, savedById);

  const currentPulse = pulseForRange(
    inRange,
    savedById,
    currentBounds.startDateKey,
    currentBounds.endDateKey,
    sleepEnabled,
    sleepSessions,
  );
  const previousPulse = pulseForRange(
    previousRange,
    savedById,
    previousBounds.startDateKey,
    previousBounds.endDateKey,
    false,
    [],
  );

  const historyKeys = new Set<string>();
  for (const trip of input.trips) {
    if (trip.kind !== 'stay' || trip.dateKey >= currentBounds.startDateKey) {
      continue;
    }
    const identity = placeIdentity(trip, savedById);
    if (identity != null) {
      historyKeys.add(identity.key);
    }
  }

  const newPlaces: MapNewPlaceRow[] = [...placeAgg.entries()]
    .filter(([key]) => !historyKeys.has(key))
    .map(([key, value]) => ({
      key,
      label: value.label,
      visitCount: value.visitCount,
      durationMs: value.durationMs,
    }))
    .sort((a, b) => {
      if (b.durationMs !== a.durationMs) {
        return b.durationMs - a.durationMs;
      }
      return a.label.localeCompare(b.label);
    })
    .slice(0, newPlacesLimit);

  const homeMs =
    placeTimes.find(row => row.kind === 'home')?.durationMs ?? null;
  const previousHomeMs = previousPulse.homeMs;

  return {
    period: input.period,
    startDateKey: currentBounds.startDateKey,
    endDateKey: currentBounds.endDateKey,
    daysWithData: currentPulse.daysWithData,
    distanceKm: currentPulse.distanceKm,
    nightsAway: currentPulse.nightsAway,
    placeTimes,
    topPlaces,
    sleepEnabled,
    sleepMs: sleepEnabled ? sleepMs : 0,
    frequentTravels,
    rhythm,
    newPlaces,
    comparison: {
      distanceKmDelta: currentPulse.distanceKm - previousPulse.distanceKm,
      homeMsDelta:
        homeMs != null && previousHomeMs != null
          ? homeMs - previousHomeMs
          : homeMs != null && previousHomeMs == null
            ? homeMs
            : null,
      daysWithDataDelta:
        currentPulse.daysWithData - previousPulse.daysWithData,
      nightsAwayDelta: currentPulse.nightsAway - previousPulse.nightsAway,
    },
  };
}
