import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import type { LocationPointRow } from '@/db/repositories/location-days';
import { regionForCoordinates, toMapCoordinates } from '@/lib/location-geo';
import { mapProviderForPlatform } from '@/lib/map-provider';
import { useThemeColors } from '@/hooks/use-theme-colors';

type DayMapViewProps = {
  points: LocationPointRow[];
  selectedPointId?: number | null;
  onSelectPoint?: (point: LocationPointRow) => void;
  className?: string;
  playbackIndex?: number | null;
};

const MAX_MARKERS = 40;

export function DayMapView({
  points,
  selectedPointId = null,
  onSelectPoint,
  className,
  playbackIndex = null,
}: DayMapViewProps) {
  const colors = useThemeColors();
  const coordinates = useMemo(() => toMapCoordinates(points), [points]);
  const initialRegion = useMemo(
    () => regionForCoordinates(coordinates),
    [coordinates],
  );
  const provider = useMemo(() => mapProviderForPlatform(), []);

  const mapKey = useMemo(() => {
    if (points.length === 0) {
      return 'empty';
    }
    const first = points[0]!;
    const last = points[points.length - 1]!;
    return `${points.length}-${first.id}-${last.id}`;
  }, [points]);

  const markerPoints = useMemo(() => {
    if (points.length <= MAX_MARKERS) {
      return points;
    }
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const step = Math.ceil((points.length - 2) / (MAX_MARKERS - 2));
    const sampled = points.filter((_, index) => index % step === 0);
    return [
      first,
      ...sampled.filter(p => p.id !== first.id && p.id !== last.id),
      last,
    ];
  }, [points]);

  const playbackCoordinates = useMemo(() => {
    if (playbackIndex == null || playbackIndex < 0) {
      return coordinates;
    }
    const endIndex = Math.min(playbackIndex + 1, coordinates.length);
    return coordinates.slice(0, endIndex);
  }, [coordinates, playbackIndex]);

  const playbackPoint = useMemo(() => {
    if (
      playbackIndex == null ||
      playbackIndex < 0 ||
      playbackIndex >= points.length
    ) {
      return null;
    }
    return points[playbackIndex] ?? null;
  }, [points, playbackIndex]);

  if (points.length === 0) {
    return (
      <View
        className={`bg-muted rounded-2xl ${className ?? ''}`}
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
        provider={provider}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={Platform.OS === 'android'}
      >
        {playbackCoordinates.length > 1 ? (
          <Polyline
            coordinates={playbackCoordinates}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        ) : null}

        {playbackPoint ? (
          <Marker
            coordinate={{
              latitude: playbackPoint.lat,
              longitude: playbackPoint.lng,
            }}
            pinColor={colors.primary}
          />
        ) : null}

        {markerPoints.map(point => (
          <Marker
            key={point.id}
            coordinate={{ latitude: point.lat, longitude: point.lng }}
            pinColor={selectedPointId === point.id ? colors.primary : undefined}
            opacity={
              playbackPoint
                ? point.id === playbackPoint.id
                  ? 1
                  : 0
                : selectedPointId == null || selectedPointId === point.id
                ? 1
                : 0.5
            }
            onPress={() => onSelectPoint?.(point)}
          />
        ))}
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
