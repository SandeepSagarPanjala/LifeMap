import {useEffect, useMemo} from 'react';
import {
  Circle,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet';
import type {LatLngBoundsExpression, LatLngTuple} from 'leaflet';

import {HISTORY_COLORS} from '../../mobile/history-ruler';
import {buildMobileHistoryMapPlan} from '../../mobile/history-map-routes';
import type {DayTimelineEntry} from '../../mobile/types';
import type {ParsedPoint, SavedPlaceRow} from '../../types';
import {MobileDriveEndpointMarkers} from './MobileDriveEndpointMarkers';
import {MobileSavedPlacesOverlay} from './MobileSavedPlacesOverlay';
import {
  MobileStayCallout,
  STAY_DWELL_RADIUS_METERS,
  stayCoordinate,
} from './MobileStayCallout';

type MobileMapProps = {
  entries: readonly DayTimelineEntry[];
  dayPoints: readonly {lat: number; lng: number}[];
  savedPlaces: readonly SavedPlaceRow[];
  selectedIndex: number;
  showSavedPlaceMarkersOnMap: boolean;
};

function FitBounds({positions}: {positions: LatLngTuple[]}) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0]!, 15);
      return;
    }
    const bounds: LatLngBoundsExpression = positions;
    map.fitBounds(bounds, {padding: [48, 48], maxZoom: 16});
  }, [map, positions]);
  return null;
}

function stayAreaStyle(selected: boolean) {
  return {
    color: selected ? 'rgba(255, 149, 0, 0.6)' : 'rgba(255, 149, 0, 0.4)',
    fillColor: selected ? 'rgba(255, 149, 0, 0.45)' : 'rgba(255, 149, 0, 0.28)',
    fillOpacity: 1,
    weight: 2,
  };
}

function toLatLng(points: readonly ParsedPoint[]): LatLngTuple[] {
  return points.map(point => [point.lat, point.lng] as LatLngTuple);
}

function hideSavedPlaceMarkerId(
  plan: ReturnType<typeof buildMobileHistoryMapPlan>,
): number | null {
  const selected = plan.selectedEntry;
  if (selected == null) {
    return null;
  }
  if (selected.kind === 'stay' && selected.savedPlaceId != null) {
    return selected.savedPlaceId;
  }
  if (selected.kind === 'travel') {
    return selected.toSavedPlaceId ?? selected.fromSavedPlaceId ?? null;
  }
  return null;
}

export function MobileMap({
  entries,
  dayPoints,
  savedPlaces,
  selectedIndex,
  showSavedPlaceMarkersOnMap,
}: MobileMapProps) {
  const plan = useMemo(
    () => buildMobileHistoryMapPlan(entries, selectedIndex),
    [entries, selectedIndex],
  );

  const emphasizedRoute = useMemo(() => {
    if (plan.travelPoints.length >= 2) {
      return toLatLng(plan.travelPoints);
    }
    if (plan.inboundPoints.length >= 2) {
      return toLatLng(plan.inboundPoints);
    }
    return null;
  }, [plan.inboundPoints, plan.travelPoints]);

  const focusPositions = useMemo(() => {
    if (emphasizedRoute != null && emphasizedRoute.length >= 2) {
      return emphasizedRoute;
    }
    if (plan.selectedEntry?.kind === 'stay') {
      const center = stayCoordinate(plan.selectedEntry);
      return center != null ? [center] : [];
    }
    if (plan.selectedEntry == null) {
      return dayPoints.map(point => [point.lat, point.lng] as LatLngTuple);
    }
    return [];
  }, [dayPoints, emphasizedRoute, plan.selectedEntry]);

  const selectedStayEntry =
    plan.selectedEntry?.kind === 'stay' ? plan.selectedEntry : null;
  const selectedStayCenter =
    selectedStayEntry != null ? stayCoordinate(selectedStayEntry) : null;
  const selectedIsSavedPlaceVisit =
    selectedStayEntry != null && selectedStayEntry.savedPlaceId != null;

  const driveEndpointEntry =
    plan.selectedEntry?.kind === 'travel' ? plan.selectedEntry : null;

  return (
    <MapContainer
      className="mobile-map-leaflet"
      center={[33.2, -97.1]}
      zoom={12}
      scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds positions={focusPositions} />

      {showSavedPlaceMarkersOnMap ? (
        <MobileSavedPlacesOverlay
          places={savedPlaces}
          hideMarkerPlaceId={hideSavedPlaceMarkerId(plan)}
        />
      ) : null}

      {selectedStayCenter != null && !selectedIsSavedPlaceVisit ? (
        <Circle
          center={selectedStayCenter}
          radius={STAY_DWELL_RADIUS_METERS}
          pathOptions={stayAreaStyle(true)}
        />
      ) : null}

      {emphasizedRoute != null ? (
        <Polyline
          positions={emphasizedRoute}
          pathOptions={{color: HISTORY_COLORS.travel, weight: 5, opacity: 0.95}}
        />
      ) : null}

      {driveEndpointEntry != null ? (
        <MobileDriveEndpointMarkers
          entry={driveEndpointEntry}
          savedPlaces={savedPlaces}
        />
      ) : null}

      {selectedStayEntry != null ? (
        <MobileStayCallout
          entry={selectedStayEntry}
          savedPlaces={savedPlaces}
        />
      ) : null}
    </MapContainer>
  );
}
