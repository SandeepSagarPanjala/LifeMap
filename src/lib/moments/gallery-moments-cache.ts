import {
  getMomentsDayFingerprint,
  getMomentsForDateKeys,
  listMomentDateKeysBefore,
  type MomentRow,
} from '@/db/repositories/moments';
import { listSavedPlaces } from '@/db/repositories/saved-places';
import { listTripsForDateKeys } from '@/db/repositories/trips';
import { toDateKey } from '@/lib/day-utils';
import {
  groupTripsByDateKey,
  resolveGalleryPlaceLabelsByMomentId,
} from '@/lib/moments/gallery-moment-place-labels';

export const GALLERY_PAGE_SIZE = 30;

export type GalleryDaySection = {
  dateKey: string;
  moments: MomentRow[];
  fingerprint: string;
  placeLabelsByMomentId: ReadonlyMap<number, string>;
};

type DayCacheEntry = {
  moments: MomentRow[];
  fingerprint: string;
  placeLabelsByMomentId: Map<number, string>;
};

const dayCache = new Map<string, DayCacheEntry>();
let orderedDateKeys: string[] = [];
let oldestLoadedKey: string | null = null;
let hasMoreOlder = true;

function sortMomentsAsc(rows: MomentRow[]): MomentRow[] {
  return [...rows].sort(
    (a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime() || a.id - b.id,
  );
}

function emptyPlaceLabels(): Map<number, string> {
  return new Map();
}

function placeLabelsEqual(
  a: ReadonlyMap<number, string>,
  b: ReadonlyMap<number, string>,
): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const [id, label] of a) {
    if (b.get(id) !== label) {
      return false;
    }
  }
  return true;
}

async function resolvePlaceLabelsForDays(
  dateKeys: readonly string[],
  momentsByDay: ReadonlyMap<string, readonly MomentRow[]>,
): Promise<Map<string, Map<number, string>>> {
  const [trips, savedPlaces] = await Promise.all([
    listTripsForDateKeys(dateKeys),
    listSavedPlaces(),
  ]);
  const tripsByDay = groupTripsByDateKey(trips);
  const labelsByDay = new Map<string, Map<number, string>>();
  for (const key of dateKeys) {
    labelsByDay.set(
      key,
      resolveGalleryPlaceLabelsByMomentId(
        momentsByDay.get(key) ?? [],
        tripsByDay.get(key) ?? [],
        savedPlaces,
      ),
    );
  }
  return labelsByDay;
}

export function getOrderedGalleryDateKeys(): string[] {
  return orderedDateKeys;
}

export function galleryHasMoreOlder(): boolean {
  return hasMoreOlder;
}

export function sectionsFromOrderedKeys(
  keys: string[] = orderedDateKeys,
): GalleryDaySection[] {
  const sections: GalleryDaySection[] = [];
  for (const dateKey of keys) {
    const entry = dayCache.get(dateKey);
    if (!entry) {
      continue;
    }
    sections.push({
      dateKey,
      moments: entry.moments,
      fingerprint: entry.fingerprint,
      placeLabelsByMomentId: entry.placeLabelsByMomentId,
    });
  }
  return sections;
}

export async function loadDaysIntoCache(dateKeys: string[]): Promise<void> {
  const missing = dateKeys.filter(key => !dayCache.has(key));
  if (missing.length === 0) {
    return;
  }
  const rows = await getMomentsForDateKeys(missing);
  const byDay = new Map<string, MomentRow[]>();
  for (const key of missing) {
    byDay.set(key, []);
  }
  for (const row of rows) {
    const key = toDateKey(row.timestamp);
    const list = byDay.get(key);
    if (list) {
      list.push(row);
    }
  }

  const momentsByDay = new Map<string, MomentRow[]>();
  for (const key of missing) {
    momentsByDay.set(key, sortMomentsAsc(byDay.get(key) ?? []));
  }

  const [labelsByDay, fingerprints] = await Promise.all([
    resolvePlaceLabelsForDays(missing, momentsByDay),
    Promise.all(
      missing.map(async key => ({
        key,
        fingerprint: await getMomentsDayFingerprint(key),
      })),
    ),
  ]);

  for (const { key, fingerprint } of fingerprints) {
    dayCache.set(key, {
      moments: momentsByDay.get(key) ?? [],
      fingerprint,
      placeLabelsByMomentId:
        labelsByDay.get(key) ?? emptyPlaceLabels(),
    });
  }
}

export async function refreshStaleGalleryDays(
  keys: string[],
): Promise<boolean> {
  let changed = false;
  const momentsByDayForLabels = new Map<string, MomentRow[]>();

  for (const key of keys) {
    const cached = dayCache.get(key);
    const fingerprint = await getMomentsDayFingerprint(key);
    if (cached && cached.fingerprint === fingerprint) {
      momentsByDayForLabels.set(key, cached.moments);
      continue;
    }
    const rows = await getMomentsForDateKeys([key]);
    if (rows.length === 0) {
      dayCache.delete(key);
      orderedDateKeys = orderedDateKeys.filter(k => k !== key);
      changed = true;
      continue;
    }
    const moments = sortMomentsAsc(rows);
    dayCache.set(key, {
      moments,
      fingerprint,
      placeLabelsByMomentId: emptyPlaceLabels(),
    });
    momentsByDayForLabels.set(key, moments);
    if (!orderedDateKeys.includes(key)) {
      orderedDateKeys = [...orderedDateKeys, key].sort((a, b) =>
        a < b ? 1 : a > b ? -1 : 0,
      );
      oldestLoadedKey =
        orderedDateKeys[orderedDateKeys.length - 1] ?? null;
    }
    changed = true;
  }

  const labelKeys = [...momentsByDayForLabels.keys()];
  if (labelKeys.length > 0) {
    const labelsByDay = await resolvePlaceLabelsForDays(
      labelKeys,
      momentsByDayForLabels,
    );
    for (const key of labelKeys) {
      const entry = dayCache.get(key);
      if (!entry) {
        continue;
      }
      const nextLabels = labelsByDay.get(key) ?? emptyPlaceLabels();
      if (!placeLabelsEqual(entry.placeLabelsByMomentId, nextLabels)) {
        changed = true;
      }
      dayCache.set(key, {
        ...entry,
        placeLabelsByMomentId: nextLabels,
      });
    }
  }

  return changed;
}

export async function bootstrapGalleryDays(): Promise<GalleryDaySection[]> {
  if (orderedDateKeys.length === 0) {
    const keys = await listMomentDateKeysBefore(null, GALLERY_PAGE_SIZE);
    await loadDaysIntoCache(keys);
    orderedDateKeys = keys;
    oldestLoadedKey = keys[keys.length - 1] ?? null;
    hasMoreOlder = keys.length >= GALLERY_PAGE_SIZE;
  } else {
    await refreshStaleGalleryDays(orderedDateKeys);
  }
  return sectionsFromOrderedKeys();
}

export async function loadMoreOlderGalleryDays(): Promise<GalleryDaySection[]> {
  if (!hasMoreOlder) {
    return sectionsFromOrderedKeys();
  }
  const keys = await listMomentDateKeysBefore(
    oldestLoadedKey,
    GALLERY_PAGE_SIZE,
  );
  if (keys.length === 0) {
    hasMoreOlder = false;
    return sectionsFromOrderedKeys();
  }
  await loadDaysIntoCache(keys);
  const existing = new Set(orderedDateKeys);
  const appended = keys.filter(k => !existing.has(k));
  orderedDateKeys = [...orderedDateKeys, ...appended];
  oldestLoadedKey = orderedDateKeys[orderedDateKeys.length - 1] ?? null;
  hasMoreOlder = keys.length >= GALLERY_PAGE_SIZE;
  return sectionsFromOrderedKeys();
}

export function applyGalleryMomentChange(dateKey: string): void {
  // Caller deletes cache entry and reloads; this only reorders keys after load.
  const entry = dayCache.get(dateKey);
  if (!entry || entry.moments.length === 0) {
    dayCache.delete(dateKey);
    orderedDateKeys = orderedDateKeys.filter(k => k !== dateKey);
    oldestLoadedKey =
      orderedDateKeys[orderedDateKeys.length - 1] ?? null;
    return;
  }
  if (!orderedDateKeys.includes(dateKey)) {
    orderedDateKeys = [...orderedDateKeys, dateKey].sort((a, b) =>
      a < b ? 1 : a > b ? -1 : 0,
    );
    oldestLoadedKey =
      orderedDateKeys[orderedDateKeys.length - 1] ?? null;
  }
}

export function invalidateGalleryDay(dateKey: string): void {
  dayCache.delete(dateKey);
}

/** Clear in-memory gallery state (e.g. after a large bulk seed). */
export function resetGalleryMomentsCache(): void {
  dayCache.clear();
  orderedDateKeys = [];
  oldestLoadedKey = null;
  hasMoreOlder = true;
}

/** Next older day than `dateKey` that has moments. */
export async function loadAdjacentOlderDay(
  dateKey: string,
): Promise<{ dateKey: string; moments: MomentRow[] } | null> {
  const idx = orderedDateKeys.indexOf(dateKey);
  if (idx >= 0 && idx < orderedDateKeys.length - 1) {
    const nextKey = orderedDateKeys[idx + 1]!;
    await loadDaysIntoCache([nextKey]);
    return {
      dateKey: nextKey,
      moments: dayCache.get(nextKey)?.moments ?? [],
    };
  }

  const keys = await listMomentDateKeysBefore(dateKey, 1);
  if (keys.length === 0) {
    hasMoreOlder = false;
    return null;
  }
  const nextKey = keys[0]!;
  await loadDaysIntoCache([nextKey]);
  if (!orderedDateKeys.includes(nextKey)) {
    orderedDateKeys = [...orderedDateKeys, nextKey];
    oldestLoadedKey = nextKey;
  }
  return {
    dateKey: nextKey,
    moments: dayCache.get(nextKey)?.moments ?? [],
  };
}

/** Next newer day than `dateKey` that has moments. */
export async function loadAdjacentNewerDay(
  dateKey: string,
): Promise<{ dateKey: string; moments: MomentRow[] } | null> {
  const idx = orderedDateKeys.indexOf(dateKey);
  if (idx > 0) {
    const nextKey = orderedDateKeys[idx - 1]!;
    await loadDaysIntoCache([nextKey]);
    return {
      dateKey: nextKey,
      moments: dayCache.get(nextKey)?.moments ?? [],
    };
  }

  const head = await listMomentDateKeysBefore(null, 1);
  if (head[0] && head[0] !== orderedDateKeys[0]) {
    const newerKey = head[0];
    await loadDaysIntoCache([newerKey]);
    if (!orderedDateKeys.includes(newerKey)) {
      orderedDateKeys = [newerKey, ...orderedDateKeys];
    }
    const newIdx = orderedDateKeys.indexOf(dateKey);
    if (newIdx > 0) {
      const nextKey = orderedDateKeys[newIdx - 1]!;
      return {
        dateKey: nextKey,
        moments: dayCache.get(nextKey)?.moments ?? [],
      };
    }
  }
  return null;
}
