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

  const [start, setStart] = useState(startSync);
  const [end, setEnd] = useState(endSync);
  const materializationRevision = useSyncExternalStore(
    subscribeMaterialization,
    getMaterializationRevision,
    getMaterializationRevision,
  );

  useEffect(() => {
    setStart(startSync);
    setEnd(endSync);
  }, [endSync, startSync]);

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
          setStart(label);
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
          setEnd(label);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [endSync, nextStay, savedPlaces, materializationRevision]);

  return {
    start: previousStay ? start : EMPTY_DRIVE_ENDPOINT_LABEL,
    end: nextStay ? end : EMPTY_DRIVE_ENDPOINT_LABEL,
  };
}
