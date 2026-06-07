import {useEffect, useMemo, useRef} from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import type {CircleMarker as LeafletCircleMarker} from 'leaflet';
import type {LatLngBoundsExpression, LatLngTuple} from 'leaflet';

import {formatTimestamp} from '../lib/export';
import type {ParsedPoint} from '../types';

type PointsMapProps = {
  points: ParsedPoint[];
  selectedId: number | null;
  onSelectId: (id: number) => void;
  /** Pan map to the selected point when it changes (point-to-point nav). */
  focusSelected?: boolean;
};

function FitBounds({positions}: {positions: LatLngTuple[]}) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) {
      return;
    }
    if (positions.length === 1) {
      map.setView(positions[0]!, 15);
      return;
    }
    const bounds: LatLngBoundsExpression = positions;
    map.fitBounds(bounds, {padding: [48, 48], maxZoom: 16});
  }, [map, positions]);

  return null;
}

function FlyToSelected({
  point,
  enabled,
}: {
  point: ParsedPoint | null;
  enabled: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || point == null) {
      return;
    }
    const zoom = Math.max(map.getZoom(), 16);
    map.flyTo([point.lat, point.lng], zoom, {duration: 0.35});
  }, [enabled, map, point]);

  return null;
}

function SelectedMarkerPopup({
  point,
  enabled,
}: {
  point: ParsedPoint | null;
  enabled: boolean;
}) {
  const markerRef = useRef<LeafletCircleMarker | null>(null);

  useEffect(() => {
    if (!enabled || point == null) {
      markerRef.current?.closePopup();
      return;
    }
    markerRef.current?.bringToFront();
    markerRef.current?.openPopup();
  }, [enabled, point]);

  if (!enabled || point == null) {
    return null;
  }

  return (
    <CircleMarker
      ref={markerRef}
      center={[point.lat, point.lng]}
      radius={11}
      pathOptions={{
        color: '#1c1c1e',
        weight: 3,
        fillColor: '#ff9500',
        fillOpacity: 1,
      }}
      eventHandlers={{
        click: () => {
          /* selection handled by underlying marker */
        },
      }}>
      <Popup autoPan>
        <div className="popup">
          <strong>#{point.id}</strong>
          <div>{formatTimestamp(point.timestamp)}</div>
          <div>
            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
          </div>
          {point.accuracy != null ? (
            <div>±{point.accuracy.toFixed(0)} m</div>
          ) : null}
          {point.source ? <div className="muted">{point.source}</div> : null}
        </div>
      </Popup>
    </CircleMarker>
  );
}

export function PointsMap({
  points,
  selectedId,
  onSelectId,
  focusSelected = false,
}: PointsMapProps) {
  const positions = useMemo(
    () => points.map(p => [p.lat, p.lng] as LatLngTuple),
    [points],
  );

  const pathPositions = positions;

  const selectedPoint = useMemo(
    () => points.find(p => p.id === selectedId) ?? null,
    [points, selectedId],
  );

  const defaultCenter: LatLngTuple = [33.2148, -97.1331];

  if (points.length === 0) {
    return (
      <div className="map-empty">
        <p>No points for this date.</p>
      </div>
    );
  }

  return (
    <MapContainer
      className="map"
      center={defaultCenter}
      zoom={12}
      scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds positions={positions} />
      <FlyToSelected point={selectedPoint} enabled={focusSelected} />
      <SelectedMarkerPopup point={selectedPoint} enabled={focusSelected} />
      {pathPositions.length > 1 ? (
        <Polyline
          positions={pathPositions}
          pathOptions={{color: '#007aff', weight: 3, opacity: 0.55}}
        />
      ) : null}
      {points.map(point => {
        const isSelected = point.id === selectedId;
        return (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lng]}
            radius={isSelected ? 8 : 5}
            pathOptions={{
              color: isSelected ? '#1c1c1e' : '#ffffff',
              weight: isSelected ? 2.5 : 1.5,
              fillColor: isSelected ? '#ff9500' : '#007aff',
              fillOpacity: isSelected ? 1 : 0.85,
            }}
            eventHandlers={{
              click: () => onSelectId(point.id),
            }}>
            {!focusSelected ? (
              <Popup>
                <div className="popup">
                  <strong>#{point.id}</strong>
                  <div>{formatTimestamp(point.timestamp)}</div>
                  <div>
                    {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                  </div>
                  {point.accuracy != null ? (
                    <div>±{point.accuracy.toFixed(0)} m</div>
                  ) : null}
                  {point.source ? <div className="muted">{point.source}</div> : null}
                </div>
              </Popup>
            ) : null}
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
