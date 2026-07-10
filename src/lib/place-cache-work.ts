import { closestPlacePoiToAnchor } from '@/db/repositories/place-pois';
import { getTripById } from '@/db/repositories/trips';
import { applyTripPersistedLabel } from '@/db/repositories/trips';
import {
  mergeTripPlaceLabelAfterLookup,
  tripLookupAnchorFromRow,
} from '@/lib/place-lookup-backfill';
import {
  ensureCompletePlaceLookupAtAnchor,
  platformResolvesClosestPoi,
} from '@/lib/place-lookup-service';
import { notifyPlaceLookupUpdated } from '@/lib/place-lookup-events';
import { existingTripLabelsByEventKey } from '@/lib/trip-materialization';
import { notifyMaterializationUpdated } from '@/lib/trip-materialization-events';
import type { PlaceCacheWorkItem } from '@/lib/place-cache-backlog';
import { PLACE_LOOKUP_CATCH_UP_DELAY_MS } from '@/lib/app-constants';
import { yieldToEventLoop } from '@/lib/run-when-idle';

export async function runPlaceCacheWorkItem(
  item: PlaceCacheWorkItem,
): Promise<void> {
  if (item.kind === 'open_visit') {
    await ensureCompletePlaceLookupAtAnchor(item.anchor, {
      bypassSessionBudget: true,
    });
    notifyPlaceLookupUpdated();
    return;
  }

  const trip = await getTripById(item.tripId);
  if (trip == null) {
    return;
  }

  const anchor = tripLookupAnchorFromRow(trip);
  const cache = await ensureCompletePlaceLookupAtAnchor(anchor, {
    bypassSessionBudget: true,
  });
  if (cache == null) {
    return;
  }

  let closestPoi: { poiId: number; poiLabel: string } | undefined;
  if (platformResolvesClosestPoi()) {
    const { listPlacePoisForCache } = await import('@/db/repositories/place-pois');
    const pois = await listPlacePoisForCache(cache.id);
    const closest = closestPlacePoiToAnchor(anchor, pois);
    if (closest != null) {
      closestPoi = { poiId: closest.id, poiLabel: closest.name };
    }
  }

  const existingByEventKey = existingTripLabelsByEventKey([trip]);
  const labels = mergeTripPlaceLabelAfterLookup(
    trip.eventKey,
    existingByEventKey,
    cache,
    closestPoi,
  );
  await applyTripPersistedLabel(trip.id, labels);
  notifyMaterializationUpdated();
  notifyPlaceLookupUpdated();
}

export async function delayBetweenPlaceCacheItems(): Promise<void> {
  await yieldToEventLoop();
  if (PLACE_LOOKUP_CATCH_UP_DELAY_MS > 0) {
    await new Promise(resolve =>
      setTimeout(resolve, PLACE_LOOKUP_CATCH_UP_DELAY_MS),
    );
  }
}
