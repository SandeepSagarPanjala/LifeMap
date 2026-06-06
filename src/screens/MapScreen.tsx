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

import {HistoryDatePickerSheet} from '@/components/map/HistoryDatePickerSheet';
import {HistoryEventCard} from '@/components/map/HistoryEventCard';
import {HistoryTimelineBar} from '@/components/map/HistoryTimelineBar';
import {MapCalendarButton} from '@/components/map/MapCalendarButton';
import {MapHistoryButton} from '@/components/map/MapHistoryButton';
import {MapLocateButton} from '@/components/map/MapLocateButton';
import {DayJourneyOverlay} from '@/components/map/DayJourneyOverlay';
import {StayAreasOverlay} from '@/components/map/StayAreasOverlay';
import {StayDurationCallout} from '@/components/map/StayDurationCallout';
import {TripRouteOverlay} from '@/components/map/TripRouteOverlay';
import {useDateKeysWithData} from '@/hooks/use-date-keys-with-data';
import {useHistoryForDay} from '@/hooks/use-history-data';
import {countHistoryTimelineEvents} from '@/lib/history-timeline';
import {useTripPlayback} from '@/hooks/use-trip-playback';
import {getTodayDateKey} from '@/lib/day-utils';
import {
  getTravelDisplayPoints,
  getVisitInboundTravelPoints,
  isPlayableTimelineEntry,
  stayBeforeEntryIndex,
  staysBeforeEntryIndex,
  type DetectedTrip,
} from '@/lib/trip-detection';
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
const HISTORY_PANEL_HEIGHT = 218;
const MAP_STACK_BUTTON_SIZE = 44;
const MAP_STACK_BUTTON_GAP = 8;

export function MapScreen() {
  const tripDetectionConfig = useTripDetectionConfig();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = useThemeColors();
  const preferredMapApp = useAppStore(state => state.preferredMapApp);
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const todayKey = getTodayDateKey();
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [historyDatePickerOpen, setHistoryDatePickerOpen] = useState(false);
  const {data: historyData, loading: historyLoading} =
    useHistoryForDay(selectedDateKey);
  const viewingToday = selectedDateKey === todayKey;
  const {dateKeysWithData} = useDateKeysWithData();
  const mapRef = useRef<MapView>(null);
  const hasCenteredOnOpenRef = useRef(false);
  const mapRegionRef = useRef<Region>(FALLBACK_REGION);
  const historyScrubbingRef = useRef(false);
  const fitHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [userCoordinate, setUserCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);

  const historyEntries = historyData.entries;
  const historyBadgeCount = useMemo(
    () => countHistoryTimelineEvents(historyEntries),
    [historyEntries],
  );

  const dayStays = useMemo(
    (): DetectedTrip[] =>
      historyEntries.filter(
        (entry): entry is DetectedTrip => entry.kind === 'stay',
      ),
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

  const selectedTravelPoints = useMemo(() => {
    if (selectedPlayable?.kind !== 'travel') {
      return null;
    }
    return getTravelDisplayPoints(
      selectedPlayable,
      stayBeforeEntryIndex(historyEntries, selectedHistoryIndex),
      staysBeforeEntryIndex(historyEntries, selectedHistoryIndex),
      tripDetectionConfig,
    );
  }, [
    historyEntries,
    selectedHistoryIndex,
    selectedPlayable,
    tripDetectionConfig,
  ]);

  const inboundTravelPoints = useMemo(() => {
    if (
      selectedPlayable?.kind !== 'stay' ||
      selectedHistoryIndex <= 0
    ) {
      return null;
    }
    const prior = historyEntries[selectedHistoryIndex - 1];
    if (prior?.kind !== 'travel') {
      return null;
    }
    const priorIndex = selectedHistoryIndex - 1;
    return getVisitInboundTravelPoints(
      prior,
      selectedPlayable,
      stayBeforeEntryIndex(historyEntries, priorIndex),
      staysBeforeEntryIndex(historyEntries, priorIndex),
      tripDetectionConfig,
    );
  }, [
    historyEntries,
    selectedHistoryIndex,
    selectedPlayable,
    tripDetectionConfig,
  ]);

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
  const calendarButtonBottom =
    historyButtonBottom + MAP_STACK_BUTTON_SIZE + MAP_STACK_BUTTON_GAP;

  const rightControlsBottom = historyPanelOpen
    ? historyPanelBottom + 12
    : locateButtonBottom;

  const mapPadding = useMemo(
    () => ({
      top: insets.top + SETTINGS_TOP_GAP + SETTINGS_SIZE,
      right: 12,
      bottom:
        rightControlsBottom +
        MAP_STACK_BUTTON_SIZE * 2 +
        MAP_STACK_BUTTON_GAP +
        16,
      left: 12,
    }),
    [insets.top, rightControlsBottom],
  );

  const legalLabelInsets = useMemo(
    () => ({
      top: 0,
      right: 0,
      bottom: calendarButtonBottom,
      left: 72,
    }),
    [calendarButtonBottom],
  );

  const onRegionChangeComplete = useCallback((region: Region) => {
    mapRegionRef.current = region;
  }, []);

  const goToCurrentLocation = useCallback(() => {
    if (!userCoordinate || !mapRef.current) {
      return;
    }
    animateRecenterToUser(mapRef.current, userCoordinate, mapRegionRef.current);
  }, [userCoordinate]);

  const handleUserLocation = useCallback(
    (event: {
      nativeEvent: {coordinate?: {latitude: number; longitude: number}};
    }) => {
      const coordinate = event.nativeEvent.coordinate;
      if (!coordinate) {
        return;
      }
      setUserCoordinate(coordinate);

      if (hasCenteredOnOpenRef.current || !mapRef.current) {
        return;
      }
      hasCenteredOnOpenRef.current = true;
      const region = centerMapOnUser(mapRef.current, coordinate, true);
      mapRegionRef.current = region;
    },
    [],
  );

  const fitSelectedHistoryNow = useCallback(() => {
    if (!mapRef.current || !selectedPlayable) {
      return;
    }
    const routePoints =
      selectedPlayable.kind === 'travel'
        ? (selectedTravelPoints ?? selectedPlayable.points)
        : inboundTravelPoints != null
          ? [...inboundTravelPoints, ...selectedPlayable.points]
          : selectedPlayable.points;
    const region = regionForCoordinates(toMapCoordinates(routePoints));
    mapRef.current.animateToRegion(region, 400);
    mapRegionRef.current = region;
  }, [inboundTravelPoints, selectedPlayable, selectedTravelPoints]);

  const scheduleFitSelectedHistory = useCallback(
    (immediate = false) => {
      if (fitHistoryTimerRef.current != null) {
        clearTimeout(fitHistoryTimerRef.current);
        fitHistoryTimerRef.current = null;
      }
      if (immediate) {
        fitSelectedHistoryNow();
        return;
      }
      fitHistoryTimerRef.current = setTimeout(() => {
        fitHistoryTimerRef.current = null;
        fitSelectedHistoryNow();
      }, 280);
    },
    [fitSelectedHistoryNow],
  );

  const selectHistoryIndex = useCallback(
    (index: number) => {
      setSelectedHistoryIndex(prev => {
        if (prev !== index) {
          playback.stop();
        }
        return index;
      });
    },
    [playback],
  );

  const handleHistoryScrubActiveChange = useCallback(
    (active: boolean) => {
      historyScrubbingRef.current = active;
      if (!active) {
        scheduleFitSelectedHistory(true);
      }
    },
    [scheduleFitSelectedHistory],
  );

  const openHistoryDatePicker = useCallback(() => {
    setHistoryDatePickerOpen(true);
  }, []);

  const handleSelectMapDate = useCallback(
    (dateKey: string) => {
      setSelectedDateKey(dateKey);
      setSelectedHistoryIndex(-1);
      playback.stop();
    },
    [playback],
  );

  const handleHistoryDateKeyChange = useCallback(
    (dateKey: string) => {
      setSelectedDateKey(dateKey);
      setSelectedHistoryIndex(-1);
      playback.stop();
    },
    [playback],
  );

  const handleToggleHistoryPanel = useCallback(() => {
    setHistoryPanelOpen(open => {
      const next = !open;
      if (next) {
        setSelectedHistoryIndex(-1);
      } else {
        playback.stop();
        setSelectedDateKey(todayKey);
        setSelectedHistoryIndex(-1);
      }
      return next;
    });
  }, [playback, todayKey]);

  useEffect(() => {
    if (historyPanelOpen || historyLoading || !mapRef.current) {
      return;
    }
    const coordinates = toMapCoordinates(historyData.points);
    if (coordinates.length === 0) {
      return;
    }
    const region = regionForCoordinates(coordinates);
    mapRef.current.animateToRegion(region, 400);
    mapRegionRef.current = region;
  }, [historyData.points, historyLoading, historyPanelOpen, selectedDateKey]);

  useEffect(
    () => () => {
      if (fitHistoryTimerRef.current != null) {
        clearTimeout(fitHistoryTimerRef.current);
      }
    },
    [],
  );

  const handlePlayHistory = useCallback(() => {
    if (!selectedPlayable || selectedPlayable.kind !== 'travel') {
      return;
    }
    scheduleFitSelectedHistory(true);
    playback.start(getTripPlaybackDurationMs(selectedPlayable.durationMs));
  }, [playback, scheduleFitSelectedHistory, selectedPlayable]);

  useEffect(() => {
    if (
      historyPanelOpen &&
      selectedHistoryIndex >= 0 &&
      selectedPlayable &&
      !playback.isPlaying &&
      !historyScrubbingRef.current
    ) {
      scheduleFitSelectedHistory();
    }
  }, [
    selectedHistoryIndex,
    historyPanelOpen,
    selectedPlayable,
    scheduleFitSelectedHistory,
    playback.isPlaying,
  ]);

  const scrubOnEvent =
    historyPanelOpen && selectedHistoryIndex >= 0 && selectedEntry != null;

  const showDayJourney =
    !historyPanelOpen && !playback.isPlaying;
  const showHistoryEvent =
    historyPanelOpen &&
    ((playback.isPlaying && selectedPlayable != null) ||
      (scrubOnEvent && selectedPlayable != null));
  const showUserLocation =
    !historyPanelOpen && !playback.isPlaying && viewingToday;

  return (
    <View className="bg-background flex-1">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={provider}
        initialRegion={FALLBACK_REGION}
        mapPadding={mapPadding}
        legalLabelInsets={legalLabelInsets}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        userLocationPriority="high"
        userInterfaceStyle={colorScheme === 'dark' ? 'dark' : 'light'}
        followsUserLocation={false}
        scrollEnabled
        zoomEnabled
        pitchEnabled
        rotateEnabled
        onRegionChangeComplete={onRegionChangeComplete}
        onUserLocationChange={handleUserLocation}>
        {showDayJourney ? (
          <DayJourneyOverlay
            points={historyData.points}
            stays={dayStays}
            tripConfig={tripDetectionConfig}
          />
        ) : null}
        {showHistoryEvent &&
        selectedPlayable?.kind === 'travel' &&
        selectedTravelPoints != null ? (
          <TripRouteOverlay
            points={selectedTravelPoints}
            playbackProgress={playback.isPlaying ? playback.progress : null}
            emphasized
            startAt={selectedPlayable.startAt}
            endAt={selectedPlayable.endAt}
          />
        ) : null}
        {showHistoryEvent &&
        selectedPlayable?.kind === 'stay' &&
        inboundTravelPoints != null &&
        !playback.isPlaying ? (
          <TripRouteOverlay points={inboundTravelPoints} emphasized />
        ) : null}
        {showHistoryEvent &&
        selectedPlayable?.kind === 'stay' &&
        !playback.isPlaying ? (
          <>
            <StayAreasOverlay
              stays={[selectedPlayable]}
              tripConfig={tripDetectionConfig}
              emphasized
            />
            <StayDurationCallout trip={selectedPlayable} />
          </>
        ) : null}
      </MapView>

      <MapLocateButton bottom={locateButtonBottom} onPress={goToCurrentLocation} />
      <MapCalendarButton
        bottom={calendarButtonBottom}
        onPress={openHistoryDatePicker}
      />
      <MapHistoryButton
        bottom={historyButtonBottom}
        active={historyPanelOpen}
        eventCount={historyBadgeCount}
        onPress={handleToggleHistoryPanel}
      />

      <HistoryDatePickerSheet
        visible={historyDatePickerOpen}
        selectedDateKey={selectedDateKey}
        dateKeysWithData={dateKeysWithData}
        onSelectDate={handleSelectMapDate}
        onClose={() => setHistoryDatePickerOpen(false)}
      />

      {historyPanelOpen ? (
        <View style={[styles.historyPanelHost, {bottom: insets.bottom}]}>
          <HistoryEventCard
            entry={scrubOnEvent ? selectedEntry : null}
            scrubOnEmpty={
              !historyLoading && historyEntries.length > 0 && !scrubOnEvent
            }
            distanceUnit={distanceUnit}
            isPlaying={playback.isPlaying}
            onPlay={handlePlayHistory}
            onStop={playback.stop}
          />
          <HistoryTimelineBar
            dateKey={selectedDateKey}
            entries={historyEntries}
            selectedIndex={selectedHistoryIndex}
            onSelectIndex={selectHistoryIndex}
            onScrubActiveChange={handleHistoryScrubActiveChange}
            onDateKeyChange={handleHistoryDateKeyChange}
            onOpenDatePicker={openHistoryDatePicker}
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
