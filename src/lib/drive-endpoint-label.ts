import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import type {VisitPlaceDisplay} from '@/lib/place-lookup-types';
import {matchSavedPlaceForStay, savedPlaceDisplayLabel} from '@/lib/saved-places';
import type {DetectedTrip} from '@/lib/trip-detection';

export type DriveEndpointLabelSource =
  | 'saved'
  | 'selected-label'
  | 'auto-label'
  | 'none';

export type DriveEndpointLabel = {
  source: DriveEndpointLabelSource;
  text: string | null;
  savedPlace: SavedPlaceRow | null;
  /** User picked this name from visit place candidates. */
  pinned: boolean;
};

export const EMPTY_DRIVE_ENDPOINT_LABEL: DriveEndpointLabel = {
  source: 'none',
  text: null,
  savedPlace: null,
  pinned: false,
};

export function driveEndpointLabelFromVisitDisplay(
  display: VisitPlaceDisplay,
): DriveEndpointLabel {
  if (display.source === 'saved' && display.primaryLabel) {
    return {
      source: 'saved',
      text: display.primaryLabel,
      savedPlace: null,
      pinned: false,
    };
  }

  const text = display.primaryLabel?.trim();
  if (!text) {
    return EMPTY_DRIVE_ENDPOINT_LABEL;
  }

  if (display.isTripLabel) {
    return {
      source: 'selected-label',
      text,
      savedPlace: null,
      pinned: true,
    };
  }

  return {
    source: 'auto-label',
    text,
    savedPlace: null,
    pinned: display.isAreaDefault,
  };
}

export function resolveDriveEndpointLabelFromStaySync(
  stay: DetectedTrip | null,
  savedPlaces: readonly SavedPlaceRow[],
): DriveEndpointLabel {
  if (!stay) {
    return EMPTY_DRIVE_ENDPOINT_LABEL;
  }

  const savedPlace = matchSavedPlaceForStay(stay, savedPlaces);
  if (savedPlace) {
    return {
      source: 'saved',
      text: savedPlaceDisplayLabel(savedPlace),
      savedPlace,
      pinned: false,
    };
  }

  return EMPTY_DRIVE_ENDPOINT_LABEL;
}

export function hasDriveEndpointLabel(label: DriveEndpointLabel): boolean {
  return label.text != null && label.text.length > 0;
}

export function formatDriveRouteTitle(
  startLabel?: DriveEndpointLabel,
  endLabel?: DriveEndpointLabel,
): string | null {
  const start = startLabel?.text?.trim();
  const end = endLabel?.text?.trim();
  if (start && end) {
    return `${start} to ${end}`;
  }
  if (start) {
    return start;
  }
  if (end) {
    return end;
  }
  return null;
}
