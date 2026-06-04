import {and, asc, desc, gte, lte} from 'drizzle-orm';
import {format} from 'date-fns';

import {calculatePathDistanceKm} from '@/lib/location-geo';
import {getDayRange, parseDateKey, toDateKey} from '@/lib/day-utils';

import {getDatabase} from '../client';
import {locationPoints} from '../schema';

export type LocationPointRow = typeof locationPoints.$inferSelect;

export type DaySummary = {
  dateKey: string;
  pointCount: number;
  firstAt: Date | null;
  lastAt: Date | null;
  distanceKm: number;
};

function buildSummariesFromRows(rows: LocationPointRow[]): DaySummary[] {
  const byDay = new Map<string, LocationPointRow[]>();

  for (const row of rows) {
    const key = toDateKey(row.timestamp);
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      byDay.set(key, [row]);
    }
  }

  return Array.from(byDay.entries())
    .map(([dateKey, dayPoints]) => {
      const sorted = [...dayPoints].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );
      return {
        dateKey,
        pointCount: sorted.length,
        firstAt: sorted[0]?.timestamp ?? null,
        lastAt: sorted[sorted.length - 1]?.timestamp ?? null,
        distanceKm: calculatePathDistanceKm(sorted),
      };
    })
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

export async function getLocationPointsForDay(dateKey: string): Promise<LocationPointRow[]> {
  const {start, end} = getDayRange(dateKey);
  return getLocationPointsInRange(start, end);
}

export async function getLocationPointsInRange(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<LocationPointRow[]> {
  const db = await getDatabase();

  return db
    .select()
    .from(locationPoints)
    .where(
      and(
        gte(locationPoints.timestamp, rangeStart),
        lte(locationPoints.timestamp, rangeEnd),
      ),
    )
    .orderBy(asc(locationPoints.timestamp));
}

export async function getAllLocationPoints(): Promise<LocationPointRow[]> {
  const db = await getDatabase();
  return db.select().from(locationPoints).orderBy(asc(locationPoints.timestamp));
}

export async function getDaySummaries(): Promise<DaySummary[]> {
  const rows = await getAllLocationPoints();
  return buildSummariesFromRows(rows);
}

export async function getHistoricalOnThisDaySummaries(
  referenceDate: Date = new Date(),
): Promise<DaySummary[]> {
  const monthDay = format(referenceDate, 'MM-dd');
  const currentYear = format(referenceDate, 'yyyy');
  const rows = await getAllLocationPoints();

  const filtered = rows.filter(row => {
    const key = format(row.timestamp, 'MM-dd');
    const year = format(row.timestamp, 'yyyy');
    return key === monthDay && year !== currentYear;
  });

  return buildSummariesFromRows(filtered);
}

export type HomeLocationData = {
  daySummaries: DaySummary[];
  todayPoints: LocationPointRow[];
  onThisDaySummaries: DaySummary[];
};

/** Single DB read for the Home tab. */
export async function getHomeLocationData(todayKey: string): Promise<HomeLocationData> {
  const rows = await getAllLocationPoints();
  const {start, end} = getDayRange(todayKey);
  const referenceDate = parseDateKey(todayKey);
  const monthDay = format(referenceDate, 'MM-dd');
  const currentYear = format(referenceDate, 'yyyy');

  const todayPoints = rows.filter(
    point => point.timestamp >= start && point.timestamp <= end,
  );
  const onThisDayRows = rows.filter(row => {
    return (
      format(row.timestamp, 'MM-dd') === monthDay &&
      format(row.timestamp, 'yyyy') !== currentYear
    );
  });

  return {
    daySummaries: buildSummariesFromRows(rows),
    todayPoints,
    onThisDaySummaries: buildSummariesFromRows(onThisDayRows),
  };
}
