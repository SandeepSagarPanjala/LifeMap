import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { PlacePoiRow } from '@/lib/place-lookup-types';
import { regionForVenueRadius } from '@/lib/location-geo';
import { mapProviderForPlatform } from '@/lib/map-provider';

const ANCHOR_PIN_COLOR = '#007AFF';
const POI_PIN_COLOR = '#34C759';
const USER_POI_PIN_COLOR = '#FF9500';

type CachedPlaceMapViewProps = {
  anchor: { lat: number; lng: number };
  addressLabel: string | null;
  venueRadiusMeters: number;
  pois: readonly PlacePoiRow[];
};

export function CachedPlaceMapView({
  anchor,
  addressLabel,
  venueRadiusMeters,
  pois,
}: CachedPlaceMapViewProps) {
  const colors = useThemeColors();
  const provider = useMemo(() => mapProviderForPlatform(), []);

  const initialRegion = useMemo(
    () => regionForVenueRadius(anchor, venueRadiusMeters, 1.25),
    [anchor, venueRadiusMeters],
  );

  const anchorTitle = addressLabel?.trim() || 'Address';

  return (
    <View style={styles.wrap}>
      <MapView
        provider={provider}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <Circle
          center={{ latitude: anchor.lat, longitude: anchor.lng }}
          radius={venueRadiusMeters}
          fillColor="rgba(0, 122, 255, 0.08)"
          strokeColor="rgba(0, 122, 255, 0.35)"
          strokeWidth={1}
          zIndex={0}
        />
        <Marker
          coordinate={{ latitude: anchor.lat, longitude: anchor.lng }}
          pinColor={ANCHOR_PIN_COLOR}
          title={anchorTitle}
          description="Geocoded address"
          zIndex={2}
        />
        {pois.map(poi => (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.lat, longitude: poi.lng }}
            pinColor={
              poi.source === 'user' ? USER_POI_PIN_COLOR : POI_PIN_COLOR
            }
            title={poi.name}
            description={
              poi.source === 'user'
                ? 'Custom POI'
                : `${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}`
            }
            zIndex={1}
          />
        ))}
      </MapView>

      <View
        style={[
          styles.legend,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <LegendRow color={ANCHOR_PIN_COLOR} label="Address (geocode)" />
        <LegendRow color={POI_PIN_COLOR} label="Nearby POI" />
        <LegendRow color={USER_POI_PIN_COLOR} label="Custom POI" />
      </View>
    </View>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text className="text-xs">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  legend: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
