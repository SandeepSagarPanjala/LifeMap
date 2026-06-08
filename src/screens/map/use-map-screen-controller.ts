import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Animated, Platform, useColorScheme} from 'react-native';
import type MapView from 'react-native-maps';
import {PROVIDER_DEFAULT, PROVIDER_GOOGLE, type Region} from 'react-native-maps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useAfterInteractions} from '@/hooks/use-after-interactions';
import {useHistoryForDay} from '@/hooks/use-history-data';
import {useTripDetectionConfig} from '@/hooks/use-trip-detection-config';
import {useTripPlayback} from '@/hooks/use-trip-playback';
import {buildHistoryMapPlan} from '@/lib/history-map-plan';
import {countHistoryTimelineEvents} from '@/lib/history-timeline';
import {getTodayDateKey} from '@/lib/day-utils';
import {regionForCoordinates, toMapCoordinates} from '@/lib/location-geo';
import {
  animateRecenterToUser,
  centerMapOnUser,
  regionAroundCoordinate,
  VISIT_MARKER_ZOOM_DELTA,
} from '@/lib/map-location-utils';
import {getTripPlaybackDurationMs} from '@/lib/trip-playback';
import {isVisitOngoing} from '@/lib/trip-format';
import {getCurrentOpenVisit} from '@/lib/today-history';
import {
  isPlayableTimelineEntry,
  stayTripMarkerCoordinate,
  type DetectedTrip,
} from '@/lib/trip-detection';
import {
  shouldRefreshUserCoordinate,
  type MapUserCoordinate,
} from '@/lib/user-coordinate-throttle';
import {buildMapAttributionInsets} from '@/lib/map-attribution-insets';
import {useAppStore} from '@/stores/app-store';

import {
  MAP_FALLBACK_REGION,
  MAP_HISTORY_PANEL_HEIGHT,
  MAP_LOCATE_BUTTON_BOTTOM_GAP,
  MAP_SETTINGS_SIZE,
  MAP_SETTINGS_TOP_GAP,
  MAP_STACK_BUTTON_GAP,
  MAP_STACK_BUTTON_SIZE,
} from './map-screen-constants';

export function useMapScreenController() {
  const tripDetectionConfig = useTripDetectionConfig();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const preferredMapApp = useAppStore(state => state.preferredMapApp);
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const todayKey = getTodayDateKey();

  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [historyDatePickerOpen, setHistoryDatePickerOpen] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);
  const [userCoordinate, setUserCoordinate] = useState<MapUserCoordinate | null>(
    null,
  );

  const {data: historyData, loading: historyLoading} =
    useHistoryForDay(selectedDateKey);
  const viewingToday = selectedDateKey === todayKey;
  const historyEntries = historyData.entries;

  const mapRef = useRef<MapView>(null);
  const hasCenteredOnOpenRef = useRef(false);
  const mapRegionRef = useRef<Region>(MAP_FALLBACK_REGION);
  const fitHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userCoordinateRef = useRef<MapUserCoordinate | null>(null);
  const lastUserCoordinateRefreshMsRef = useRef(0);
  const historyPanelY = useRef(
    new Animated.Value(MAP_HISTORY_PANEL_HEIGHT + 48),
  ).current;

  const playback = useTripPlayback();
  const historyPanelReady = useAfterInteractions(historyPanelOpen);
  const deferredHistoryEntries = useDeferredValue(historyEntries);
  const historyEntriesPending =
    historyPanelOpen && deferredHistoryEntries !== historyEntries;

  const historyBadgeCount = useMemo(
    () => countHistoryTimelineEvents(historyEntries),
    [historyEntries],
  );
  const trackingGapWarning = useMemo(() => {
    if (!viewingToday || historyData.points.length === 0) {
      return null;
    }
    const lastPoint = historyData.points[historyData.points.length - 1]!;
    const gapMs = Date.now() - lastPoint.timestamp.getTime();
    if (gapMs < 2 * 60 * 60_000) {
      return null;
    }
    const hours = Math.floor(gapMs / 3_600_000);
    const minutes = Math.floor((gapMs % 3_600_000) / 60_000);
    return `No saved points for ${hours}h ${minutes}m`;
  }, [historyData.points, viewingToday]);

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

  const historyMapPlan = useMemo(
    () =>
      buildHistoryMapPlan(
        deferredHistoryEntries,
        selectedHistoryIndex,
        tripDetectionConfig,
      ),
    [deferredHistoryEntries, selectedHistoryIndex, tripDetectionConfig],
  );

  const showHistoryPanelContent =
    historyPanelOpen &&
    historyPanelReady &&
    !historyLoading &&
    !historyEntriesPending;

  const currentOpenVisit = useMemo(
    () =>
      viewingToday && !historyPanelOpen
        ? getCurrentOpenVisit(historyEntries, {
            userCoordinate,
            config: tripDetectionConfig,
          })
        : null,
    [
      historyEntries,
      historyPanelOpen,
      tripDetectionConfig,
      userCoordinate,
      viewingToday,
    ],
  );

  const provider =
    Platform.OS === 'android' && preferredMapApp === 'google'
      ? PROVIDER_GOOGLE
      : PROVIDER_DEFAULT;

  const historyPanelBottom = insets.bottom + MAP_HISTORY_PANEL_HEIGHT;
  const locateButtonBottom = historyPanelOpen
    ? historyPanelBottom + 12
    : insets.bottom + MAP_LOCATE_BUTTON_BOTTOM_GAP;
  const historyButtonBottom = locateButtonBottom;
  const calendarButtonBottom =
    historyButtonBottom + MAP_STACK_BUTTON_SIZE + MAP_STACK_BUTTON_GAP;
  const rightControlsBottom = historyPanelOpen
    ? historyPanelBottom + 12
    : locateButtonBottom;

  const mapPadding = useMemo(
    () => ({
      top: insets.top + MAP_SETTINGS_TOP_GAP + MAP_SETTINGS_SIZE,
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

  const mapAttributionInsets = useMemo(() => {
    const bottomClearance = historyPanelOpen
      ? insets.bottom + 8
      : locateButtonBottom + MAP_STACK_BUTTON_SIZE + 6;
    return buildMapAttributionInsets(bottomClearance);
  }, [historyPanelOpen, insets.bottom, locateButtonBottom]);

  const scrubOnEvent =
    historyPanelOpen && selectedHistoryIndex >= 0 && selectedEntry != null;

  const showHistoryMap =
    showHistoryPanelContent &&
    selectedHistoryIndex >= 0 &&
    historyMapPlan.selected != null;
  const showDayJourney = !historyPanelOpen && !playback.isPlaying;
  const showUserLocation =
    !historyPanelOpen && !playback.isPlaying && viewingToday;

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

      if (
        shouldRefreshUserCoordinate(
          userCoordinateRef.current,
          coordinate,
          lastUserCoordinateRefreshMsRef.current,
        )
      ) {
        lastUserCoordinateRefreshMsRef.current = Date.now();
        userCoordinateRef.current = coordinate;
        setUserCoordinate(coordinate);
      }

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
    const selectedMap = historyMapPlan.selected;
    const routePoints =
      selectedPlayable.kind === 'travel'
        ? (selectedMap?.travelPoints ?? selectedPlayable.points)
        : selectedMap?.inboundPoints != null
          ? [...selectedMap.inboundPoints, ...selectedPlayable.points]
          : selectedPlayable.points;
    const region = regionForCoordinates(toMapCoordinates(routePoints));
    mapRef.current.animateToRegion(region, 400);
    mapRegionRef.current = region;
  }, [historyMapPlan.selected, selectedPlayable]);

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

  const openHistoryDatePicker = useCallback(() => {
    setHistoryDatePickerOpen(true);
  }, []);

  const closeHistoryDatePicker = useCallback(() => {
    setHistoryDatePickerOpen(false);
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
        setSelectedHistoryIndex(historyEntries.length > 0 ? 0 : -1);
      } else {
        playback.stop();
        setSelectedDateKey(todayKey);
        setSelectedHistoryIndex(-1);
      }
      return next;
    });
  }, [historyEntries.length, playback, todayKey]);

  const handlePlayHistory = useCallback(() => {
    if (!selectedPlayable || selectedPlayable.kind !== 'travel') {
      return;
    }
    scheduleFitSelectedHistory(true);
    playback.start(getTripPlaybackDurationMs(selectedPlayable.durationMs));
  }, [playback, scheduleFitSelectedHistory, selectedPlayable]);

  const handleZoomVisit = useCallback(() => {
    if (!mapRef.current || !selectedPlayable || selectedPlayable.kind !== 'stay') {
      return;
    }
    const ongoing = isVisitOngoing(selectedPlayable.endAt, new Date(), {
      openThroughNow: selectedPlayable.openThroughNow,
    });
    const coordinate = stayTripMarkerCoordinate(selectedPlayable, {ongoing});
    const region = regionAroundCoordinate(
      coordinate,
      VISIT_MARKER_ZOOM_DELTA,
      VISIT_MARKER_ZOOM_DELTA,
    );
    mapRef.current.animateToRegion(region, 400);
    mapRegionRef.current = region;
  }, [selectedPlayable]);

  useEffect(() => {
    Animated.spring(historyPanelY, {
      toValue: historyPanelOpen ? 0 : MAP_HISTORY_PANEL_HEIGHT + 48,
      damping: 24,
      stiffness: 280,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  }, [historyPanelOpen, historyPanelY]);

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

  useEffect(() => {
    if (
      !historyPanelOpen ||
      historyLoading ||
      historyEntries.length === 0 ||
      selectedHistoryIndex >= 0
    ) {
      return;
    }
    setSelectedHistoryIndex(0);
  }, [
    historyEntries.length,
    historyLoading,
    historyPanelOpen,
    selectedHistoryIndex,
  ]);

  useEffect(() => {
    if (
      showHistoryPanelContent &&
      selectedHistoryIndex >= 0 &&
      selectedPlayable &&
      !playback.isPlaying
    ) {
      scheduleFitSelectedHistory();
    }
  }, [
    selectedHistoryIndex,
    showHistoryPanelContent,
    selectedPlayable,
    scheduleFitSelectedHistory,
    playback.isPlaying,
  ]);

  return {
    tripDetectionConfig,
    insets,
    colorScheme,
    distanceUnit,
    mapRef,
    provider,
    mapPadding,
    mapAttributionInsets,
    locateButtonBottom,
    calendarButtonBottom,
    historyButtonBottom,
    historyData,
    historyEntries,
    dayStays,
    historyMapPlan,
    historyBadgeCount,
    trackingGapWarning,
    historyPanelOpen,
    historyPanelY,
    historyDatePickerOpen,
    selectedDateKey,
    selectedHistoryIndex,
    selectedEntry,
    selectedPlayable,
    scrubOnEvent,
    showHistoryPanelContent,
    showHistoryMap,
    showDayJourney,
    showUserLocation,
    currentOpenVisit,
    userCoordinate,
    playback,
    onRegionChangeComplete,
    handleUserLocation,
    goToCurrentLocation,
    openHistoryDatePicker,
    closeHistoryDatePicker,
    handleSelectMapDate,
    handleHistoryDateKeyChange,
    handleToggleHistoryPanel,
    selectHistoryIndex,
    handlePlayHistory,
    handleZoomVisit,
  };
}

export type MapScreenController = ReturnType<typeof useMapScreenController>;
