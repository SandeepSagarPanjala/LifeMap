import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Animated, Alert, Platform, useColorScheme} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type MapView from 'react-native-maps';
import {PROVIDER_DEFAULT, PROVIDER_GOOGLE, type Region} from 'react-native-maps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {deleteMoment} from '@/db/repositories/moments';
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
import {useDayMoments} from '@/hooks/use-day-moments';
import {
  buildMomentMapPins,
  type MomentMapPin,
} from '@/components/map/MomentMapOverlay';
import {
  countMoments,
  countMomentsForEntry,
  filterMomentsForEntry,
  type MomentCounts,
} from '@/lib/moments/moment-counts';
import {
  useSelectVisitPlaceCandidate,
  useVisitPlaceDisplay,
} from '@/hooks/use-visit-place-display';
import {useTripDetectionConfig} from '@/hooks/use-trip-detection-config';
import {useTripPlayback} from '@/hooks/use-trip-playback';
import {buildHistoryMapPlan} from '@/lib/history-map-plan';
import {countHistoryTimelineEvents, formatHistoryDayNavLabel} from '@/lib/history-timeline';
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
import {capturePhotoFromCamera} from '@/lib/moments/capture-photo';
import {
  isPlayableTimelineEntry,
  firstPlayableTimelineIndex,
  findNextPlayableTimelineIndex,
  findPrevPlayableTimelineIndex,
  stayTripMarkerCoordinate,
  type DetectedTrip,
  type DayTimelineEntry,
} from '@/lib/trip-detection';
import {
  shouldRefreshUserCoordinate,
  type MapUserCoordinate,
} from '@/lib/user-coordinate-throttle';
import {buildMapAttributionInsets} from '@/lib/map-attribution-insets';
import type {RootStackParamList} from '@/navigation/types';
import {useAppStore} from '@/stores/app-store';

import {
  DAY_MOMENT_SUMMARY_ABOVE_BAR_GAP,
  DAY_MOMENT_SUMMARY_BAR_HEIGHT,
  DAY_MOMENT_SUMMARY_BOTTOM_GAP,
  MAP_FALLBACK_REGION,
  MAP_HISTORY_PANEL_HEIGHT,
  MAP_LEFT_STACK_COUNT,
  MAP_LOCATE_BUTTON_BOTTOM_GAP,
  MAP_RIGHT_STACK_COUNT,
  MAP_SETTINGS_SIZE,
  MAP_SETTINGS_TOP_GAP,
  MAP_STACK_BUTTON_GAP,
  MAP_STACK_BUTTON_SIZE,
  mapStackButtonBottom,
  mapStackTotalHeight,
} from './map-screen-constants';

export function useMapScreenController() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
  const [voiceMemoSheetOpen, setVoiceMemoSheetOpen] = useState(false);
  const [momentsPreviewScope, setMomentsPreviewScope] = useState<
    | {kind: 'day'}
    | {kind: 'entry'; entry: DayTimelineEntry}
    | {kind: 'moment-ids'; momentIds: number[]; title: string}
    | null
  >(null);
  const [showSavedPlaceCircles, setShowSavedPlaceCircles] = useState(true);

  const {places: savedPlaces, hasHome, hasWork, refresh: refreshSavedPlaces} =
    useSavedPlaces();
  const {dayMoments, refreshDayMoments} = useDayMoments(selectedDateKey);
  const {data: historyData, loading: historyLoading} =
    useHistoryForDay(selectedDateKey);
  const viewingToday = selectedDateKey === todayKey;
  const historyEntries = historyData.entries;

  const captureInFlightRef = useRef(false);
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

  const reserveDayMomentSummary =
    !historyPanelOpen && !playback.isPlaying;
  const daySummaryBarReserve = reserveDayMomentSummary
    ? DAY_MOMENT_SUMMARY_BOTTOM_GAP +
      DAY_MOMENT_SUMMARY_BAR_HEIGHT +
      DAY_MOMENT_SUMMARY_ABOVE_BAR_GAP
    : 0;

  const historyPanelBottom = insets.bottom + MAP_HISTORY_PANEL_HEIGHT;
  const stackBaseBottom = historyPanelOpen
    ? historyPanelBottom + 12
    : insets.bottom + MAP_LOCATE_BUTTON_BOTTOM_GAP + daySummaryBarReserve;

  const locateButtonBottom = mapStackButtonBottom(stackBaseBottom, 0);
  const historyButtonBottom = mapStackButtonBottom(stackBaseBottom, 1);
  const calendarButtonBottom = mapStackButtonBottom(stackBaseBottom, 2);
  const placesButtonBottom = mapStackButtonBottom(stackBaseBottom, 3);

  const cameraButtonBottom = mapStackButtonBottom(stackBaseBottom, 0);
  const voiceButtonBottom = mapStackButtonBottom(stackBaseBottom, 1);
  const noteButtonBottom = mapStackButtonBottom(stackBaseBottom, 2);
  const dayMomentSummaryBottom = insets.bottom + DAY_MOMENT_SUMMARY_BOTTOM_GAP;

  const leftStackHeight = mapStackTotalHeight(
    MAP_LEFT_STACK_COUNT,
    MAP_STACK_BUTTON_SIZE,
    MAP_STACK_BUTTON_GAP,
  );
  const floatingControlsClearance = stackBaseBottom + leftStackHeight + 16;

  const mapPadding = useMemo(
    () => ({
      top: insets.top + MAP_SETTINGS_TOP_GAP + MAP_SETTINGS_SIZE,
      right: 12,
      bottom: floatingControlsClearance,
      left: 12,
    }),
    [floatingControlsClearance, insets.top],
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
  const showDayMomentSummary = showDayJourney;
  const dayMomentCounts = useMemo(
    () => countMoments(dayMoments),
    [dayMoments],
  );

  const currentVisitMomentCounts = useMemo((): MomentCounts | undefined => {
    if (!currentOpenVisit) {
      return undefined;
    }
    return countMomentsForEntry(dayMoments, currentOpenVisit);
  }, [dayMoments, currentOpenVisit]);

  const dayMomentMapPins = useMemo((): MomentMapPin[] => {
    if (!showDayJourney) {
      return [];
    }
    return buildMomentMapPins(
      dayMoments,
      historyData.points,
      historyEntries,
    );
  }, [showDayJourney, dayMoments, historyData.points, historyEntries]);

  const selectedEntryMomentCounts = useMemo((): MomentCounts | undefined => {
    if (!selectedEntry) {
      return undefined;
    }
    return countMomentsForEntry(dayMoments, selectedEntry);
  }, [dayMoments, selectedEntry]);

  const momentsPreviewOpen = momentsPreviewScope != null;
  const momentsPreviewMoments = useMemo(() => {
    if (!momentsPreviewScope) {
      return [];
    }
    if (momentsPreviewScope.kind === 'day') {
      return dayMoments;
    }
    if (momentsPreviewScope.kind === 'moment-ids') {
      const ids = new Set(momentsPreviewScope.momentIds);
      return dayMoments.filter(moment => ids.has(moment.id));
    }
    return filterMomentsForEntry(dayMoments, momentsPreviewScope.entry);
  }, [momentsPreviewScope, dayMoments]);
  const momentsPreviewTitle = useMemo(() => {
    if (!momentsPreviewScope) {
      return '';
    }
    if (momentsPreviewScope.kind === 'day') {
      return `${formatHistoryDayNavLabel(selectedDateKey)} moments`;
    }
    if (momentsPreviewScope.kind === 'moment-ids') {
      return momentsPreviewScope.title;
    }
    return momentsPreviewScope.entry.kind === 'stay'
      ? 'Visit moments'
      : 'Drive moments';
  }, [momentsPreviewScope, selectedDateKey]);

  const historyMomentMapPins = useMemo((): MomentMapPin[] => {
    if (!showHistoryMap || !selectedEntry) {
      return [];
    }
    return buildMomentMapPins(
      filterMomentsForEntry(dayMoments, selectedEntry),
      historyData.points,
      [selectedEntry],
    );
  }, [showHistoryMap, selectedEntry, dayMoments, historyData.points]);
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

  const handleCaptureCamera = useCallback(async () => {
    if (captureInFlightRef.current) {
      return;
    }
    captureInFlightRef.current = true;
    try {
      const moment = await capturePhotoFromCamera();
      if (moment) {
        await refreshDayMoments();
      }
    } finally {
      captureInFlightRef.current = false;
    }
  }, [refreshDayMoments]);

  const handleCaptureVoice = useCallback(() => {
    setVoiceMemoSheetOpen(true);
  }, []);

  const closeVoiceMemoSheet = useCallback(() => {
    setVoiceMemoSheetOpen(false);
  }, []);

  const handleVoiceMemoSaved = useCallback(async () => {
    await refreshDayMoments();
  }, [refreshDayMoments]);

  const handleCaptureNote = useCallback(() => {
    navigation.navigate('CaptureNote');
  }, [navigation]);

  const openDayMomentsPreview = useCallback(() => {
    setMomentsPreviewScope({kind: 'day'});
  }, []);

  const openCurrentVisitMomentsPreview = useCallback(() => {
    if (currentOpenVisit) {
      setMomentsPreviewScope({kind: 'entry', entry: currentOpenVisit});
    }
  }, [currentOpenVisit]);

  const openSelectedEntryMomentsPreview = useCallback(() => {
    if (selectedEntry) {
      setMomentsPreviewScope({kind: 'entry', entry: selectedEntry});
    }
  }, [selectedEntry]);

  const openMomentMapPinPreview = useCallback((pin: MomentMapPin) => {
    setMomentsPreviewScope({
      kind: 'moment-ids',
      momentIds: [pin.moment.id],
      title: 'Moment',
    });
  }, []);

  const closeMomentsPreview = useCallback(() => {
    setMomentsPreviewScope(null);
  }, []);

  const handleDeleteMoment = useCallback(
    async (momentId: number) => {
      await deleteMoment(momentId);
      await refreshDayMoments();
    },
    [refreshDayMoments],
  );

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
    cameraButtonBottom,
    voiceButtonBottom,
    noteButtonBottom,
    handleCaptureCamera,
    handleCaptureVoice,
    closeVoiceMemoSheet,
    handleVoiceMemoSaved,
    voiceMemoSheetOpen,
    handleCaptureNote,
    momentsPreviewOpen,
    momentsPreviewTitle,
    momentsPreviewMoments,
    openDayMomentsPreview,
    openCurrentVisitMomentsPreview,
    openSelectedEntryMomentsPreview,
    openMomentMapPinPreview,
    closeMomentsPreview,
    handleDeleteMoment,
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
    showDayMomentSummary,
    dayMomentSummaryBottom,
    dayMomentCounts,
    currentVisitMomentCounts,
    dayMomentMapPins,
    historyMomentMapPins,
    selectedEntryMomentCounts,
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
