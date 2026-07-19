import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, {
  Circle,
  Polyline,
  type Region,
} from 'react-native-maps';

import type { LocationPointRow } from '@/db/repositories/location-days';
import { regionForCoordinates, toMapCoordinates } from '@/lib/location-geo';
import { mapProviderForPlatform } from '@/lib/map-provider';
import { DEFAULT_STOP_CONFIG, type Stop } from '@/lib/segmentation/stops';

const STOP_COLOR = '#ff3b30';
const TRAVEL_COLOR = '#007aff';
const POINT_COLOR = '#007aff';
const HIGHLIGHT_COLOR = '#ff3b30';
const STOP_START_COLOR = '#af52de';
const STOP_END_COLOR = '#000000';
const MAX_POINT_CIRCLES = 200;

export type BenchmarkMapVariant = 'stops' | 'trips';

type BenchmarkMapViewProps = {
  points: LocationPointRow[];
  stops?: Stop[];
  selectedStopId?: string | null;
  highlightedPointIds?: ReadonlySet<number> | null;
  variant?: BenchmarkMapVariant;
  className?: string;
};

function regionForStop(stop: Stop): Region {
  const radius = Math.max(stop.spreadM, 40);
  const latDelta = (radius * 2.2) / 111_320;
  const lngDelta =
    (radius * 2.2) / (111_320 * Math.cos((stop.lat * Math.PI) / 180));
  return {
    latitude: stop.lat,
    longitude: stop.lng,
    latitudeDelta: Math.max(latDelta * 2, 0.004),
    longitudeDelta: Math.max(lngDelta * 2, 0.004),
  };
}

function buildTrackSegments(
  points: LocationPointRow[],
  stops: Stop[],
): {
  travel: { latitude: number; longitude: number }[][];
  inStop: { latitude: number; longitude: number }[][];
} {
  const windows = stops
    .map(stop => ({
      id: stop.id,
      start: stop.arrivedAt.getTime(),
      end: stop.leftAt.getTime(),
    }))
    .sort((a, b) => a.start - b.start);

  const stopIdForTime = (ms: number): string | null => {
    for (const window of windows) {
      if (ms >= window.start && ms <= window.end) {
        return window.id;
      }
    }
    return null;
  };

  const sorted = [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.id - b.id,
  );
  const travel: { latitude: number; longitude: number }[][] = [];
  const inStop: { latitude: number; longitude: number }[][] = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const a = sorted[index]!;
    const b = sorted[index + 1]!;
    const segment = [
      { latitude: a.lat, longitude: a.lng },
      { latitude: b.lat, longitude: b.lng },
    ];
    const stopA = stopIdForTime(a.timestamp.getTime());
    const stopB = stopIdForTime(b.timestamp.getTime());
    if (stopA != null && stopA === stopB) {
      inStop.push(segment);
    } else {
      travel.push(segment);
    }
  }

  return { travel, inStop };
}

function buildInStopPolyline(
  points: LocationPointRow[],
): { latitude: number; longitude: number }[][] {
  const sorted = [...points].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.id - b.id,
  );
  const segments: { latitude: number; longitude: number }[][] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const a = sorted[index]!;
    const b = sorted[index + 1]!;
    segments.push([
      { latitude: a.lat, longitude: a.lng },
      { latitude: b.lat, longitude: b.lng },
    ]);
  }
  return segments;
}

function samplePoints(
  points: LocationPointRow[],
  maxCount: number,
): LocationPointRow[] {
  if (points.length <= maxCount) {
    return points;
  }
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const middle = points.slice(1, -1);
  const step = Math.ceil(middle.length / (maxCount - 2));
  const sampled = middle.filter((_, index) => index % step === 0);
  return [first, ...sampled, last];
}

export function BenchmarkMapView({
  points,
  stops = [],
  selectedStopId = null,
  highlightedPointIds = null,
  variant = 'trips',
  className,
}: BenchmarkMapViewProps) {
  const mapRef = useRef<MapView | null>(null);
  const coordinates = useMemo(() => toMapCoordinates(points), [points]);
  const initialRegion = useMemo(
    () => regionForCoordinates(coordinates),
    [coordinates],
  );
  const provider = useMemo(() => mapProviderForPlatform(), []);

  const selectedStop = useMemo(
    () => stops.find(stop => stop.id === selectedStopId) ?? null,
    [stops, selectedStopId],
  );

  const visibleStops = useMemo(() => {
    if (selectedStopId == null) {
      return stops;
    }
    return stops.filter(stop => stop.id === selectedStopId);
  }, [stops, selectedStopId]);

  const stopStartId =
    selectedStop != null && selectedStop.pointIds.length > 0
      ? selectedStop.pointIds[0]!
      : null;
  const stopEndId =
    selectedStop != null && selectedStop.pointIds.length > 0
      ? selectedStop.pointIds[selectedStop.pointIds.length - 1]!
      : null;

  const displayPoints = useMemo(() => {
    if (highlightedPointIds != null) {
      return points.filter(point => highlightedPointIds.has(point.id));
    }
    return samplePoints(points, MAX_POINT_CIRCLES);
  }, [highlightedPointIds, points]);

  const { travel, inStop } = useMemo(() => {
    if (variant === 'stops') {
      if (highlightedPointIds != null) {
        return { travel: [], inStop: buildInStopPolyline(displayPoints) };
      }
      return { travel: [], inStop: [] };
    }
    return buildTrackSegments(points, visibleStops);
  }, [displayPoints, highlightedPointIds, points, variant, visibleStops]);

  const mapKey = useMemo(() => {
    if (points.length === 0) {
      return 'empty';
    }
    const first = points[0]!;
    const last = points[points.length - 1]!;
    return `${variant}-${points.length}-${first.id}-${last.id}`;
  }, [points, variant]);

  useEffect(() => {
    if (selectedStop != null) {
      mapRef.current?.animateToRegion(regionForStop(selectedStop), 300);
      return;
    }
    if (coordinates.length > 0) {
      mapRef.current?.animateToRegion(initialRegion, 300);
    }
  }, [coordinates.length, initialRegion, selectedStop]);

  if (points.length === 0) {
    return (
      <View
        className={`bg-muted items-center justify-center rounded-2xl ${
          className ?? ''
        }`}
        style={styles.empty}
      />
    );
  }

  return (
    <View
      className={`overflow-hidden rounded-2xl ${className ?? ''}`}
      style={styles.mapWrap}
    >
      <MapView
        key={mapKey}
        ref={mapRef}
        provider={provider}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {variant === 'trips'
          ? travel.map((segment, index) => (
              <Polyline
                key={`travel-${index}`}
                coordinates={segment}
                strokeColor={TRAVEL_COLOR}
                strokeWidth={3}
                lineCap="round"
                lineJoin="round"
                zIndex={1}
              />
            ))
          : null}
        {inStop.map((segment, index) => (
          <Polyline
            key={`instop-${index}`}
            coordinates={segment}
            strokeColor={TRAVEL_COLOR}
            strokeWidth={2}
            lineDashPattern={variant === 'stops' ? [4, 6] : [4, 6]}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
        ))}

        {visibleStops.map(stop => (
          <Circle
            key={stop.id}
            center={{ latitude: stop.lat, longitude: stop.lng }}
            radius={Math.max(stop.spreadM, DEFAULT_STOP_CONFIG.radiusM / 2)}
            fillColor={
              stop.id === selectedStopId
                ? 'rgba(255, 59, 48, 0.28)'
                : 'rgba(255, 59, 48, 0.18)'
            }
            strokeColor={STOP_COLOR}
            strokeWidth={stop.id === selectedStopId ? 3 : 2}
            zIndex={2}
          />
        ))}

        {displayPoints.map(point => {
          const isHighlighted = highlightedPointIds?.has(point.id) ?? false;
          const isStopStart = point.id === stopStartId;
          const isStopEnd = point.id === stopEndId;
          const fillColor = isStopStart
            ? STOP_START_COLOR
            : isStopEnd
            ? STOP_END_COLOR
            : isHighlighted || highlightedPointIds != null
            ? HIGHLIGHT_COLOR
            : POINT_COLOR;
          const radius = isStopStart || isStopEnd ? 10 : isHighlighted ? 8 : 6;

          return (
            <Circle
              key={point.id}
              center={{ latitude: point.lat, longitude: point.lng }}
              radius={radius}
              fillColor={fillColor}
              strokeColor="#ffffff"
              strokeWidth={isStopStart || isStopEnd ? 2.5 : 1.5}
              zIndex={isStopStart || isStopEnd ? 4 : 3}
            />
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    flex: 1,
  },
  empty: {
    flex: 1,
  },
});
