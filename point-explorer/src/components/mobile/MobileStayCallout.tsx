import L from 'leaflet';
import {Marker} from 'react-leaflet';
import type {LatLngTuple} from 'leaflet';

import {formatStayVisitLabel, visitPlaceName} from '../../mobile/timeline-format';
import type {DetectedTrip} from '../../mobile/types';
import type {SavedPlaceRow} from '../../types';
import {hasMobileMomentCounts} from './mobile-moment-theme';
import {mobileMomentCountsHtml} from './MobileMomentCountsRow';
import {
  savedPlaceIconHtml,
  SAVED_PLACE_VISIT_COLOR,
} from './SavedPlaceIcon';

const DOT_RING_SIZE = 28;
const BUBBLE_DOT_GAP = 4;
const STAY_DWELL_RADIUS_METERS = 75;

type MobileStayCalloutProps = {
  entry: DetectedTrip;
  savedPlaces: readonly SavedPlaceRow[];
};

function stayCoordinate(entry: DetectedTrip): LatLngTuple | null {
  if (entry.anchorLat != null && entry.anchorLng != null) {
    return [entry.anchorLat, entry.anchorLng];
  }
  if (entry.points.length > 0) {
    const last = entry.points[entry.points.length - 1]!;
    return [last.lat, last.lng];
  }
  return null;
}

function stayPlaceLineHtml(
  placeName: string,
  savedPlace: SavedPlaceRow | undefined,
): string {
  if (savedPlace != null) {
    return (
      `<div class="mobile-stay-bubble-place-row">` +
      savedPlaceIconHtml(savedPlace.kind, 16, SAVED_PLACE_VISIT_COLOR) +
      `<span class="mobile-stay-bubble-place">${escapeHtml(placeName)}</span>` +
      `</div>`
    );
  }
  return `<div class="mobile-stay-bubble-place">${escapeHtml(placeName)}</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function stayDotIcon(): L.DivIcon {
  return L.divIcon({
    className: 'mobile-stay-dot-marker',
    html: `
      <div class="mobile-stay-dot-wrap">
        <div class="mobile-stay-dot-ring"></div>
        <div class="mobile-stay-dot-core"></div>
      </div>
    `,
    iconSize: [DOT_RING_SIZE, DOT_RING_SIZE],
    iconAnchor: [DOT_RING_SIZE / 2, DOT_RING_SIZE / 2],
  });
}

function stayBubbleIcon(
  placeLineHtml: string | null,
  title: string,
  subtitle: string,
  entry: DetectedTrip,
): L.DivIcon {
  const momentsHtml = hasMobileMomentCounts(entry.momentCounts)
    ? mobileMomentCountsHtml(entry.momentCounts, true)
    : '';
  const liftPx = DOT_RING_SIZE / 2 + BUBBLE_DOT_GAP;
  const html = `
    <div class="mobile-stay-bubble-anchor" style="transform: translate(-50%, calc(-100% - ${liftPx}px));">
      <div class="mobile-stay-bubble">
        ${momentsHtml}
        ${placeLineHtml ?? ''}
        <div class="mobile-stay-bubble-time">${escapeHtml(title)}</div>
        <div class="mobile-stay-bubble-duration">${escapeHtml(subtitle)}</div>
      </div>
    </div>
  `;
  return L.divIcon({
    className: 'mobile-stay-bubble-marker',
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export function MobileStayCallout({
  entry,
  savedPlaces,
}: MobileStayCalloutProps) {
  const coordinate = stayCoordinate(entry);
  if (coordinate == null) {
    return null;
  }

  const savedPlace =
    entry.savedPlaceId != null
      ? savedPlaces.find(place => place.id === entry.savedPlaceId)
      : undefined;
  const placeName = visitPlaceName(entry);
  const placeLineHtml =
    placeName != null ? stayPlaceLineHtml(placeName, savedPlace) : null;
  const visit = formatStayVisitLabel(
    entry.startAt,
    entry.endAt,
    entry.durationMs,
  );

  return (
    <>
      <Marker
        position={coordinate}
        icon={stayDotIcon()}
        zIndexOffset={400}
      />
      <Marker
        position={coordinate}
        icon={stayBubbleIcon(placeLineHtml, visit.title, visit.subtitle, entry)}
        zIndexOffset={390}
      />
    </>
  );
}

export {
  STAY_DWELL_RADIUS_METERS,
  stayCoordinate,
};
