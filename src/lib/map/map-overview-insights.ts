import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import type { TripRow } from '@/db/repositories/trips';
import { parseDateKey } from '@/lib/day-utils';
import { distanceKm } from '@/lib/location-geo';
import { APP_TIMEZONE } from '@/lib/timezone';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export type MapOverviewDrillKind =
  | 'home_stays_all'
  | 'home_stays_full_day'
  | 'home_stay_longest'
  | 'home_stay_shortest'
  | 'work_stays_all'
  | 'work_stay_longest'
  | 'work_stay_shortest'
  | 'work_commute_fastest'
  | 'work_commute_slowest'
  | 'work_commute_speed_min'
  | 'work_commute_speed_max'
  | 'work_weekday';

export type MapOverviewDrillRow = {
  id: string;
  tripId: number;
  title: string;
  subtitle: string;
  valueLabel: string;
  dateKey: string;
  startAtMs: number;
  endAtMs: number;
};

export type MapHomeOverview = {
  configured: boolean;
  label: string;
  totalMs: number;
  stayCount: number;
  fullDayStayCount: number;
  longestStayMs: number | null;
  shortestStayMs: number | null;
  avgStayMs: number | null;
};

export type MapWorkWeekdayCount = {
  weekday: number;
  label: string;
  count: number;
};

/** Work or favorite destination — stay + home→place commute stats. */
export type MapDestinationOverview = {
  configured: boolean;
  placeId: number | null;
  kind: 'work' | 'favorite';
  label: string;
  visitCount: number;
  totalMs: number;
  distanceFromHomeKm: number | null;
  commuteCount: number;
  commuteMinMs: number | null;
  commuteMaxMs: number | null;
  commuteAvgMs: number | null;
  stayMinMs: number | null;
  stayMaxMs: number | null;
  stayAvgMs: number | null;
  speedMinKmh: number | null;
  speedMaxKmh: number | null;
  speedAvgKmh: number | null;
  typicalArriveMinutes: number | null;
  typicalLeaveMinutes: number | null;
  weekdayCounts: MapWorkWeekdayCount[];
  commuteTravelIds: number[];
};

/** @deprecated Prefer MapDestinationOverview — same shape for work. */
export type MapWorkOverview = MapDestinationOverview;

export type MapOverviewInsights = {
  home: MapHomeOverview;
  work: MapDestinationOverview;
  favorites: MapDestinationOverview[];
};

type PlaceKind = 'home' | 'work' | 'favorite';

type CommuteEdge = {
  travel: TripRow;
  destStay: TripRow;
  speedKmh: number | null;
  destLabel: string;
};

function emptyDestination(
  kind: 'work' | 'favorite',
  label: string,
): MapDestinationOverview {
  return {
    configured: false,
    placeId: null,
    kind,
    label,
    visitCount: 0,
    totalMs: 0,
    distanceFromHomeKm: null,
    commuteCount: 0,
    commuteMinMs: null,
    commuteMaxMs: null,
    commuteAvgMs: null,
    stayMinMs: null,
    stayMaxMs: null,
    stayAvgMs: null,
    speedMinKmh: null,
    speedMaxKmh: null,
    speedAvgKmh: null,
    typicalArriveMinutes: null,
    typicalLeaveMinutes: null,
    weekdayCounts: [],
    commuteTravelIds: [],
  };
}

function isStayAtSavedPlace(trip: TripRow, placeId: number): boolean {
  return (
    trip.kind === 'stay' &&
    trip.placeKind === 'saved' &&
    trip.placeId === placeId
  );
}

function zoned(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE);
}

function localMinutesOf(date: Date): number {
  const z = zoned(date);
  return z.getHours() * 60 + z.getMinutes();
}

function localWeekday(date: Date): number {
  return zoned(date).getDay();
}

function median(values: readonly number[]): number | null {
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

function mean(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function stayKind(
  trip: TripRow,
  savedById: Map<number, SavedPlaceRow>,
): PlaceKind | null {
  if (trip.kind !== 'stay') {
    return null;
  }
  if (trip.placeKind !== 'saved' || trip.placeId == null) {
    return null;
  }
  const saved = savedById.get(trip.placeId);
  return saved?.kind ?? null;
}

function sortTrips(trips: readonly TripRow[]): TripRow[] {
  return trips.slice().sort((a, b) => {
    if (a.startAt.getTime() !== b.startAt.getTime()) {
      return a.startAt.getTime() - b.startAt.getTime();
    }
    return a.segmentOrder - b.segmentOrder;
  });
}

function tripAvgSpeedKmh(trip: TripRow): number | null {
  if (trip.durationMs <= 0 || trip.distanceKm <= 0) {
    return null;
  }
  const hours = trip.durationMs / 3_600_000;
  if (hours <= 0) {
    return null;
  }
  return trip.distanceKm / hours;
}

function formatDurationLabel(durationMs: number): string {
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

function formatStayRange(startAt: Date, endAt: Date): string {
  const start = format(zoned(startAt), 'MMM d · h:mm a');
  const end = format(zoned(endAt), 'h:mm a');
  return `${start} – ${end}`;
}

function stayDrillRow(trip: TripRow, title: string): MapOverviewDrillRow {
  return {
    id: `stay:${trip.id}`,
    tripId: trip.id,
    title,
    subtitle: formatStayRange(trip.startAt, trip.endAt),
    valueLabel: formatDurationLabel(trip.durationMs),
    dateKey: trip.dateKey,
    startAtMs: trip.startAt.getTime(),
    endAtMs: trip.endAt.getTime(),
  };
}

/** One row for a calendar day's total home time (summed segments). */
function homeDayDrillRow(
  stays: readonly TripRow[],
  dateKey: string,
  totalMs: number,
  title: string,
): MapOverviewDrillRow {
  const dayStays = stays
    .filter(stay => stay.dateKey === dateKey)
    .slice()
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const first = dayStays[0]!;
  const last = dayStays[dayStays.length - 1]!;
  const dayLabel = format(zoned(parseDateKey(dateKey)), 'MMM d');
  return {
    id: `home-day:${dateKey}`,
    tripId: first.id,
    title,
    subtitle: dayLabel,
    valueLabel: formatDurationLabel(totalMs),
    dateKey,
    startAtMs: first.startAt.getTime(),
    endAtMs: last.endAt.getTime(),
  };
}

/** Total home time per calendar day (sum of all home stay segments that day). */
function homeTimeByDateKey(
  stays: readonly TripRow[],
  excludeDateKeys?: ReadonlySet<string>,
): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const stay of stays) {
    if (excludeDateKeys?.has(stay.dateKey)) {
      continue;
    }
    const ms = Math.max(0, stay.durationMs);
    byDay.set(stay.dateKey, (byDay.get(stay.dateKey) ?? 0) + ms);
  }
  return byDay;
}

/**
 * Days with a gray missing/gap bar on the timeline.
 * Incomplete coverage must not drive shortest-day-at-home.
 */
function incompleteLocationDateKeys(trips: readonly TripRow[]): Set<string> {
  const incomplete = new Set<string>();
  for (const trip of trips) {
    if (trip.kind === 'missing') {
      incomplete.add(trip.dateKey);
    }
  }
  return incomplete;
}

/** Date key with the least total home time; ties prefer the most recent day. */
function shortestHomeDayKey(
  stays: readonly TripRow[],
  excludeDateKeys: ReadonlySet<string>,
): string | null {
  const byDay = homeTimeByDateKey(stays, excludeDateKeys);
  if (byDay.size === 0) {
    return null;
  }
  let bestKey: string | null = null;
  let bestMs = Number.POSITIVE_INFINITY;
  for (const [dateKey, totalMs] of byDay) {
    if (
      totalMs < bestMs ||
      (totalMs === bestMs && (bestKey == null || dateKey > bestKey))
    ) {
      bestMs = totalMs;
      bestKey = dateKey;
    }
  }
  return bestKey;
}

function commuteDrillRow(edge: CommuteEdge): MapOverviewDrillRow {
  const speed =
    edge.speedKmh != null
      ? ` · ${edge.speedKmh < 10 ? edge.speedKmh.toFixed(1) : Math.round(edge.speedKmh)} km/h`
      : '';
  return {
    id: `commute:${edge.travel.id}`,
    tripId: edge.travel.id,
    title: `Home → ${edge.destLabel}`,
    subtitle: `${formatStayRange(edge.travel.startAt, edge.travel.endAt)}${speed}`,
    valueLabel: formatDurationLabel(edge.travel.durationMs),
    dateKey: edge.travel.dateKey,
    startAtMs: edge.travel.startAt.getTime(),
    endAtMs: edge.travel.endAt.getTime(),
  };
}

/**
 * Home → travel → destination only. Travels from other places are ignored
 * for fastest/slowest/average commute stats.
 */
function collectCommutesToPlace(
  sorted: readonly TripRow[],
  savedById: Map<number, SavedPlaceRow>,
  destPlaceId: number,
  destLabel: string,
): CommuteEdge[] {
  const edges: CommuteEdge[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const trip = sorted[i]!;
    if (trip.kind !== 'travel') {
      continue;
    }
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    if (prev == null || stayKind(prev, savedById) !== 'home') {
      continue;
    }
    if (next == null || !isStayAtSavedPlace(next, destPlaceId)) {
      continue;
    }
    edges.push({
      travel: trip,
      destStay: next,
      speedKmh: tripAvgSpeedKmh(trip),
      destLabel,
    });
  }
  return edges;
}

function buildHomeOverview(
  stays: readonly TripRow[],
  home: SavedPlaceRow | undefined,
  incompleteDateKeys: ReadonlySet<string>,
): MapHomeOverview {
  if (home == null) {
    return {
      configured: false,
      label: 'Home',
      totalMs: 0,
      stayCount: 0,
      fullDayStayCount: 0,
      longestStayMs: null,
      shortestStayMs: null,
      avgStayMs: null,
    };
  }

  const durations = stays.map(stay => Math.max(0, stay.durationMs));
  const totalMs = durations.reduce((sum, ms) => sum + ms, 0);
  // Shortest day: only complete days (no gray missing/gap bar).
  const dailyTotals = [
    ...homeTimeByDateKey(stays, incompleteDateKeys).values(),
  ];
  return {
    configured: true,
    label: home.label.trim() || 'Home',
    totalMs,
    stayCount: stays.length,
    fullDayStayCount: durations.filter(ms => ms >= DAY_MS).length,
    longestStayMs: durations.length > 0 ? Math.max(...durations) : null,
    shortestStayMs:
      dailyTotals.length > 0 ? Math.min(...dailyTotals) : null,
    avgStayMs: mean(durations) != null ? Math.round(mean(durations)!) : null,
  };
}

function buildDestinationOverview(
  trips: readonly TripRow[],
  savedById: Map<number, SavedPlaceRow>,
  home: SavedPlaceRow | undefined,
  place: SavedPlaceRow,
  gpsTopSpeedMs: number | null,
): MapDestinationOverview {
  const kind = place.kind === 'work' ? 'work' : 'favorite';
  const label =
    place.label.trim() || (kind === 'work' ? 'Work' : 'Saved place');
  const sorted = sortTrips(trips);
  const stays = sorted.filter(trip => isStayAtSavedPlace(trip, place.id));
  const stayDurations = stays.map(stay => Math.max(0, stay.durationMs));
  const totalMs = stayDurations.reduce((sum, ms) => sum + ms, 0);
  const commutes = collectCommutesToPlace(sorted, savedById, place.id, label);
  const commuteDurations = commutes.map(edge =>
    Math.max(0, edge.travel.durationMs),
  );
  const commuteSpeedsKmh = commutes
    .map(edge => edge.speedKmh)
    .filter((speed): speed is number => speed != null && Number.isFinite(speed));

  const arriveMinutes = stays.map(stay => localMinutesOf(stay.startAt));
  const leaveMinutes = stays.map(stay => localMinutesOf(stay.endAt));
  const weekdayTally = new Map<number, number>();
  for (const stay of stays) {
    const day = localWeekday(stay.startAt);
    weekdayTally.set(day, (weekdayTally.get(day) ?? 0) + 1);
  }

  const distanceFromHomeKm =
    home != null
      ? distanceKm(
          { lat: home.lat, lng: home.lng },
          { lat: place.lat, lng: place.lng },
        )
      : null;

  const gpsTopKmh =
    gpsTopSpeedMs != null && gpsTopSpeedMs >= 0
      ? gpsTopSpeedMs * 3.6
      : null;
  const tripMaxKmh =
    commuteSpeedsKmh.length > 0 ? Math.max(...commuteSpeedsKmh) : null;

  const weekdayCounts: MapWorkWeekdayCount[] = [...weekdayTally.entries()]
    .map(([weekday, count]) => ({
      weekday,
      label: WEEKDAY_LABELS[weekday] ?? 'Day',
      count,
    }))
    .sort((a, b) => a.weekday - b.weekday);

  return {
    configured: true,
    placeId: place.id,
    kind,
    label,
    visitCount: stays.length,
    totalMs,
    distanceFromHomeKm,
    commuteCount: commuteDurations.length,
    commuteMinMs:
      commuteDurations.length > 0 ? Math.min(...commuteDurations) : null,
    commuteMaxMs:
      commuteDurations.length > 0 ? Math.max(...commuteDurations) : null,
    commuteAvgMs:
      mean(commuteDurations) != null
        ? Math.round(mean(commuteDurations)!)
        : null,
    stayMinMs: stayDurations.length > 0 ? Math.min(...stayDurations) : null,
    stayMaxMs: stayDurations.length > 0 ? Math.max(...stayDurations) : null,
    stayAvgMs:
      mean(stayDurations) != null ? Math.round(mean(stayDurations)!) : null,
    speedMinKmh:
      commuteSpeedsKmh.length > 0 ? Math.min(...commuteSpeedsKmh) : null,
    speedMaxKmh: gpsTopKmh ?? tripMaxKmh,
    speedAvgKmh: mean(commuteSpeedsKmh),
    typicalArriveMinutes: median(arriveMinutes),
    typicalLeaveMinutes: median(leaveMinutes),
    weekdayCounts,
    commuteTravelIds: commutes.map(edge => edge.travel.id),
  };
}

/**
 * All-time Home + Work + favorite overview insights from sealed trips.
 */
export function buildMapOverviewInsights(input: {
  trips: readonly TripRow[];
  savedPlaces: readonly SavedPlaceRow[];
  commuteGpsTopSpeedMs?: number | null;
}): MapOverviewInsights {
  const savedById = new Map(
    input.savedPlaces.map(place => [place.id, place] as const),
  );
  const home = input.savedPlaces.find(place => place.kind === 'home');
  const work = input.savedPlaces.find(place => place.kind === 'work');
  const favorites = input.savedPlaces.filter(place => place.kind === 'favorite');
  const sorted = sortTrips(input.trips);
  const homeStays = sorted.filter(
    trip => stayKind(trip, savedById) === 'home',
  );
  const incompleteDateKeys = incompleteLocationDateKeys(sorted);
  const gpsTop = input.commuteGpsTopSpeedMs ?? null;

  return {
    home: buildHomeOverview(homeStays, home, incompleteDateKeys),
    work:
      work != null
        ? buildDestinationOverview(sorted, savedById, home, work, gpsTop)
        : emptyDestination('work', 'Work'),
    favorites: favorites.map(place =>
      buildDestinationOverview(sorted, savedById, home, place, null),
    ),
  };
}

export function withCommuteGpsTopSpeed(
  overview: MapOverviewInsights,
  gpsTopSpeedMs: number | null,
): MapOverviewInsights {
  if (!overview.work.configured || gpsTopSpeedMs == null || gpsTopSpeedMs < 0) {
    return overview;
  }
  const gpsTopKmh = gpsTopSpeedMs * 3.6;
  const prevMax = overview.work.speedMaxKmh;
  return {
    ...overview,
    work: {
      ...overview.work,
      speedMaxKmh:
        prevMax == null ? gpsTopKmh : Math.max(prevMax, gpsTopKmh),
    },
  };
}

/**
 * Rows that justify a clickable overview metric.
 */
export function listMapOverviewDrillRows(input: {
  kind: MapOverviewDrillKind;
  trips: readonly TripRow[];
  savedPlaces: readonly SavedPlaceRow[];
  weekday?: number;
  /** When set, place drills use this saved place instead of Work. */
  placeId?: number;
}): MapOverviewDrillRow[] {
  const savedById = new Map(
    input.savedPlaces.map(place => [place.id, place] as const),
  );
  const sorted = sortTrips(input.trips);
  const homeStays = sorted.filter(
    trip => stayKind(trip, savedById) === 'home',
  );
  const workPlace =
    input.placeId != null
      ? savedById.get(input.placeId)
      : input.savedPlaces.find(place => place.kind === 'work');
  const destPlaceId = workPlace?.id ?? null;
  const destLabel =
    workPlace?.label.trim() ||
    (workPlace?.kind === 'favorite' ? 'Saved place' : 'Work');
  const destStays =
    destPlaceId != null
      ? sorted.filter(trip => isStayAtSavedPlace(trip, destPlaceId))
      : [];
  const commutes =
    destPlaceId != null
      ? collectCommutesToPlace(sorted, savedById, destPlaceId, destLabel)
      : [];
  const incompleteDateKeys = incompleteLocationDateKeys(sorted);

  switch (input.kind) {
    case 'home_stays_all':
      return homeStays
        .slice()
        .reverse()
        .map(stay => stayDrillRow(stay, 'At home'));
    case 'home_stays_full_day':
      return homeStays
        .filter(stay => stay.durationMs >= DAY_MS)
        .slice()
        .reverse()
        .map(stay => stayDrillRow(stay, '24 hour stay'));
    case 'home_stay_longest': {
      if (homeStays.length === 0) {
        return [];
      }
      const longest = homeStays.reduce((best, stay) =>
        stay.durationMs > best.durationMs ? stay : best,
      );
      return [stayDrillRow(longest, 'Longest home stay')];
    }
    case 'home_stay_shortest': {
      const byDay = homeTimeByDateKey(homeStays, incompleteDateKeys);
      const dayKey = shortestHomeDayKey(homeStays, incompleteDateKeys);
      if (dayKey == null) {
        return [];
      }
      const totalMs = byDay.get(dayKey);
      if (totalMs == null) {
        return [];
      }
      return [
        homeDayDrillRow(homeStays, dayKey, totalMs, 'Shortest day at home'),
      ];
    }
    case 'work_stays_all':
      return destStays
        .slice()
        .reverse()
        .map(stay => stayDrillRow(stay, `At ${destLabel}`));
    case 'work_stay_longest': {
      if (destStays.length === 0) {
        return [];
      }
      const longest = destStays.reduce((best, stay) =>
        stay.durationMs > best.durationMs ? stay : best,
      );
      return [stayDrillRow(longest, `Longest stay · ${destLabel}`)];
    }
    case 'work_stay_shortest': {
      if (destStays.length === 0) {
        return [];
      }
      const shortest = destStays.reduce((best, stay) =>
        stay.durationMs < best.durationMs ? stay : best,
      );
      return [stayDrillRow(shortest, `Shortest stay · ${destLabel}`)];
    }
    case 'work_commute_fastest': {
      if (commutes.length === 0) {
        return [];
      }
      const fastest = commutes.reduce((best, edge) =>
        edge.travel.durationMs < best.travel.durationMs ? edge : best,
      );
      return [commuteDrillRow(fastest)];
    }
    case 'work_commute_slowest': {
      if (commutes.length === 0) {
        return [];
      }
      const slowest = commutes.reduce((best, edge) =>
        edge.travel.durationMs > best.travel.durationMs ? edge : best,
      );
      return [commuteDrillRow(slowest)];
    }
    case 'work_commute_speed_min': {
      const withSpeed = commutes.filter(edge => edge.speedKmh != null);
      if (withSpeed.length === 0) {
        return [];
      }
      const slowest = withSpeed.reduce((best, edge) =>
        (edge.speedKmh ?? 0) < (best.speedKmh ?? 0) ? edge : best,
      );
      return [commuteDrillRow(slowest)];
    }
    case 'work_commute_speed_max': {
      const withSpeed = commutes.filter(edge => edge.speedKmh != null);
      if (withSpeed.length === 0) {
        return [];
      }
      const fastest = withSpeed.reduce((best, edge) =>
        (edge.speedKmh ?? 0) > (best.speedKmh ?? 0) ? edge : best,
      );
      return [commuteDrillRow(fastest)];
    }
    case 'work_weekday': {
      const weekday = input.weekday;
      if (weekday == null) {
        return [];
      }
      return destStays
        .filter(stay => localWeekday(stay.startAt) === weekday)
        .slice()
        .reverse()
        .map(stay =>
          stayDrillRow(stay, WEEKDAY_LABELS[weekday] ?? 'Visit'),
        );
    }
  }
}
