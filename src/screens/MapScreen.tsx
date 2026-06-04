import {useCallback, useMemo, useRef, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Settings} from 'lucide-react-native';
import {Platform, Pressable, StyleSheet, useColorScheme, View} from 'react-native';
import MapView, {
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {MapLocateButton} from '@/components/map/MapLocateButton';
import {RoutePathOverlay} from '@/components/map/RoutePathOverlay';
import {useLocationPointsForDay} from '@/hooks/use-location-days';
import {getTodayDateKey} from '@/lib/day-utils';
import {animateRecenterToUser, centerMapOnUser} from '@/lib/map-location-utils';
import type {RootStackParamList} from '@/navigation/types';
import {useAppStore} from '@/stores/app-store';
import {useThemeColors} from '@/hooks/use-theme-colors';

/** Fallback before GPS fix (wide area — replaced when location arrives). */
const FALLBACK_REGION: Region = {
  latitude: 33.2148,
  longitude: -97.1331,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const SETTINGS_TOP_GAP = 8;
const SETTINGS_SIZE = 44;
const LOCATE_BUTTON_BOTTOM_GAP = 20;

export function MapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = useThemeColors();
  const preferredMapApp = useAppStore(state => state.preferredMapApp);
  const todayKey = getTodayDateKey();
  const {data: todayPoints} = useLocationPointsForDay(todayKey);
  const mapRef = useRef<MapView>(null);
  const hasCenteredOnOpenRef = useRef(false);
  const [mapRegion, setMapRegion] = useState<Region>(FALLBACK_REGION);
  const [userCoordinate, setUserCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const provider =
    Platform.OS === 'android' && preferredMapApp === 'google'
      ? PROVIDER_GOOGLE
      : PROVIDER_DEFAULT;

  const locateButtonBottom = insets.bottom + LOCATE_BUTTON_BOTTOM_GAP;

  const mapPadding = useMemo(
    () => ({
      top: insets.top + SETTINGS_TOP_GAP + SETTINGS_SIZE,
      right: 12,
      bottom: locateButtonBottom + 52,
      left: 12,
    }),
    [insets.top, locateButtonBottom],
  );

  const onRegionChange = useCallback((region: Region) => {
    setMapRegion(region);
  }, []);

  const goToCurrentLocation = useCallback(() => {
    if (!userCoordinate || !mapRef.current) {
      return;
    }
    animateRecenterToUser(mapRef.current, userCoordinate, mapRegion);
  }, [mapRegion, userCoordinate]);

  const handleUserLocation = useCallback(
    (coordinate: {latitude: number; longitude: number}) => {
      setUserCoordinate(coordinate);

      if (hasCenteredOnOpenRef.current || !mapRef.current) {
        return;
      }
      hasCenteredOnOpenRef.current = true;
      const region = centerMapOnUser(mapRef.current, coordinate, true);
      setMapRegion(region);
    },
    [],
  );

  return (
    <View className="bg-background flex-1">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={provider}
        initialRegion={FALLBACK_REGION}
        mapPadding={mapPadding}
        legalLabelInsets={{top: 0, right: 0, bottom: locateButtonBottom, left: 72}}
        showsUserLocation
        showsMyLocationButton={false}
        userLocationPriority="high"
        userInterfaceStyle={colorScheme === 'dark' ? 'dark' : 'light'}
        followsUserLocation={false}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={onRegionChange}
        onUserLocationChange={event => {
          const coordinate = event.nativeEvent.coordinate;
          if (coordinate) {
            handleUserLocation(coordinate);
          }
        }}>
        <RoutePathOverlay points={todayPoints} />
      </MapView>

      <MapLocateButton bottom={locateButtonBottom} onPress={goToCurrentLocation} />

      <View
        pointerEvents="box-none"
        style={[styles.topBar, {paddingTop: insets.top + SETTINGS_TOP_GAP, paddingLeft: 16}]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => navigation.navigate('Settings')}
          style={styles.settingsButton}>
          <Settings size={22} color={colors.primary} strokeWidth={2.25} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  settingsButton: {
    width: SETTINGS_SIZE,
    height: SETTINGS_SIZE,
    borderRadius: SETTINGS_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
});
