import { and, eq, sql } from 'drizzle-orm';

import { DEFAULT_TRIP_DWELL_MINUTES } from '@/lib/app-constants';
import { matchSavedPlaceForPoint } from '@/lib/saved-places';
import { listSavedPlaces } from '@/db/repositories/saved-places';
import { getDatabase } from '@/db/client';
import { trips } from '@/db/schema';

import {
  getLastPlacePromptStayKey,
  getNotificationsMasterEnabled,
  getPlaceNotifyMode,
  setLastPlacePromptStayKey,
} from './settings';
import { cancelPlaceArrivalHold, schedulePlaceArrivalHold } from './service';
import { ensureNotificationPermission } from './permissions';

const PLACE_DWELL_MS = DEFAULT_TRIP_DWELL_MINUTES * 60_000;

let activeArrivalStayKey: string | null = null;

function stayKeyForCoordinate(
  lat: number,
  lng: number,
  arrivedAtMs: number,
): string {
  // ~110m grid — stable enough for once-per-stay dedup.
  const gridLat = Math.round(lat * 1000) / 1000;
  const gridLng = Math.round(lng * 1000) / 1000;
  return `${gridLat},${gridLng}@${arrivedAtMs}`;
}

async function hasVisitedPlaceBefore(
  lat: number,
  lng: number,
): Promise<boolean> {
  const db = await getDatabase();
  // Prior sealed stays whose centroid is within ~100m of this point.
  const rows = await db
    .select({ id: trips.id })
    .from(trips)
    .where(
      and(
        eq(trips.kind, 'stay'),
        sql`(
          (${trips.centroidLat} - ${lat}) * (${trips.centroidLat} - ${lat}) +
          (${trips.centroidLng} - ${lng}) * (${trips.centroidLng} - ${lng})
        ) < ${0.001 * 0.001}`,
      ),
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Call on motion arrival. Schedules a one-shot place prompt after ~5 min dwell
 * if settings allow. Skips Home. Cancels prior pending arrival hold.
 */
export async function onPlaceArrivalForNotifications(input: {
  latitude: number;
  longitude: number;
  arrivedAt?: Date;
}): Promise<void> {
  const master = await getNotificationsMasterEnabled();
  if (!master) {
    return;
  }

  const places = await listSavedPlaces();
  const saved = matchSavedPlaceForPoint(
    { lat: input.latitude, lng: input.longitude },
    places,
  );
  if (saved?.kind === 'home') {
    if (activeArrivalStayKey != null) {
      await cancelPlaceArrivalHold(activeArrivalStayKey);
      activeArrivalStayKey = null;
    }
    return;
  }

  const mode = await getPlaceNotifyMode();
  if (mode === 'unique_place') {
    const visited = await hasVisitedPlaceBefore(
      input.latitude,
      input.longitude,
    );
    if (visited) {
      return;
    }
  }

  const permitted = await ensureNotificationPermission();
  if (!permitted) {
    return;
  }

  const arrivedAt = input.arrivedAt ?? new Date();
  const stayKey = stayKeyForCoordinate(
    input.latitude,
    input.longitude,
    arrivedAt.getTime(),
  );

  const lastKey = await getLastPlacePromptStayKey();
  if (lastKey === stayKey) {
    return;
  }

  if (activeArrivalStayKey != null && activeArrivalStayKey !== stayKey) {
    await cancelPlaceArrivalHold(activeArrivalStayKey);
  }

  activeArrivalStayKey = stayKey;
  const fireAt = new Date(arrivedAt.getTime() + PLACE_DWELL_MS);

  await schedulePlaceArrivalHold({
    stayKey,
    fireAt,
    placeLabel: saved?.label ?? null,
    mode,
  });
}

/** Call on motion departure — cancel pending dwell hold. */
export async function onPlaceDepartureForNotifications(): Promise<void> {
  if (activeArrivalStayKey == null) {
    return;
  }
  await cancelPlaceArrivalHold(activeArrivalStayKey);
  activeArrivalStayKey = null;
}

/** Mark stay notified after the OS fires (or we display) so we never re-notify. */
export async function markPlacePromptFired(stayKey: string): Promise<void> {
  await setLastPlacePromptStayKey(stayKey);
  if (activeArrivalStayKey === stayKey) {
    activeArrivalStayKey = null;
  }
}
