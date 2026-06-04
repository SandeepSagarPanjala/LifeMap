import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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

import {HistoryEventCard} from '@/components/map/HistoryEventCard';
import {HistoryTimelineBar} from '@/components/map/HistoryTimelineBar';
import {MapHistoryButton} from '@/components/map/MapHistoryButton';
import {MapLocateButton} from '@/components/map/MapLocateButton';
import {RoutePathOverlay} from '@/components/map/RoutePathOverlay';
import {StayDurationCallout} from '@/components/map/StayDurationCallout';
import {TripRouteOverlay} from '@/components/map/TripRouteOverlay';
import {useHistoryData} from '@/hooks/use-history-data';
import {useTripPlayback} from '@/hooks/use-trip-playback';
import {useLocationPointsForDay} from '@/hooks/use-location-days';
import {getTodayDateKey} from '@/lib/day-utils';
import {isPlayableTimelineEntry} from '@/lib/trip-detection';
import {useTripDetectionConfig} from '@/hooks/use-trip-detection-config';
import {getTripPlaybackDurationMs} from '@/lib/trip-playback';
import {regionForCoordinates, toMapCoordinates} from '@/lib/location-geo';
import {animateRecenterToUser, centerMapOnUser} from '@/lib/map-location-utils';
import type {RootStackParamList} from '@/navigation/types';
import {useAppStore} from '@/stores/app-store';
import {useThemeColors} from '@/hooks/use-theme-colors';

const FALLBACK_REGION: Region = {
  latitude: 33.2148,
  longitude: -97.1331,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const SETTINGS_TOP_GAP = 8;
const SETTINGS_SIZE = 44;
const LOCATE_BUTTON_BOTTOM_GAP = 20;
const HISTORY_PANEL_HEIGHT = 200;

export function MapScreen() {
  const tripDetectionConfig = useTripDetectionConfig();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = useThemeColors();
  const preferredMapApp = useAppStore(state => state.preferredMapApp);
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const todayKey = getTodayDateKey();
  const {data: todayPoints} = useLocationPointsForDay(todayKey);
  const {data: historyData} = useHistoryData();
  const mapRef = useRef<MapView>(null);
  const hasCenteredOnOpenRef = useRef(false);
  const [mapRegion, setMapRegion] = useState<Region>(FALLBACK_REGION);
  const [userCoordinate, setUserCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyFocusOnToday, setHistoryFocusOnToday] = useState(false);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);

  const historyEntries = historyData.entries;
  const historyVisitCount = useMemo(
    () => historyEntries.filter(entry => entry.kind === 'stay').length,
    [historyEntries],
  );

  const selectedEntry = useMemo(() => {
    if (selectedHistoryIndex < 0) {
      return null;
    }
    return historyEntries[selectedHistoryIndex] ?? null;
  }, [historyEntries, selectedHistoryIndex]);

  const selectedPlayable =
    selectedEntry != null && isPlayableTimelineEntry(selectedEntry)
      ? selectedEntry
      : null;

  const playback = useTripPlayback();

  const provider =
    Platform.OS === 'android' && preferredMapApp === 'google'
      ? PROVIDER_GOOGLE
      : PROVIDER_DEFAULT;

  const historyPanelBottom = insets.bottom + HISTORY_PANEL_HEIGHT;
  const locateButtonBottom = historyPanelOpen
    ? historyPanelBottom + 12
    : insets.bottom + LOCATE_BUTTON_BOTTOM_GAP;
  const historyButtonBottom = locateButtonBottom;

  const mapPadding = useMemo(
    () => ({
      top: insets.top + SETTINGS_TOP_GAP + SETTINGS_SIZE,
      right: 12,
      bottom: historyPanelOpen ? historyPanelBottom + 56 : locateButtonBottom + 52,
      left: 12,
    }),
    [insets.top, locateButtonBottom, historyPanelBottom, historyPanelOpen],
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

  const fitSelectedHistory = useCallback(() => {
    if (!mapRef.current || !selectedPlayable) {
      return;
    }
    const region = regionForCoordinates(toMapCoordinates(selectedPlayable.points));
    mapRef.current.animateToRegion(region, 400);
    setMapRegion(region);
  }, [selectedPlayable]);

  const selectHistoryIndex = useCallback(
    (index: number) => {
      playback.stop();
      setHistoryFocusOnToday(false);
      setSelectedHistoryIndex(index);
    },
    [playback],
  );

  const handleToggleHistoryPanel = useCallback(() => {
    setHistoryPanelOpen(open => {
      const next = !open;
      if (next) {
        setSelectedHistoryIndex(-1);
        setHistoryFocusOnToday(true);
      } else {
        playback.stop();
        setSelectedHistoryIndex(-1);
        setHistoryFocusOnToday(false);
      }
      return next;
    });
  }, [playback]);

  const handlePlayHistory = useCallback(() => {
    if (!selectedPlayable || selectedPlayable.kind !== 'travel') {
      return;
    }
    fitSelectedHistory();
    playback.start(getTripPlaybackDurationMs(selectedPlayable.durationMs));
  }, [fitSelectedHistory, playback, selectedPlayable]);

  useEffect(() => {
    if (
      historyPanelOpen &&
      selectedHistoryIndex >= 0 &&
      selectedPlayable &&
      !playback.isPlaying
    ) {
      fitSelectedHistory();
    }
  }, [
    selectedHistoryIndex,
    historyPanelOpen,
    selectedPlayable,
    fitSelectedHistory,
    playback.isPlaying,
  ]);

  const scrubOnEvent =
    historyPanelOpen && selectedHistoryIndex >= 0 && selectedEntry != null;

  const showFullDayRoute = !historyPanelOpen && !playback.isPlaying;
  const showSelectedHistory =
    (playback.isPlaying && selectedPlayable != null) ||
    (scrubOnEvent && selectedPlayable != null);
  const showUserLocation = !historyPanelOpen && !playback.isPlaying;

  return (
    <View className="bg-background flex-1">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={provider}
        initialRegion={FALLBACK_REGION}
        mapPadding={mapPadding}
        legalLabelInsets={{top: 0, right: 0, bottom: locateButtonBottom, left: 72}}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        userLocationPriority="high"
        userInterfaceStyle={colorScheme === 'dark' ? 'dark' : 'light'}
        followsUserLocation={false}
        scrollEnabled
        zoomEnabled
        pitchEnabled
        rotateEnabled
        onRegionChange={onRegionChange}
        onRegionChangeComplete={onRegionChange}
        onUserLocationChange={event => {
          const coordinate = event.nativeEvent.coordinate;
          if (coordinate) {
            handleUserLocation(coordinate);
          }
        }}>
        {showFullDayRoute ? (
          <RoutePathOverlay points={todayPoints} tripConfig={tripDetectionConfig} />
        ) : null}
        {showSelectedHistory && selectedPlayable?.kind === 'travel' ? (
          <TripRouteOverlay
            points={selectedPlayable.points}
            playbackProgress={playback.isPlaying ? playback.progress : null}
          />
        ) : null}
        {scrubOnEvent &&
        selectedPlayable?.kind === 'stay' &&
        !playback.isPlaying ? (
          <StayDurationCallout trip={selectedPlayable} />
        ) : null}
      </MapView>

      <MapLocateButton bottom={locateButtonBottom} onPress={goToCurrentLocation} />
      <MapHistoryButton
        bottom={historyButtonBottom}
        active={historyPanelOpen}
        eventCount={historyVisitCount}
        onPress={handleToggleHistoryPanel}
      />

      {historyPanelOpen ? (
        <View style={[styles.historyPanelHost, {bottom: insets.bottom}]}>
          <HistoryEventCard
            entry={scrubOnEvent ? selectedEntry : null}
            scrubOnEmpty={historyEntries.length > 0 && !scrubOnEvent}
            distanceUnit={distanceUnit}
            isPlaying={playback.isPlaying}
            onPlay={handlePlayHistory}
            onStop={playback.stop}
          />
          <HistoryTimelineBar
            range={historyData.range}
            entries={historyEntries}
            selectedIndex={selectedHistoryIndex}
            onSelectIndex={selectHistoryIndex}
            focusOnToday={historyFocusOnToday}
          />
        </View>
      ) : null}

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
  historyPanelHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
  },
});
