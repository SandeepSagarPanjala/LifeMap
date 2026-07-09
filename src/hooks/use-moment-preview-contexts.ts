import { useEffect, useMemo, useState } from 'react';

import type { MomentRow } from '@/db/repositories/moments';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import {
  buildMomentPreviewContextForEntry,
  findStayForMomentPreviewContext,
  findTimelineEntryById,
  resolveMomentPreviewContext,
  type MomentPreviewContext,
} from '@/lib/moments/moment-preview-context';
import type { DistanceUnit } from '@/lib/location-geo';
import type { DayTimelineEntry, DetectedTrip } from '@/lib/trip-detection';
import {
  driveEndpointLabelFromVisitDisplay,
  resolveDriveEndpointLabelFromStaySync,
} from '@/lib/drive-endpoint-label';
import { loadVisitPlaceDisplayForStay } from '@/lib/visit-place-label';

const EMPTY_LOOKUP_LABELS: Record<string, string> = {};

async function enrichVisitPlaceLabel(
  stay: DetectedTrip,
  savedPlaces: readonly SavedPlaceRow[],
): Promise<string | null> {
  const sync = resolveDriveEndpointLabelFromStaySync(stay, savedPlaces);
  if (sync.text) {
    return sync.text;
  }

  const display = await loadVisitPlaceDisplayForStay(stay, savedPlaces);
  const label = driveEndpointLabelFromVisitDisplay(display);
  return label.text;
}

function buildStaysNeedingLookup(
  syncContexts: Map<number, MomentPreviewContext>,
  entries: DayTimelineEntry[],
): Map<string, DetectedTrip> {
  const stays = new Map<string, DetectedTrip>();
  for (const context of syncContexts.values()) {
    if (context.placeLabel != null || context.entryKind !== 'stay') {
      continue;
    }
    const stay = findStayForMomentPreviewContext(entries, context);
    if (stay) {
      stays.set(context.entryId, stay);
    }
  }
  return stays;
}

function staysNeedingLookupKey(
  syncContexts: Map<number, MomentPreviewContext>,
  entries: DayTimelineEntry[],
): string {
  const ids: string[] = [];
  for (const context of syncContexts.values()) {
    if (context.placeLabel != null || context.entryKind !== 'stay') {
      continue;
    }
    if (findStayForMomentPreviewContext(entries, context)) {
      ids.push(context.entryId);
    }
  }
  return ids.sort().join(',');
}

export function useMomentPreviewContexts(
  moments: MomentRow[],
  entries: DayTimelineEntry[],
  savedPlaces: readonly SavedPlaceRow[],
  distanceUnit: DistanceUnit,
): Map<number, MomentPreviewContext> {
  const syncContexts = useMemo(() => {
    const map = new Map<number, MomentPreviewContext>();
    for (const moment of moments) {
      const context = resolveMomentPreviewContext(
        moment.timestamp,
        entries,
        savedPlaces,
        distanceUnit,
      );
      if (context) {
        map.set(moment.id, context);
      }
    }
    return map;
  }, [distanceUnit, entries, moments, savedPlaces]);

  const [lookupLabelsByEntryId, setLookupLabelsByEntryId] =
    useState(EMPTY_LOOKUP_LABELS);

  const lookupEntryIdsKey = useMemo(
    () => staysNeedingLookupKey(syncContexts, entries),
    [entries, syncContexts],
  );

  useEffect(() => {
    if (lookupEntryIdsKey.length === 0) {
      setLookupLabelsByEntryId(previous =>
        previous === EMPTY_LOOKUP_LABELS || Object.keys(previous).length === 0
          ? previous
          : EMPTY_LOOKUP_LABELS,
      );
      return;
    }

    const staysNeedingLookup = buildStaysNeedingLookup(syncContexts, entries);
    let cancelled = false;

    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        [...staysNeedingLookup.entries()].map(async ([entryId, stay]) => {
          const label = await enrichVisitPlaceLabel(stay, savedPlaces);
          if (label) {
            next[entryId] = label;
          }
        }),
      );
      if (!cancelled) {
        setLookupLabelsByEntryId(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entries, lookupEntryIdsKey, savedPlaces, syncContexts]);

  return useMemo(() => {
    if (lookupLabelsByEntryId === EMPTY_LOOKUP_LABELS) {
      return syncContexts;
    }
    if (Object.keys(lookupLabelsByEntryId).length === 0) {
      return syncContexts;
    }

    const enriched = new Map<number, MomentPreviewContext>();
    for (const [momentId, context] of syncContexts) {
      const lookupLabel = lookupLabelsByEntryId[context.entryId];
      enriched.set(
        momentId,
        lookupLabel ? { ...context, placeLabel: lookupLabel } : context,
      );
    }
    return enriched;
  }, [lookupLabelsByEntryId, syncContexts]);
}

export function resolveEntryPreviewContext(
  entry: DayTimelineEntry,
  savedPlaces: readonly SavedPlaceRow[],
  distanceUnit: DistanceUnit,
): MomentPreviewContext {
  return buildMomentPreviewContextForEntry(entry, savedPlaces, distanceUnit);
}

export { findTimelineEntryById };
