import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import type { VisitPlaceDisplay } from '@/lib/place-lookup-types';
import { visitDisplayLabel } from '@/lib/place-lookup-types';
import {
  matchSavedPlaceForStay,
  savedPlaceDisplayLabel,
} from '@/lib/saved-places';
import type { DetectedTrip } from '@/lib/trip-detection';

export type DriveEndpointLabelSource =
  | 'saved'
  | 'selected-label'
  | 'auto-label'
  | 'none';

export type DriveEndpointLabel = {
  source: DriveEndpointLabelSource;
  text: string | null;
  savedPlace: SavedPlaceRow | null;
  pinned: boolean;
  /** MapKit category when endpoint is a selected POI. */
  poiCategory: string | null;
};

export const EMPTY_DRIVE_ENDPOINT_LABEL: DriveEndpointLabel = {
  source: 'none',
  text: null,
  savedPlace: null,
  pinned: false,
  poiCategory: null,
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
      poiCategory: null,
    };
  }

  const text = display.primaryLabel?.trim();
  if (!text) {
    return EMPTY_DRIVE_ENDPOINT_LABEL;
  }

  if (display.selectedPoiId != null) {
    const selected = display.candidates.find(
      candidate => candidate.id === display.selectedPoiId,
    );
    return {
      source: selected?.source === 'user' ? 'selected-label' : 'auto-label',
      text,
      savedPlace: null,
      pinned: true,
      poiCategory: selected?.category ?? null,
    };
  }

  return {
    source: 'auto-label',
    text,
    savedPlace: null,
    pinned: false,
    poiCategory: null,
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
      poiCategory: null,
    };
  }

  if (stay.placeKind === 'saved' && stay.placeLabel?.trim()) {
    return {
      source: 'saved',
      text: stay.placeLabel.trim(),
      savedPlace: null,
      pinned: false,
      poiCategory: null,
    };
  }

  const text = visitDisplayLabel({
    placeKind: stay.placeKind ?? null,
    placeLabel: stay.placeLabel ?? null,
    poiLabel: stay.poiLabel ?? null,
  });

  if (!text) {
    return EMPTY_DRIVE_ENDPOINT_LABEL;
  }

  return {
    source: 'auto-label',
    text,
    savedPlace: null,
    pinned: stay.poiId != null,
    poiCategory: stay.poiCategory ?? null,
  };
}

export function hasDriveEndpointLabel(label: DriveEndpointLabel): boolean {
  return label.text != null && label.text.length > 0;
}

export function isDriveEndpointLabelEditable(
  label: DriveEndpointLabel,
): boolean {
  return label.source !== 'saved' && label.savedPlace == null;
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
