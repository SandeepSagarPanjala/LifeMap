import {useMemo} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import MapView, {Marker, Polyline, PROVIDER_DEFAULT} from 'react-native-maps';

import type {LocationPointRow} from '@/db/repositories/location-days';
import {regionForCoordinates, toMapCoordinates} from '@/lib/location-geo';
import {useThemeColors} from '@/hooks/use-theme-colors';

type DayMapViewProps = {
  points: LocationPointRow[];
  selectedPointId?: number | null;
  onSelectPoint?: (point: LocationPointRow) => void;
  className?: string;
};

const MAX_MARKERS = 40;

export function DayMapView({
  points,
  selectedPointId = null,
  onSelectPoint,
  className,
}: DayMapViewProps) {
  const colors = useThemeColors();
  const coordinates = useMemo(() => toMapCoordinates(points), [points]);
  const initialRegion = useMemo(() => regionForCoordinates(coordinates), [coordinates]);

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
    return [first, ...sampled.filter(p => p.id !== first.id && p.id !== last.id), last];
  }, [points]);

  if (points.length === 0) {
    return <View className={`bg-muted rounded-2xl ${className ?? ''}`} style={styles.empty} />;
  }

  return (
    <View className={`overflow-hidden rounded-2xl ${className ?? ''}`} style={styles.mapWrap}>
      <MapView
        key={mapKey}
        provider={Platform.OS === 'ios' ? PROVIDER_DEFAULT : undefined}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={Platform.OS === 'android'}>
        {coordinates.length > 1 ? (
          <Polyline
            coordinates={coordinates}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        ) : null}

        {markerPoints.map(point => (
          <Marker
            key={point.id}
            coordinate={{latitude: point.lat, longitude: point.lng}}
            pinColor={selectedPointId === point.id ? colors.primary : undefined}
            opacity={selectedPointId == null || selectedPointId === point.id ? 1 : 0.5}
            onPress={() => onSelectPoint?.(point)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 320,
  },
  empty: {
    height: 320,
  },
});
