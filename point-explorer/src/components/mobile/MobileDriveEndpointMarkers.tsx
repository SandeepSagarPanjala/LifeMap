import L from 'leaflet';
import { Marker } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';

import {
  formatTripClockTime,
  visitPlaceName,
} from '../../mobile/timeline-format';
import type { DetectedTrip } from '../../mobile/types';
import type { SavedPlaceRow } from '../../types';
import { stayCoordinate } from './MobileStayCallout';

type MobileDriveEndpointMarkersProps = {
  entry: DetectedTrip;
  savedPlaces: readonly SavedPlaceRow[];
  /** When scrubbing a visit, finish anchors on the arrival stay. */
  anchorEndStay?: DetectedTrip | null;
};

function savedPlaceForId(
  savedPlaces: readonly SavedPlaceRow[],
  id: number | undefined,
): SavedPlaceRow | undefined {
  if (id == null) {
    return undefined;
  }
  return savedPlaces.find(place => place.id === id);
}

function savedPlaceIdFromEntry(
  placeKind: DetectedTrip['placeKind'] | undefined,
  placeId: number | undefined,
): number | undefined {
  return placeKind === 'saved' ? placeId : undefined;
}

function travelEndpointCoordinate(
  entry: DetectedTrip,
  savedPlaces: readonly SavedPlaceRow[],
  end: 'start' | 'finish',
): LatLngTuple | null {
  const savedPlaceId =
    end === 'start'
      ? savedPlaceIdFromEntry(entry.fromPlaceKind, entry.fromPlaceId)
      : savedPlaceIdFromEntry(entry.toPlaceKind, entry.toPlaceId);
  const savedPlace = savedPlaceForId(savedPlaces, savedPlaceId);
  if (savedPlace != null) {
    return [savedPlace.lat, savedPlace.lng];
  }
  if (entry.points.length === 0) {
    return null;
  }
  const point =
    end === 'start' ? entry.points[0]! : entry.points[entry.points.length - 1]!;
  return [point.lat, point.lng];
}

function placeEmoji(kind: SavedPlaceRow['kind'] | undefined): string {
  if (kind === 'home') return '🏠';
  if (kind === 'work') return '💼';
  if (kind === 'favorite') return '⭐';
  return '';
}

function dotIcon(savedPlace: SavedPlaceRow | undefined): L.DivIcon {
  if (savedPlace != null) {
    const emoji = placeEmoji(savedPlace.kind);
    return L.divIcon({
      className: 'mobile-drive-dot-marker',
      html: `<div class="mobile-drive-saved-dot">${emoji}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }
  return L.divIcon({
    className: 'mobile-drive-dot-marker',
    html: '<div class="mobile-drive-dot-ring"><div class="mobile-drive-dot-core"></div></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function chipIcon(
  caption: 'Start' | 'Finish',
  time: Date,
  label: string | null,
  savedPlace: SavedPlaceRow | undefined,
  anchorBelow: boolean,
): L.DivIcon {
  const emoji = savedPlace != null ? placeEmoji(savedPlace.kind) : '';
  const placeLine =
    label != null
      ? `<div class="mobile-drive-chip-place">${
          emoji ? `${emoji} ` : ''
        }${label}</div>`
      : '';
  const html = `
    <div class="mobile-drive-chip">
      <div class="mobile-drive-chip-caption">${caption}</div>
      <div class="mobile-drive-chip-time">${formatTripClockTime(time)}</div>
      ${placeLine}
    </div>
  `;
  return L.divIcon({
    className: 'mobile-drive-chip-marker',
    html,
    iconSize: [160, 72],
    iconAnchor: anchorBelow ? [80, -6] : [80, 78],
  });
}

export function MobileDriveEndpointMarkers({
  entry,
  savedPlaces,
  anchorEndStay = null,
}: MobileDriveEndpointMarkersProps) {
  const startCoord = travelEndpointCoordinate(entry, savedPlaces, 'start');
  const endCoord =
    anchorEndStay != null
      ? stayCoordinate(anchorEndStay)
      : travelEndpointCoordinate(entry, savedPlaces, 'finish');
  if (startCoord == null || endCoord == null) {
    return null;
  }

  const startPlace = savedPlaceForId(
    savedPlaces,
    savedPlaceIdFromEntry(entry.fromPlaceKind, entry.fromPlaceId),
  );
  const endPlace =
    anchorEndStay != null
      ? savedPlaceForId(
          savedPlaces,
          savedPlaceIdFromEntry(anchorEndStay.placeKind, anchorEndStay.placeId),
        )
      : savedPlaceForId(
          savedPlaces,
          savedPlaceIdFromEntry(entry.toPlaceKind, entry.toPlaceId),
        );
  const startLabel = entry.fromPlaceLabel ?? startPlace?.label ?? null;
  const endLabel =
    anchorEndStay != null
      ? visitPlaceName(anchorEndStay) ??
        entry.toPlaceLabel ??
        endPlace?.label ??
        null
      : entry.toPlaceLabel ?? endPlace?.label ?? null;

  return (
    <>
      <Marker
        position={startCoord}
        icon={dotIcon(startPlace)}
        zIndexOffset={400}
      />
      <Marker
        position={startCoord}
        icon={chipIcon('Start', entry.startAt, startLabel, startPlace, false)}
        zIndexOffset={390}
      />
      <Marker position={endCoord} icon={dotIcon(endPlace)} zIndexOffset={400} />
      <Marker
        position={endCoord}
        icon={chipIcon('Finish', entry.endAt, endLabel, endPlace, true)}
        zIndexOffset={390}
      />
    </>
  );
}
