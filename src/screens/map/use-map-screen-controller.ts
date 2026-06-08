import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Animated, Alert, Platform, useColorScheme} from 'react-native';
import type MapView from 'react-native-maps';
import {PROVIDER_DEFAULT, PROVIDER_GOOGLE, type Region} from 'react-native-maps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {
  addFavoritePlace,
  deleteSavedPlace,
  type SavedPlaceRow,
  upsertHomePlace,
  upsertWorkPlace,
} from '@/db/repositories/saved-places';
import {useAfterInteractions} from '@/hooks/use-after-interactions';
import {useHistoryForDay} from '@/hooks/use-history-data';
import {usePlaceLookupScheduler} from '@/hooks/use-place-lookup-scheduler';
import {useSavedPlaces} from '@/hooks/use-saved-places';
import {
  useSelectVisitPlaceCandidate,
  useVisitPlaceDisplay,
} from '@/hooks/use-visit-place-display';
import {useTripDetectionConfig} from '@/hooks/use-trip-detection-config';
import {useTripPlayback} from '@/hooks/use-trip-playback';
import {buildHistoryMapPlan} from '@/lib/history-map-plan';
import {countHistoryTimelineEvents} from '@/lib/history-timeline';
import {getTodayDateKey} from '@/lib/day-utils';
import {regionForCoordinates, toMapCoordinates} from '@/lib/location-geo';
import {
  animateRecenterToUser,
  centerMapOnUser,
  MAP_USER_ZOOM_DELTA,
  regionAroundCoordinate,
  VISIT_MAX_ZOOM_DELTA,
} from '@/lib/map-location-utils';
import {getTripPlaybackDurationMs} from '@/lib/trip-playback';
import {isVisitOngoing} from '@/lib/trip-format';
import {
  canAddSavedPlace,
  matchSavedPlaceForStay,
  matchDriveEndSavedPlace,
  matchDriveStartSavedPlace,
  MAX_SAVED_PLACES,
  SavedPlaceLimitError,
} from '@/lib/saved-places';
import {shouldShowSavedPlaceCircles} from '@/lib/saved-places-map';
import {getCurrentOpenVisit} from '@/lib/today-history';
import {
  isPlayableTimelineEntry,
  firstPlayableTimelineIndex,
  findNextPlayableTimelineIndex,
  findPrevPlayableTimelineIndex,
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
  const [savePlaceCoordinate, setSavePlaceCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [savedPlacesSheetOpen, setSavedPlacesSheetOpen] = useState(false);
  const [showSavedPlaceCircles, setShowSavedPlaceCircles] = useState(true);

  const {places: savedPlaces, hasHome, hasWork, refresh: refreshSavedPlaces} =
    useSavedPlaces();
  const {data: historyData, loading: historyLoading} =
    useHistoryForDay(selectedDateKey);
  const viewingToday = selectedDateKey === todayKey;
  const historyEntries = historyData.entries;

  const mapRef = useRef<MapView>(null);
  const hasCenteredOnOpenRef = useRef(false);
  const needsDefaultCenterRef = useRef(true);
  const mapRegionRef = useRef<Region>(MAP_FALLBACK_REGION);
  const showSavedPlaceCirclesRef = useRef(true);
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

  const dayTravels = useMemo(
    (): DetectedTrip[] =>
      historyEntries.filter(
        (entry): entry is DetectedTrip => entry.kind === 'travel',
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

  const currentOpenVisitSavedPlace = useMemo(
    () =>
      currentOpenVisit != null
        ? matchSavedPlaceForStay(currentOpenVisit, savedPlaces)
        : null,
    [currentOpenVisit, savedPlaces],
  );

  const selectedSavedPlace = useMemo(
    () =>
      selectedPlayable?.kind === 'stay'
        ? matchSavedPlaceForStay(selectedPlayable, savedPlaces)
        : null,
    [selectedPlayable, savedPlaces],
  );

  const selectedDriveStartPlace = useMemo(() => {
    if (selectedPlayable?.kind !== 'travel') {
      return null;
    }
    let previousStay: DetectedTrip | null = null;
    if (selectedHistoryIndex >= 0) {
      const prevIdx = findPrevPlayableTimelineIndex(
        historyEntries,
        selectedHistoryIndex,
      );
      const prev = prevIdx >= 0 ? historyEntries[prevIdx] : null;
      if (prev?.kind === 'stay') {
        previousStay = prev;
      }
    }
    return matchDriveStartSavedPlace(
      selectedPlayable,
      previousStay,
      savedPlaces,
    );
  }, [
    historyEntries,
    savedPlaces,
    selectedHistoryIndex,
    selectedPlayable,
  ]);

  const selectedDriveEndPlace = useMemo(() => {
    if (selectedPlayable?.kind !== 'travel') {
      return null;
    }
    let nextStay: DetectedTrip | null = null;
    if (selectedHistoryIndex >= 0) {
      const nextIdx = findNextPlayableTimelineIndex(
        historyEntries,
        selectedHistoryIndex,
      );
      const next = nextIdx >= 0 ? historyEntries[nextIdx] : null;
      if (next?.kind === 'stay') {
        nextStay = next;
      }
    }
    return matchDriveEndSavedPlace(selectedPlayable, nextStay, savedPlaces);
  }, [
    historyEntries,
    savedPlaces,
    selectedHistoryIndex,
    selectedPlayable,
  ]);

  const selectedStay =
    selectedPlayable?.kind === 'stay' ? selectedPlayable : null;

  const provider =
    Platform.OS === 'android' && preferredMapApp === 'google'
      ? PROVIDER_GOOGLE
      : PROVIDER_DEFAULT;

  const historyPanelBottom = insets.bottom + MAP_HISTORY_PANEL_HEIGHT;
  const locateButtonBottom = historyPanelOpen
    ? historyPanelBottom + 12
    : insets.bottom + MAP_LOCATE_BUTTON_BOTTOM_GAP;
  const placesButtonBottom =
    locateButtonBottom + MAP_STACK_BUTTON_SIZE + MAP_STACK_BUTTON_GAP;
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

  usePlaceLookupScheduler({
    entries: historyEntries,
    selectedStay,
    selectedDateKey,
    savedPlaces,
    tripConfig: tripDetectionConfig,
    viewingToday,
    historyPanelOpen,
  });

  const selectedVisitPlaceDisplay = useVisitPlaceDisplay(
    scrubOnEvent && selectedStay ? selectedStay : null,
    savedPlaces,
  );

  const currentOpenVisitPlaceDisplay = useVisitPlaceDisplay(
    currentOpenVisit,
    savedPlaces,
  );

  const selectVisitPlaceCandidate = useSelectVisitPlaceCandidate();

  const handleSelectVisitPlaceIndex = useCallback(
    (index: number) => {
      if (!selectedStay) {
        return;
      }
      void selectVisitPlaceCandidate({
        cacheId: selectedVisitPlaceDisplay.cacheId,
        selectedIndex: index,
        stay: selectedStay,
        dateKey: selectedDateKey,
        materializedTripId: selectedVisitPlaceDisplay.materializedTripId,
      });
    },
    [
      selectVisitPlaceCandidate,
      selectedDateKey,
      selectedStay,
      selectedVisitPlaceDisplay.cacheId,
      selectedVisitPlaceDisplay.materializedTripId,
    ],
  );

  const showHistoryMap =
    showHistoryPanelContent &&
    selectedHistoryIndex >= 0 &&
    historyMapPlan.selected != null;
  const showDayJourney = !historyPanelOpen && !playback.isPlaying;
  const showUserLocation =
    !historyPanelOpen && !playback.isPlaying && viewingToday;

  const onRegionChangeComplete = useCallback((region: Region) => {
    mapRegionRef.current = region;
    const nextShowCircles = shouldShowSavedPlaceCircles(region.latitudeDelta);
    if (nextShowCircles !== showSavedPlaceCirclesRef.current) {
      showSavedPlaceCirclesRef.current = nextShowCircles;
      setShowSavedPlaceCircles(nextShowCircles);
    }
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
        setSelectedHistoryIndex(firstPlayableTimelineIndex(historyEntries));
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

  const handleMapLongPress = useCallback(
    (event: {nativeEvent: {coordinate: {latitude: number; longitude: number}}}) => {
      if (historyPanelOpen || playback.isPlaying) {
        return;
      }
      setSavePlaceCoordinate(event.nativeEvent.coordinate);
    },
    [historyPanelOpen, playback.isPlaying],
  );

  const closeSavePlaceSheet = useCallback(() => {
    setSavePlaceCoordinate(null);
  }, []);

  const showSavedPlaceLimitAlert = useCallback(() => {
    Alert.alert(
      'Place limit reached',
      `You can save up to ${MAX_SAVED_PLACES} places. Remove one from Places to add another.`,
    );
  }, []);

  const handleSaveHomePlace = useCallback(
    async (coordinate: {latitude: number; longitude: number}) => {
      try {
        await upsertHomePlace(coordinate.latitude, coordinate.longitude);
        await refreshSavedPlaces();
      } catch (error) {
        if (error instanceof SavedPlaceLimitError) {
          showSavedPlaceLimitAlert();
          return;
        }
        throw error;
      }
    },
    [refreshSavedPlaces, showSavedPlaceLimitAlert],
  );

  const handleSaveWorkPlace = useCallback(
    async (coordinate: {latitude: number; longitude: number}) => {
      try {
        await upsertWorkPlace(coordinate.latitude, coordinate.longitude);
        await refreshSavedPlaces();
      } catch (error) {
        if (error instanceof SavedPlaceLimitError) {
          showSavedPlaceLimitAlert();
          return;
        }
        throw error;
      }
    },
    [refreshSavedPlaces, showSavedPlaceLimitAlert],
  );

  const handleSaveFavoritePlace = useCallback(
    async (
      coordinate: {latitude: number; longitude: number},
      name: string,
    ) => {
      try {
        await addFavoritePlace(coordinate.latitude, coordinate.longitude, name);
        await refreshSavedPlaces();
      } catch (error) {
        if (error instanceof SavedPlaceLimitError) {
          showSavedPlaceLimitAlert();
          return;
        }
        throw error;
      }
    },
    [refreshSavedPlaces, showSavedPlaceLimitAlert],
  );

  const openSavedPlacesSheet = useCallback(() => {
    setSavedPlacesSheetOpen(true);
  }, []);

  const closeSavedPlacesSheet = useCallback(() => {
    setSavedPlacesSheetOpen(false);
  }, []);

  const handleDeleteSavedPlace = useCallback(
    async (place: SavedPlaceRow) => {
      await deleteSavedPlace(place.id);
      await refreshSavedPlaces();
    },
    [refreshSavedPlaces],
  );

  const handleSelectSavedPlace = useCallback((place: SavedPlaceRow) => {
    if (!mapRef.current) {
      return;
    }
    const region = regionAroundCoordinate(
      {latitude: place.lat, longitude: place.lng},
      VISIT_MAX_ZOOM_DELTA,
      VISIT_MAX_ZOOM_DELTA,
    );
    mapRef.current.animateToRegion(region, 400);
    mapRegionRef.current = region;
    needsDefaultCenterRef.current = false;
  }, []);

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
      VISIT_MAX_ZOOM_DELTA,
      VISIT_MAX_ZOOM_DELTA,
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
    if (!historyPanelOpen && viewingToday) {
      needsDefaultCenterRef.current = true;
    }
  }, [historyPanelOpen, viewingToday, selectedDateKey]);

  useEffect(() => {
    if (!historyLoading && viewingToday && !historyPanelOpen) {
      needsDefaultCenterRef.current = true;
    }
  }, [historyLoading, viewingToday, historyPanelOpen, selectedDateKey]);

  useEffect(() => {
    if (historyPanelOpen || historyLoading || !mapRef.current) {
      return;
    }

    if (viewingToday) {
      if (!userCoordinate || !needsDefaultCenterRef.current) {
        return;
      }
      needsDefaultCenterRef.current = false;
      const region = regionAroundCoordinate(
        userCoordinate,
        MAP_USER_ZOOM_DELTA,
        MAP_USER_ZOOM_DELTA,
      );
      mapRef.current.animateToRegion(region, 400);
      mapRegionRef.current = region;
      return;
    }

    const coordinates = toMapCoordinates(historyData.points);
    if (coordinates.length === 0) {
      return;
    }
    const region = regionForCoordinates(coordinates);
    mapRef.current.animateToRegion(region, 400);
    mapRegionRef.current = region;
  }, [
    historyData.points,
    historyLoading,
    historyPanelOpen,
    selectedDateKey,
    userCoordinate,
    viewingToday,
  ]);

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
    setSelectedHistoryIndex(firstPlayableTimelineIndex(historyEntries));
  }, [
    historyEntries,
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

  const canSaveHome = useMemo(
    () => !hasHome && canAddSavedPlace(savedPlaces, 'home'),
    [hasHome, savedPlaces],
  );
  const canSaveWork = useMemo(
    () => !hasWork && canAddSavedPlace(savedPlaces, 'work'),
    [hasWork, savedPlaces],
  );
  const canSaveFavorite = useMemo(
    () => canAddSavedPlace(savedPlaces, 'favorite'),
    [savedPlaces],
  );
  const isAtSavedPlaceLimit = savedPlaces.length >= MAX_SAVED_PLACES;

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
    placesButtonBottom,
    calendarButtonBottom,
    historyButtonBottom,
    historyData,
    historyEntries,
    dayStays,
    dayTravels,
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
    currentOpenVisitSavedPlace,
    selectedSavedPlace,
    selectedDriveStartPlace,
    selectedDriveEndPlace,
    selectedVisitPlaceDisplay,
    currentOpenVisitPlaceDisplay,
    handleSelectVisitPlaceIndex,
    savedPlaces,
    hasHome,
    hasWork,
    canSaveHome,
    canSaveWork,
    canSaveFavorite,
    isAtSavedPlaceLimit,
    maxSavedPlaces: MAX_SAVED_PLACES,
    showSavedPlaceCircles,
    savePlaceCoordinate,
    savedPlacesSheetOpen,
    userCoordinate,
    playback,
    onRegionChangeComplete,
    handleUserLocation,
    handleMapLongPress,
    closeSavePlaceSheet,
    handleSaveHomePlace,
    handleSaveWorkPlace,
    handleSaveFavoritePlace,
    openSavedPlacesSheet,
    closeSavedPlacesSheet,
    handleDeleteSavedPlace,
    handleSelectSavedPlace,
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
