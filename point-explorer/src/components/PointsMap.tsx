import {useEffect, useMemo} from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import type {LatLngBoundsExpression, LatLngTuple} from 'leaflet';

import {formatTimestamp} from '../lib/export';
import type {ParsedPoint} from '../types';

type PointsMapProps = {
  points: ParsedPoint[];
  selectedId: number | null;
  onSelectId: (id: number) => void;
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

export function PointsMap({points, selectedId, onSelectId}: PointsMapProps) {
  const positions = useMemo(
    () => points.map(p => [p.lat, p.lng] as LatLngTuple),
    [points],
  );

  const pathPositions = positions;

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
            radius={isSelected ? 9 : 5}
            pathOptions={{
              color: isSelected ? '#1c1c1e' : '#ffffff',
              weight: isSelected ? 2.5 : 1.5,
              fillColor: isSelected ? '#ff9500' : '#007aff',
              fillOpacity: isSelected ? 1 : 0.85,
            }}
            eventHandlers={{
              click: () => onSelectId(point.id),
            }}>
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
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
