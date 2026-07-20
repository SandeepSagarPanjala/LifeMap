import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import {
  driveEndpointLabelFromVisitDisplay,
  EMPTY_DRIVE_ENDPOINT_LABEL,
  resolveDriveEndpointLabelFromStaySync,
  type DriveEndpointLabel,
} from '@/lib/drive-endpoint-label';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import {
  getMaterializationRevision,
  subscribeMaterialization,
} from '@/lib/trip-materialization-events';
import type { DetectedTrip } from '@/lib/trip-detection';
import { loadVisitPlaceDisplayForStay } from '@/lib/visit-place-label';

/** Stable empty pair so MapScreenMap memo isn't busted on unrelated re-renders. */
const EMPTY_DRIVE_ENDPOINT_LABELS: {
  start: DriveEndpointLabel;
  end: DriveEndpointLabel;
} = {
  start: EMPTY_DRIVE_ENDPOINT_LABEL,
  end: EMPTY_DRIVE_ENDPOINT_LABEL,
};

async function enrichDriveEndpointLabel(
  stay: DetectedTrip,
  savedPlaces: readonly SavedPlaceRow[],
  syncLabel: DriveEndpointLabel,
): Promise<DriveEndpointLabel> {
  if (syncLabel.source === 'saved') {
    return syncLabel;
  }

  const display = await loadVisitPlaceDisplayForStay(stay, savedPlaces);
  if (display.source === 'saved') {
    return resolveDriveEndpointLabelFromStaySync(stay, savedPlaces);
  }

  const enriched = driveEndpointLabelFromVisitDisplay(display);
  if (enriched.source === 'none') {
    return syncLabel;
  }

  if (syncLabel.savedPlace) {
    return syncLabel;
  }

  return enriched;
}

export function useDriveEndpointLabels(
  previousStay: DetectedTrip | null,
  nextStay: DetectedTrip | null,
  savedPlaces: readonly SavedPlaceRow[],
): {
  start: DriveEndpointLabel;
  end: DriveEndpointLabel;
} {
  const startSync = useMemo(
    () => resolveDriveEndpointLabelFromStaySync(previousStay, savedPlaces),
    [previousStay, savedPlaces],
  );
  const endSync = useMemo(
    () => resolveDriveEndpointLabelFromStaySync(nextStay, savedPlaces),
    [nextStay, savedPlaces],
  );

  // Async enrichment only — sync path is derived to avoid an extra paint.
  const [enrichedStart, setEnrichedStart] =
    useState<DriveEndpointLabel | null>(null);
  const [enrichedEnd, setEnrichedEnd] =
    useState<DriveEndpointLabel | null>(null);
  const materializationRevision = useSyncExternalStore(
    subscribeMaterialization,
    getMaterializationRevision,
    getMaterializationRevision,
  );

  useEffect(() => {
    setEnrichedStart(null);
    setEnrichedEnd(null);
  }, [startSync, endSync]);

  // Always re-read non-saved endpoints from DB. Timeline stays can keep a
  // stale poiLabel after the user renames/selects a place; sync text alone
  // must not skip enrichment or History keeps showing the old name.
  useEffect(() => {
    if (!previousStay || startSync.source === 'saved') {
      return;
    }

    let cancelled = false;
    void enrichDriveEndpointLabel(previousStay, savedPlaces, startSync).then(
      label => {
        if (!cancelled) {
          setEnrichedStart(label);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [previousStay, savedPlaces, startSync, materializationRevision]);

  useEffect(() => {
    if (!nextStay || endSync.source === 'saved') {
      return;
    }

    let cancelled = false;
    void enrichDriveEndpointLabel(nextStay, savedPlaces, endSync).then(
      label => {
        if (!cancelled) {
          setEnrichedEnd(label);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [endSync, nextStay, savedPlaces, materializationRevision]);

  const resolvedStart = previousStay
    ? (enrichedStart ?? startSync)
    : EMPTY_DRIVE_ENDPOINT_LABEL;
  const resolvedEnd = nextStay
    ? (enrichedEnd ?? endSync)
    : EMPTY_DRIVE_ENDPOINT_LABEL;

  return useMemo(() => {
    if (
      resolvedStart === EMPTY_DRIVE_ENDPOINT_LABEL &&
      resolvedEnd === EMPTY_DRIVE_ENDPOINT_LABEL
    ) {
      return EMPTY_DRIVE_ENDPOINT_LABELS;
    }
    return { start: resolvedStart, end: resolvedEnd };
  }, [resolvedStart, resolvedEnd]);
}
