import L from 'leaflet';
import { memo, useMemo } from 'react';
import { Marker } from 'react-leaflet';

import type { SavedPlaceRow } from '../../types';
import { savedPlaceIconHtml } from './SavedPlaceIcon';
import {
  savedPlaceDisplayLabel,
  SAVED_PLACE_MAP_STYLE,
} from './mobile-saved-places-map';

type MobileSavedPlacesOverlayProps = {
  places: readonly SavedPlaceRow[];
  hideMarkerPlaceId?: number | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function savedPlaceMarkerIcon(place: SavedPlaceRow): L.DivIcon {
  const style = SAVED_PLACE_MAP_STYLE[place.kind];
  const label = escapeHtml(savedPlaceDisplayLabel(place));
  const html = `
    <div class="mobile-saved-place-marker-column">
      <div class="mobile-saved-place-marker-badge" style="background:${
        style.badgeBg
      };border-color:${style.stroke}">
        ${savedPlaceIconHtml(place.kind, 16, style.icon)}
      </div>
      <div class="mobile-saved-place-marker-label" style="border-color:${
        style.stroke
      }">
        ${label}
      </div>
    </div>
  `;
  return L.divIcon({
    className: 'mobile-saved-place-marker',
    html,
    iconSize: [84, 53],
    iconAnchor: [42, 16],
  });
}

function MobileSavedPlacesOverlayComponent({
  places,
  hideMarkerPlaceId = null,
}: MobileSavedPlacesOverlayProps) {
  // Build DivIcons once per place set instead of recreating DOM every render.
  const iconByPlaceId = useMemo(() => {
    const map = new Map<number, L.DivIcon>();
    for (const place of places) {
      map.set(place.id, savedPlaceMarkerIcon(place));
    }
    return map;
  }, [places]);

  if (places.length === 0) {
    return null;
  }

  return (
    <>
      {places.map(place => {
        if (hideMarkerPlaceId === place.id) {
          return null;
        }
        return (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={iconByPlaceId.get(place.id)}
            zIndexOffset={300}
          />
        );
      })}
    </>
  );
}

export const MobileSavedPlacesOverlay = memo(MobileSavedPlacesOverlayComponent);
