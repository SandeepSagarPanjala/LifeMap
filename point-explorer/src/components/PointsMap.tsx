import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type {
  LatLngBounds,
  LatLngBoundsExpression,
  LatLngTuple,
  Marker as LeafletMarker,
} from 'leaflet';

import { formatTimestamp } from '../lib/export';
import {
  activityFillColor,
  activityPointIcon,
} from '../lib/activity-point-icon';
import {
  DEFAULT_STOP_CONFIG,
  formatDuration,
  isMovingPoint,
  splitTravelModeRuns,
  type Stop,
} from '@lifemap/segmentation';
import type { ParsedPoint } from '../types';

const EARTH_RADIUS_M = 6_371_000;
/** DivIcons are DOM-heavy — only use them when zoomed in. */
const ACTIVITY_ICON_MIN_ZOOM = 16;
/** Hard cap so a dense stay doesn't spawn hundreds of DOM markers. */
const ACTIVITY_ICON_MAX_COUNT = 280;

function distanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

type PointsMapProps = {
  points: ParsedPoint[];
  stops?: Stop[];
  selectedStopId?: string | null;
  onSelectStop?: (stopId: string) => void;
  highlightedPointIds?: ReadonlySet<number> | null;
  selectedId: number | null;
  onSelectId: (id: number) => void;
  /** Pan map to the selected point when it changes (point-to-point nav). */
  focusSelected?: boolean;
};

function FitBounds({ positions }: { positions: LatLngTuple[] }) {
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
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
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
    const zoom = Math.max(map.getZoom(), 19);
    map.flyTo([point.lat, point.lng], zoom, { duration: 0.35 });
  }, [enabled, map, point]);

  return null;
}

function FlyToStop({ stop }: { stop: Stop | null }) {
  const map = useMap();

  useEffect(() => {
    if (stop == null) {
      return;
    }
    const radius = Math.max(stop.spreadM, 40);
    const earthM = 111_320;
    const latPad = (radius * 2.2) / earthM;
    const lngPad =
      (radius * 2.2) / (earthM * Math.cos((stop.lat * Math.PI) / 180));
    const flyBounds: LatLngBoundsExpression = [
      [stop.lat - latPad, stop.lng - lngPad],
      [stop.lat + latPad, stop.lng + lngPad],
    ];
    map.flyToBounds(flyBounds, { duration: 0.4, maxZoom: 19 });
  }, [map, stop]);

  return null;
}

function SelectedMarkerPopup({
  point,
  enabled,
}: {
  point: ParsedPoint | null;
  enabled: boolean;
}) {
  const markerRef = useRef<LeafletMarker | null>(null);

  useEffect(() => {
    if (!enabled || point == null) {
      return;
    }
    markerRef.current?.setZIndexOffset(1000);
  }, [enabled, point]);

  if (!enabled || point == null) {
    return null;
  }

  return (
    <Marker
      ref={markerRef}
      position={[point.lat, point.lng]}
      icon={activityPointIcon({
        activityType: point.activityType,
        selected: true,
      })}
      zIndexOffset={1000}
      interactive={false}
    />
  );
}

function useActivityIconViewport(): {
  showIcons: boolean;
  bounds: LatLngBounds | null;
} {
  const map = useMap();
  const [showIcons, setShowIcons] = useState(
    () => map.getZoom() >= ACTIVITY_ICON_MIN_ZOOM,
  );
  const [bounds, setBounds] = useState<LatLngBounds | null>(() =>
    map.getBounds().pad(0.12),
  );

  useMapEvents({
    zoomend() {
      setShowIcons(map.getZoom() >= ACTIVITY_ICON_MIN_ZOOM);
      setBounds(map.getBounds().pad(0.12));
    },
    moveend() {
      setBounds(map.getBounds().pad(0.12));
    },
  });

  return { showIcons, bounds };
}

function PointHoverContent({
  point,
  moving,
  mph,
  distToStop,
  isStopMember,
  isStopStart,
  isStopEnd,
}: {
  point: ParsedPoint;
  moving: boolean;
  mph: number | null;
  distToStop: number | null;
  isStopMember: boolean;
  isStopStart: boolean;
  isStopEnd: boolean;
}) {
  return (
    <div className="popup">
      {isStopStart ? (
        <strong style={{ color: '#af52de' }}>Stay Started</strong>
      ) : null}
      {isStopEnd ? (
        <strong style={{ color: '#000000' }}>Stop ended</strong>
      ) : null}
      <strong>#{point.id}</strong>
      <div>{formatTimestamp(point.timestamp)}</div>
      <div>
        speed: {mph == null ? 'n/a' : `${mph.toFixed(1)} mph`}{' '}
        <strong style={{ color: moving ? '#ff3b30' : '#34c759' }}>
          {moving ? 'DRIVING' : 'stationary'}
        </strong>
      </div>
      <div>
        activity:{' '}
        {point.activityType != null && point.activityType !== ''
          ? point.activityType
          : 'n/a'}
        {point.activityConfidence != null
          ? ` (${point.activityConfidence}%)`
          : ''}
        {point.isMoving != null
          ? ` · isMoving=${point.isMoving ? 'true' : 'false'}`
          : ''}
      </div>
      {distToStop != null ? (
        <div>
          {Math.round(distToStop)} m from stop center ·{' '}
          {isStopMember ? 'in stop' : 'excluded'}
        </div>
      ) : null}
      {!moving ? (
        <div className="muted">
          counts toward stop (≤ {DEFAULT_STOP_CONFIG.movingSpeedMps} m/s)
        </div>
      ) : (
        <div className="muted">
          kept in drive (≥ {DEFAULT_STOP_CONFIG.movingSpeedMps} m/s)
        </div>
      )}
    </div>
  );
}

function ActivityPointsLayer({
  points,
  highlightedPointIds,
  selectedId,
  onSelectId,
  focusSelected,
  selectedStop,
  stopStartId,
  stopEndId,
}: {
  points: ParsedPoint[];
  highlightedPointIds: ReadonlySet<number> | null;
  selectedId: number | null;
  onSelectId: (id: number) => void;
  focusSelected: boolean;
  selectedStop: Stop | null;
  stopStartId: number | null;
  stopEndId: number | null;
}) {
  const { showIcons, bounds } = useActivityIconViewport();

  const iconPointIds = useMemo(() => {
    if (!showIcons || bounds == null) {
      return null;
    }
    const ids = new Set<number>();
    for (const point of points) {
      if (!bounds.contains([point.lat, point.lng])) {
        continue;
      }
      ids.add(point.id);
      if (ids.size >= ACTIVITY_ICON_MAX_COUNT) {
        break;
      }
    }
    // Always prefer icons for selected / stop-edge points when zoomed in.
    for (const point of points) {
      if (
        point.id === selectedId ||
        point.id === stopStartId ||
        point.id === stopEndId
      ) {
        ids.add(point.id);
      }
    }
    return ids;
  }, [bounds, points, selectedId, showIcons, stopEndId, stopStartId]);

  return (
    <>
      {points.map(point => {
        const isSelected = point.id === selectedId;
        const isMotionDeparture = point.source === 'motion_departure';
        const isStopMember = highlightedPointIds?.has(point.id) ?? false;
        const dimmed = highlightedPointIds != null && !isStopMember;
        const moving = isMovingPoint(point, DEFAULT_STOP_CONFIG);
        const mph =
          point.speed == null ? null : Math.max(0, point.speed) * 2.237;
        const distToStop =
          selectedStop != null ? distanceM(selectedStop, point) : null;
        const isStopStart = point.id === stopStartId;
        const isStopEnd = point.id === stopEndId;
        const useIcon = iconPointIds?.has(point.id) ?? false;

        const hover = (
          <Tooltip
            permanent={isStopStart || isStopEnd}
            direction="top"
            offset={[0, useIcon ? -12 : isStopStart || isStopEnd ? -8 : -4]}
            opacity={1}
            className={
              isStopStart
                ? 'stop-edge-label start'
                : isStopEnd
                ? 'stop-edge-label end'
                : undefined
            }
          >
            <PointHoverContent
              point={point}
              moving={moving}
              mph={mph}
              distToStop={distToStop}
              isStopMember={isStopMember}
              isStopStart={isStopStart}
              isStopEnd={isStopEnd}
            />
          </Tooltip>
        );

        const popup =
          !focusSelected ? (
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
                <div>
                  activity:{' '}
                  {point.activityType != null && point.activityType !== ''
                    ? point.activityType
                    : 'n/a'}
                  {point.activityConfidence != null
                    ? ` (${point.activityConfidence}%)`
                    : ''}
                </div>
                {point.source ? (
                  <div className="muted">{point.source}</div>
                ) : null}
              </div>
            </Popup>
          ) : null;

        if (useIcon) {
          return (
            <Marker
              key={`icon-${point.id}`}
              position={[point.lat, point.lng]}
              icon={activityPointIcon({
                activityType: point.activityType,
                selected: isSelected,
                stopMember: isStopMember,
                dimmed,
                stopStart: isStopStart,
                stopEnd: isStopEnd,
                motionDeparture: isMotionDeparture,
              })}
              zIndexOffset={
                isStopStart || isStopEnd ? 600 : isSelected ? 500 : 0
              }
              eventHandlers={{
                click: () => onSelectId(point.id),
              }}
            >
              {hover}
              {popup}
            </Marker>
          );
        }

        const fillColor = isStopStart
          ? '#af52de'
          : isStopEnd
          ? '#000000'
          : isSelected
          ? '#ff9500'
          : isStopMember
          ? '#ff3b30'
          : isMotionDeparture
          ? '#ff9500'
          : activityFillColor(point.activityType);

        return (
          <CircleMarker
            key={`dot-${point.id}`}
            center={[point.lat, point.lng]}
            radius={
              isStopStart || isStopEnd
                ? 8
                : isSelected
                ? 8
                : isStopMember
                ? 6
                : 5
            }
            pathOptions={{
              color:
                isStopStart || isStopEnd
                  ? '#ffffff'
                  : isSelected
                  ? '#1c1c1e'
                  : '#ffffff',
              weight: isStopStart || isStopEnd ? 2.5 : isSelected ? 2.5 : 1.5,
              fillColor,
              fillOpacity:
                isStopStart || isStopEnd
                  ? 1
                  : isSelected
                  ? 1
                  : dimmed
                  ? 0.25
                  : 0.85,
            }}
            eventHandlers={{
              click: () => onSelectId(point.id),
            }}
          >
            {hover}
            {popup}
          </CircleMarker>
        );
      })}
    </>
  );
}

export function PointsMap({
  points,
  stops = [],
  selectedStopId = null,
  onSelectStop,
  highlightedPointIds = null,
  selectedId,
  onSelectId,
  focusSelected = false,
}: PointsMapProps) {
  const positions = useMemo(
    () => points.map(p => [p.lat, p.lng] as LatLngTuple),
    [points],
  );

  // Which stop (if any) a point falls into, decided by TIME WINDOW rather than
  // exact id. This is robust to de-duplicated shadow twins and filtered fixes
  // that sit between stop members but are not in the stop's pointIds.
  const stopIdForTime = useMemo(() => {
    const windows = stops
      .map(s => ({
        id: s.id,
        start: s.arrivedAt.getTime(),
        end: s.leftAt.getTime(),
      }))
      .sort((a, b) => a.start - b.start);
    return (ms: number): string | null => {
      for (const w of windows) {
        if (ms >= w.start && ms <= w.end) {
          return w.id;
        }
      }
      return null;
    };
  }, [stops]);

  // Travel = between stops (drive paths only). Stay interiors use inStop
  // scatter dashes — never on-foot walk dashes inside a visit.
  const { travelSolidSegments, travelFootSegments, inStopSegments } =
    useMemo(() => {
      const sorted = [...points].sort(
        (a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id,
      );
      const travelRuns: ParsedPoint[][] = [];
      const inStop: LatLngTuple[][] = [];
      let currentTravel: ParsedPoint[] = [];

      const flushTravel = () => {
        if (currentTravel.length >= 2) {
          travelRuns.push(currentTravel);
        }
        currentTravel = [];
      };

      for (let k = 0; k < sorted.length - 1; k += 1) {
        const a = sorted[k]!;
        const b = sorted[k + 1]!;
        const stopA = stopIdForTime(a.at.getTime());
        const stopB = stopIdForTime(b.at.getTime());
        if (stopA != null && stopA === stopB) {
          flushTravel();
          inStop.push([
            [a.lat, a.lng],
            [b.lat, b.lng],
          ]);
          continue;
        }
        if (currentTravel.length === 0) {
          currentTravel.push(a, b);
        } else {
          currentTravel.push(b);
        }
      }
      flushTravel();

      const solid: LatLngTuple[][] = [];
      const foot: LatLngTuple[][] = [];
      for (const run of travelRuns) {
        for (const modeRun of splitTravelModeRuns(run, { pathKind: 'drive' })) {
          const coords: LatLngTuple[] = modeRun.points.map(p => [
            p.lat,
            p.lng,
          ]);
          if (coords.length < 2) {
            continue;
          }
          if (modeRun.style === 'dashed') {
            foot.push(coords);
          } else {
            solid.push(coords);
          }
        }
      }

      return {
        travelSolidSegments: solid,
        travelFootSegments: foot,
        inStopSegments: inStop,
      };
    }, [points, stopIdForTime]);

  const selectedPoint = useMemo(
    () => points.find(p => p.id === selectedId) ?? null,
    [points, selectedId],
  );

  const selectedStop = useMemo(
    () => stops.find(s => s.id === selectedStopId) ?? null,
    [stops, selectedStopId],
  );

  const stopStartId =
    selectedStop != null && selectedStop.pointIds.length > 0
      ? selectedStop.pointIds[0]!
      : null;
  const stopEndId =
    selectedStop != null && selectedStop.pointIds.length > 0
      ? selectedStop.pointIds[selectedStop.pointIds.length - 1]!
      : null;

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
      preferCanvas
      center={defaultCenter}
      zoom={12}
      maxZoom={28}
      zoomSnap={0.25}
      zoomDelta={0.5}
      scrollWheelZoom
      wheelPxPerZoomLevel={80}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={28}
        maxNativeZoom={19}
      />
      <FitBounds positions={positions} />
      <FlyToSelected point={selectedPoint} enabled={focusSelected} />
      <FlyToStop stop={selectedStop} />
      <SelectedMarkerPopup point={selectedPoint} enabled={focusSelected} />
      {travelSolidSegments.length > 0 ? (
        <Polyline
          positions={travelSolidSegments}
          pathOptions={{ color: '#8e8e93', weight: 2, opacity: 0.35 }}
        />
      ) : null}
      {travelFootSegments.length > 0 ? (
        <Polyline
          positions={travelFootSegments}
          pathOptions={{
            color: '#8e8e93',
            weight: 2.5,
            opacity: 0.55,
            dashArray: '6 8',
          }}
        />
      ) : null}
      {inStopSegments.length > 0 ? (
        <Polyline
          positions={inStopSegments}
          pathOptions={{
            color: '#8e8e93',
            weight: 2,
            opacity: 0.3,
            dashArray: '4 6',
          }}
        />
      ) : null}
      {stops.map((stop, index) => (
        <Circle
          key={stop.id}
          center={[stop.lat, stop.lng]}
          radius={Math.max(stop.spreadM, 40)}
          pathOptions={{
            color: '#ff3b30',
            weight: stop.id === selectedStopId ? 3 : 2,
            fillColor: '#ff3b30',
            fillOpacity: stop.id === selectedStopId ? 0.28 : 0.18,
          }}
          eventHandlers={{
            click: () => onSelectStop?.(stop.id),
          }}
        >
          <Popup>
            <div className="popup">
              <strong>Stop #{index + 1}</strong>
              <div>{formatTimestamp(stop.arrivedAt.toISOString())}</div>
              <div>{formatDuration(stop.durationMs)}</div>
              <div className="muted">
                {stop.pointCount} pts · spread {Math.round(stop.spreadM)} m
              </div>
            </div>
          </Popup>
        </Circle>
      ))}
      <ActivityPointsLayer
        points={points}
        highlightedPointIds={highlightedPointIds}
        selectedId={selectedId}
        onSelectId={onSelectId}
        focusSelected={focusSelected}
        selectedStop={selectedStop}
        stopStartId={stopStartId}
        stopEndId={stopEndId}
      />
    </MapContainer>
  );
}
