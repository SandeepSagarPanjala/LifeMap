import { eq, gte, sql } from 'drizzle-orm';
import type { Database } from '@/db/client';
import { locationPoints, settings } from '@/db/schema';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { MIN_VALID_LOCATION_DATE_KEY } from '@/lib/app-constants';
import { getTodayDateKey, parseDateKey, toDateKey } from '@/lib/day-utils';
import { locationPointTimestampFromStorageValue } from '@/lib/location-point-storage';
import { useAppStore } from '@/stores/app-store';

/** Calendar floor — stamped once when the DB is first created. */
export const SETTINGS_KEY_APP_START_DATE = 'app_start_date_key';

/** Legacy key — migrated into app start date when present. */
const SETTINGS_KEY_HISTORY_EARLIEST_DATE = 'history_earliest_date_key';

let boundsPromise: Promise<string> | null = null;

async function readSettingWithDb(
  db: Database,
  key: string,
): Promise<string | null> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  const value = rows[0]?.value;
  return value != null && value.length > 0 ? value : null;
}

async function writeSettingWithDb(
  db: Database,
  key: string,
  value: string,
): Promise<void> {
  const existing = await db
    .select({ id: settings.id })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  if (existing[0]) {
    await db.update(settings).set({ value }).where(eq(settings.key, key));
    return;
  }
  await db.insert(settings).values({ key, value });
}

async function persistAppStartDateKeyWithDb(
  db: Database,
  dateKey: string,
): Promise<string> {
  await writeSettingWithDb(db, SETTINGS_KEY_APP_START_DATE, dateKey);
  await writeSettingWithDb(db, SETTINGS_KEY_HISTORY_EARLIEST_DATE, dateKey);
  useAppStore.getState().setHistoryEarliestDateKey(dateKey);
  return dateKey;
}

async function persistAppStartDateKey(dateKey: string): Promise<string> {
  await setSetting(SETTINGS_KEY_APP_START_DATE, dateKey);
  await setSetting(SETTINGS_KEY_HISTORY_EARLIEST_DATE, dateKey);
  useAppStore.getState().setHistoryEarliestDateKey(dateKey);
  return dateKey;
}

/** Query earliest GPS day using the open drizzle handle (safe during DB init). */
async function earliestLocationDateKeyWithDb(
  db: Database,
): Promise<string | null> {
  const floor = parseDateKey(MIN_VALID_LOCATION_DATE_KEY);
  const [row] = await db
    .select({ timestamp: sql<unknown>`min(${locationPoints.timestamp})` })
    .from(locationPoints)
    .where(gte(locationPoints.timestamp, floor));
  const at = locationPointTimestampFromStorageValue(row?.timestamp);
  if (at == null) {
    return null;
  }
  const dateKey = toDateKey(at);
  // Never accept epoch junk even if a raw aggregate mis-coerces.
  return dateKey < MIN_VALID_LOCATION_DATE_KEY ? null : dateKey;
}

/**
 * Called from DB init after migrations — the only place that creates the
 * install-day stamp for a brand-new database.
 *
 * - Fresh DB (no tables before migrate): write today's dateKey.
 * - Existing DB upgrading: keep app_start / migrate legacy / else earliest GPS.
 */
export async function ensureAppStartDateAtDatabaseInit(
  db: Database,
  options: { virginDatabase: boolean },
): Promise<string> {
  const existing = await readSettingWithDb(db, SETTINGS_KEY_APP_START_DATE);
  if (existing != null) {
    useAppStore.getState().setHistoryEarliestDateKey(existing);
    return existing;
  }

  if (options.virginDatabase) {
    return persistAppStartDateKeyWithDb(db, getTodayDateKey());
  }

  const legacy = await readSettingWithDb(db, SETTINGS_KEY_HISTORY_EARLIEST_DATE);
  if (legacy != null) {
    return persistAppStartDateKeyWithDb(db, legacy);
  }

  const fromGps = await earliestLocationDateKeyWithDb(db);
  return persistAppStartDateKeyWithDb(db, fromGps ?? getTodayDateKey());
}

/**
 * Load app-start floor into memory. Does not invent an install day — that is
 * stamped in `ensureAppStartDateAtDatabaseInit` when the DB is created.
 */
export async function ensureHistoryCalendarBounds(): Promise<string> {
  const cached = useAppStore.getState().historyEarliestDateKey;
  if (cached != null) {
    return cached;
  }

  if (boundsPromise != null) {
    return boundsPromise;
  }

  boundsPromise = (async () => {
    const appStart = await getSetting(SETTINGS_KEY_APP_START_DATE);
    if (appStart != null && appStart.length > 0) {
      useAppStore.getState().setHistoryEarliestDateKey(appStart);
      return appStart;
    }

    const legacy = await getSetting(SETTINGS_KEY_HISTORY_EARLIEST_DATE);
    if (legacy != null && legacy.length > 0) {
      return persistAppStartDateKey(legacy);
    }

    // DB init should have stamped already; last-resort fallback.
    return persistAppStartDateKey(getTodayDateKey());
  })().finally(() => {
    boundsPromise = null;
  });

  return boundsPromise;
}

export async function getAppStartDateKey(): Promise<string> {
  return ensureHistoryCalendarBounds();
}

/**
 * Developer: set app start date to the earliest GPS day in location_points.
 */
export async function setAppStartDateFromEarliestLocationPoints(): Promise<{
  dateKey: string;
  fromGps: boolean;
}> {
  boundsPromise = null;
  const { getDatabase } = await import('@/db/client');
  const db = await getDatabase();
  const fromDb = await earliestLocationDateKeyWithDb(db);
  const dateKey = fromDb ?? getTodayDateKey();
  await persistAppStartDateKey(dateKey);
  return { dateKey, fromGps: fromDb != null };
}

/**
 * After wipes, move the floor forward if the earliest remaining GPS day is later.
 */
export async function refreshHistoryCalendarBounds(): Promise<string> {
  boundsPromise = null;
  const current = await getSetting(SETTINGS_KEY_APP_START_DATE);
  const { getDatabase } = await import('@/db/client');
  const db = await getDatabase();
  const fromDb = await earliestLocationDateKeyWithDb(db);
  const today = getTodayDateKey();

  let next = current != null && current.length > 0 ? current : today;
  if (fromDb != null && fromDb > next) {
    next = fromDb;
  }
  if (fromDb == null && (current == null || current.length === 0)) {
    next = today;
  }

  return persistAppStartDateKey(next);
}

export function clampDateKeyToHistoryBounds(dateKey: string): string {
  const earliest =
    useAppStore.getState().historyEarliestDateKey ?? getTodayDateKey();
  const today = getTodayDateKey();
  if (dateKey < earliest) {
    return earliest;
  }
  if (dateKey > today) {
    return today;
  }
  return dateKey;
}
