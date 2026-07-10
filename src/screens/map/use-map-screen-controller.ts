import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Animated,
  AppState,
  Dimensions,
  Easing,
  Platform,
  useColorScheme,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type MapView from 'react-native-maps';
import {
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MomentRow, MomentType } from '@/db/repositories/moments';
import {
  addFavoritePlace,
  type SavedPlaceRow,
  upsertHomePlace,
  upsertWorkPlace,
} from '@/db/repositories/saved-places';
import { historyPanelChromeHeight } from '@/components/map/HistoryPanelChrome';
import { useHistoryForDay } from '@/hooks/use-history-data';
import { useLatestLocationSave } from '@/hooks/use-latest-location-save';
import { useSavedPlaces } from '@/hooks/use-saved-places';
import { useStaySavedPlace } from '@/hooks/use-stay-saved-place';
import { useDriveEndpointLabels } from '@/hooks/use-drive-endpoint-labels';
import { useDayMoments } from '@/hooks/use-day-moments';
import {
  buildHistoryMomentMapPins,
  buildMomentMapPins,
  type MomentMapPin,
} from '@/components/map/MomentMapOverlay';
import type { SavedPlaceMomentClusterOnMap } from '@/components/map/SavedPlacesMapOverlay';
import {
  countMomentsForEntry,
  countMomentsForStayEntry,
  filterMomentsForStayEntry,
  shouldHideSavedPlaceMomentCluster,
  hasMomentCounts,
  firstMomentIndexOfType,
  emptyMomentCounts,
  type MomentCountType,
  type MomentCounts,
} from '@/lib/moments/moment-counts';
import { queueMomentPreview } from '@/lib/moments/moment-preview-navigation';
import {
  coalesceMomentMapPins,
  partitionMomentMapPins,
  shouldClusterMomentsOnMap,
} from '@/lib/moments/moment-map-clustering';
import {
  useExpandVisitPlaceLookupArea,
  useSelectVisitPlaceCandidate,
  useSetCustomVisitPlaceLabel,
  useVisitPlaceDisplay,
} from '@/hooks/use-visit-place-display';
import { useResolvePlaceOnStaySelect } from '@/hooks/use-resolve-place-on-stay-select';
import { useTripDetectionConfig } from '@/hooks/use-trip-detection-config';
import { useTripPlayback } from '@/hooks/use-trip-playback';
import { buildHistoryMapPlan } from '@/lib/history-map-plan';
import {
  countHistoryTimelineEvents,
  formatMapDateLabel,
} from '@/lib/history-timeline';
import {
  followTodayDateKeyRoll,
  getTodayDateKey,
  shiftDateKey,
} from '@/lib/day-utils';
import { clampDateKeyToHistoryBounds } from '@/lib/history-calendar-bounds';
import {
  consumeHistoryDatePickerResult,
  queueHistoryDatePickerOpen,
} from '@/lib/history-date-picker-navigation';
import { useAppStore } from '@/stores/app-store';
import { regionForCoordinates, toMapCoordinates } from '@/lib/location-geo';
import { MAP_USER_ZOOM_DELTA, VISIT_MAX_ZOOM_DELTA } from '@/lib/app-constants';
import {
  animateRecenterToUser,
  centerMapOnUser,
  regionAroundCoordinate,
} from '@/lib/map-location-utils';
import { getTripPlaybackDurationMs } from '@/lib/trip-playback';
import { isVisitOngoing } from '@/lib/trip-format';
import { MAX_SAVED_PLACES } from '@/lib/app-constants';
import {
  canAddSavedPlace,
  matchSavedPlaceForStay,
  SavedPlaceLimitError,
} from '@/lib/saved-places';
import { getCurrentOpenActivity } from '@/lib/today-history';
import {
  isPlayableTimelineEntry,
  firstPlayableTimelineIndex,
  adjacentStaysForTravelIndex,
  stayMapMarkerCoordinate,
  type DetectedTrip,
  type DayTimelineEntry,
} from '@/lib/trip-detection';
import {
  shouldRefreshUserCoordinate,
  type MapUserCoordinate,
} from '@/lib/user-coordinate-throttle';
import {
  isVisitPlaceLabelConfirmed,
  visitPlaceDefaultLabel,
} from '@/lib/place-lookup-types';
import { buildMapAttributionInsets } from '@/lib/map-attribution-insets';
import {
  getBackgroundWorkRevision,
  isBackgroundWorkBannerVisible,
  subscribeBackgroundWork,
} from '@/lib/background-work-events';
import { setBackgroundWorkMapFocused } from '@/lib/background-work-pause';
import type { RootStackParamList } from '@/navigation/types';
import {
  refreshWidgetSnapshot,
  refreshWidgetSnapshotIfStale,
} from '@/lib/widget/sync-widget-snapshot';
import { registerWidgetSheetHandlers } from '@/lib/widget/widget-deep-link';
import { preloadTodayHistory } from '@/lib/history-preload';
import {
  coordinateFromRegion,
  isWorldFallbackRegion,
  resolveMapBootstrapRegion,
} from '@/lib/map-bootstrap-region';

import {
  MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP,
  MAP_HISTORY_FLOATING_CONTROLS_GAP,
  MAP_HISTORY_PANEL_CLOSE_MS,
  MAP_LOCATE_BUTTON_BOTTOM_GAP,
  MAP_SETTINGS_TOP_GAP,
  MAP_STACK_BUTTON_GAP,
  MAP_STACK_BUTTON_SIZE,
  BACKGROUND_WORK_BANNER_BODY_HEIGHT,
} from '@/lib/app-constants';
import {
  MAP_FALLBACK_REGION,
  mapHistoryPanelContentHeight,
  mapStackButtonBottom,
  mapStackTotalHeight,
} from './map-screen-constants';

export function useMapScreenController() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Map'>>();
  const tripDetectionConfig = useTripDetectionConfig();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const preferredMapApp = useAppStore(state => state.preferredMapApp);
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const todayKey = getTodayDateKey();
  const lastKnownTodayRef = useRef(todayKey);

  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

  const syncSelectedDateKeyForTodayRoll = useCallback(
    (nextTodayKey: string) => {
      const priorTodayKey = lastKnownTodayRef.current;
      if (priorTodayKey === nextTodayKey) {
        return;
      }
      lastKnownTodayRef.current = nextTodayKey;
      setSelectedDateKey(current =>
        followTodayDateKeyRoll(current, priorTodayKey, nextTodayKey),
      );
    },
    [],
  );

  useEffect(() => {
    syncSelectedDateKeyForTodayRoll(todayKey);
  }, [syncSelectedDateKeyForTodayRoll, todayKey]);

  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyPanelChromeVisible, setHistoryPanelChromeVisible] =
    useState(false);
  const [placeLabelEditStay, setPlaceLabelEditStay] =
    useState<DetectedTrip | null>(null);
  const [historyPanelContentHeight, setHistoryPanelContentHeight] = useState<
    number | null
  >(null);
  const [expandingVisitPlaceArea, setExpandingVisitPlaceArea] = useState(false);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);
  const [userCoordinate, setUserCoordinate] =
    useState<MapUserCoordinate | null>(null);
  const [mapInitialRegion, setMapInitialRegion] = useState<Region | null>(null);
  const [savePlaceCoordinate, setSavePlaceCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [clusterMomentsOnMap, setClusterMomentsOnMap] = useState(false);

  const {
    places: savedPlaces,
    hasHome,
    hasWork,
    refresh: refreshSavedPlaces,
  } = useSavedPlaces();
  const { dayMoments } = useDayMoments(selectedDateKey);
  const viewingToday = selectedDateKey === todayKey;
  const { data: historyData, loading: historyLoading } = useHistoryForDay(
    selectedDateKey,
    { active: true },
  );
  const latestLocationSaveAt = useLatestLocationSave();
  const earliestDateKey = useAppStore(state => state.historyEarliestDateKey);
  const canGoPrevDay =
    earliestDateKey == null || selectedDateKey > earliestDateKey;
  const canGoNextDay = !viewingToday;
  const mapDateLabel = useMemo(
    () => formatMapDateLabel(selectedDateKey, todayKey),
    [selectedDateKey, todayKey],
  );
  const historyEntries = historyData.entries;

  useEffect(() => {
    setPlaceLabelEditStay(null);
  }, [selectedHistoryIndex, selectedDateKey]);

  useEffect(() => {
    if (!historyPanelOpen) {
      setHistoryPanelContentHeight(null);
    }
  }, [historyPanelOpen]);

  const captureInFlightRef = useRef(false);
  const mapRef = useRef<MapView>(null);
  const hasCenteredOnOpenRef = useRef(false);
  const needsDefaultCenterRef = useRef(true);
  const mapRegionRef = useRef<Region>(MAP_FALLBACK_REGION);
  const clusterMomentsOnMapRef = useRef(false);
  const fitHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userCoordinateRef = useRef<MapUserCoordinate | null>(null);
  const lastUserCoordinateRefreshMsRef = useRef(0);
  const historyPanelY = useRef(new Animated.Value(400)).current;
  const historyPanelOpenRef = useRef(false);
  const pendingGoToTodayRef = useRef(false);
  const bootstrapCoordinateRef = useRef<MapUserCoordinate | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveMapBootstrapRegion().then(region => {
      if (cancelled) {
        return;
      }
      setMapInitialRegion(region);
      mapRegionRef.current = region;
      if (!isWorldFallbackRegion(region)) {
        bootstrapCoordinateRef.current = coordinateFromRegion(region);
        needsDefaultCenterRef.current = true;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        return;
      }
      syncSelectedDateKeyForTodayRoll(getTodayDateKey());
      if (selectedDateKey === getTodayDateKey()) {
        if (!historyPanelOpenRef.current) {
          needsDefaultCenterRef.current = true;
          const coordinate =
            userCoordinateRef.current ?? bootstrapCoordinateRef.current;
          if (coordinate != null && mapRef.current != null) {
            const region = regionAroundCoordinate(
              coordinate,
              MAP_USER_ZOOM_DELTA,
              MAP_USER_ZOOM_DELTA,
            );
            mapRef.current.animateToRegion(region, 400);
            mapRegionRef.current = region;
            needsDefaultCenterRef.current = false;
          }
        }
      }
    });
    return () => subscription.remove();
  }, [selectedDateKey, syncSelectedDateKeyForTodayRoll]);

  const playback = useTripPlayback();

  const historyHasGpsData =
    historyData.entries.length > 0 || historyData.points.length > 0;
  const historyDayLoaded =
    historyData.dateKey === selectedDateKey &&
    (!historyLoading || viewingToday || historyHasGpsData);
  const historyReadyForDay = historyDayLoaded && historyHasGpsData;
  const historyBlockingLoader =
    historyLoading && !historyDayLoaded && !viewingToday;

  const historyBadgeCount = useMemo(
    () => countHistoryTimelineEvents(historyEntries),
    [historyEntries],
  );
  const emptySelectedDayMessage = useMemo(() => {
    if (!historyDayLoaded || historyHasGpsData || historyPanelOpen) {
      return null;
    }
    if (viewingToday) {
      return null;
    }
    return 'No saved location data for this day.';
  }, [historyDayLoaded, historyHasGpsData, historyPanelOpen, viewingToday]);

  const trackingGapWarning = useMemo(() => {
    if (!viewingToday) {
      return null;
    }
    const lastSaveAt = latestLocationSaveAt;
    if (lastSaveAt == null) {
      return null;
    }
    const gapMs = Date.now() - lastSaveAt.getTime();
    if (gapMs < 2 * 60 * 60_000) {
      return null;
    }
    const hours = Math.floor(gapMs / 3_600_000);
    const minutes = Math.floor((gapMs % 3_600_000) / 60_000);
    return `No saved points for ${hours}h ${minutes}m`;
  }, [latestLocationSaveAt, viewingToday]);

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
        historyEntries,
        selectedHistoryIndex,
        tripDetectionConfig,
        historyData.points,
        savedPlaces,
      ),
    [
      historyData.points,
      historyEntries,
      savedPlaces,
      selectedHistoryIndex,
      tripDetectionConfig,
    ],
  );

  const showHistoryPanelContent = historyPanelChromeVisible && historyDayLoaded;

  const currentOpenActivity = useMemo(
    () =>
      viewingToday && !historyPanelOpen
        ? getCurrentOpenActivity(historyEntries, {
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

  const currentOpenVisit = useMemo(
    () => (currentOpenActivity?.kind === 'stay' ? currentOpenActivity : null),
    [currentOpenActivity],
  );

  const currentOpenDrive = useMemo(
    () => (currentOpenActivity?.kind === 'travel' ? currentOpenActivity : null),
    [currentOpenActivity],
  );

  const currentOpenVisitSavedPlace = useStaySavedPlace(
    currentOpenVisit,
    savedPlaces,
  );

  const currentOpenDriveAdjacentStays = useMemo(() => {
    if (currentOpenDrive == null) {
      return { previousStay: null, nextStay: null };
    }
    const index = historyEntries.findIndex(
      entry => entry.id === currentOpenDrive.id,
    );
    if (index < 0) {
      return { previousStay: null, nextStay: null };
    }
    return adjacentStaysForTravelIndex(historyEntries, index);
  }, [currentOpenDrive, historyEntries]);

  const currentOpenDriveEndpointLabels = useDriveEndpointLabels(
    currentOpenDriveAdjacentStays.previousStay,
    currentOpenDriveAdjacentStays.nextStay,
    savedPlaces,
  );

  const selectedSavedPlace = useStaySavedPlace(
    selectedPlayable?.kind === 'stay' ? selectedPlayable : null,
    savedPlaces,
  );

  const selectedTravelAdjacentStays = useMemo(() => {
    if (selectedPlayable?.kind !== 'travel' || selectedHistoryIndex < 0) {
      return { previousStay: null, nextStay: null };
    }
    return adjacentStaysForTravelIndex(historyEntries, selectedHistoryIndex);
  }, [historyEntries, selectedHistoryIndex, selectedPlayable]);

  const selectedDriveEndpointLabels = useDriveEndpointLabels(
    selectedTravelAdjacentStays.previousStay,
    selectedTravelAdjacentStays.nextStay,
    savedPlaces,
  );

  const selectedStay =
    selectedPlayable?.kind === 'stay' ? selectedPlayable : null;

  const historyScrubOnEvent =
    historyPanelChromeVisible &&
    selectedHistoryIndex >= 0 &&
    selectedEntry != null;

  const showPlaceLabelCard = historyScrubOnEvent && placeLabelEditStay != null;

  const selectedEntryMomentCounts = useMemo((): MomentCounts | undefined => {
    if (!selectedEntry) {
      return undefined;
    }
    return countMomentsForEntry(dayMoments, selectedEntry);
  }, [dayMoments, selectedEntry]);

  const historyEventCardHasMoments =
    historyScrubOnEvent &&
    selectedEntryMomentCounts != null &&
    hasMomentCounts(selectedEntryMomentCounts);

  const estimatedHistoryPanelContentHeight = mapHistoryPanelContentHeight(
    showPlaceLabelCard,
    historyEventCardHasMoments,
  );
  const resolvedHistoryPanelContentHeight =
    historyPanelContentHeight ?? estimatedHistoryPanelContentHeight;

  const handleHistoryPanelContentLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      setHistoryPanelContentHeight(current =>
        current === nextHeight ? current : nextHeight,
      );
    },
    [],
  );

  useEffect(() => {
    setHistoryPanelContentHeight(null);
  }, [
    selectedHistoryIndex,
    selectedDateKey,
    showPlaceLabelCard,
    historyEventCardHasMoments,
  ]);

  const showDayJourney =
    !historyPanelOpen && !playback.isPlaying && historyDayLoaded;
  const currentVisitMomentCounts = useMemo((): MomentCounts => {
    if (!currentOpenVisit) {
      return emptyMomentCounts();
    }
    return countMomentsForStayEntry(dayMoments, currentOpenVisit, {
      savedPlace: currentOpenVisitSavedPlace,
      dwellRadiusMeters: tripDetectionConfig.dwellRadiusMeters,
      points: historyData.points,
      entries: historyEntries,
      aggregation: 'place',
    });
  }, [
    currentOpenVisit,
    currentOpenVisitSavedPlace,
    dayMoments,
    historyData.points,
    historyEntries,
    tripDetectionConfig.dwellRadiusMeters,
  ]);
  const currentVisitPreviewMoments = useMemo((): MomentRow[] => {
    if (!currentOpenVisit) {
      return [];
    }
    return filterMomentsForStayEntry(dayMoments, currentOpenVisit, {
      savedPlace: currentOpenVisitSavedPlace,
      dwellRadiusMeters: tripDetectionConfig.dwellRadiusMeters,
      points: historyData.points,
      entries: historyEntries,
      aggregation: 'place',
    });
  }, [
    currentOpenVisit,
    currentOpenVisitSavedPlace,
    dayMoments,
    historyData.points,
    historyEntries,
    tripDetectionConfig.dwellRadiusMeters,
  ]);
  const selectedEntryPreviewMoments = useMemo((): MomentRow[] => {
    if (!selectedEntry) {
      return [];
    }
    return filterMomentsForStayEntry(dayMoments, selectedEntry, {
      savedPlace:
        selectedEntry.kind === 'stay'
          ? matchSavedPlaceForStay(selectedEntry, savedPlaces)
          : null,
      dwellRadiusMeters: tripDetectionConfig.dwellRadiusMeters,
      points: historyData.points,
      entries: historyEntries,
      aggregation: 'visit',
    });
  }, [
    dayMoments,
    historyData.points,
    historyEntries,
    savedPlaces,
    selectedEntry,
    tripDetectionConfig.dwellRadiusMeters,
  ]);

  const provider =
    Platform.OS === 'android' && preferredMapApp === 'google'
      ? PROVIDER_GOOGLE
      : PROVIDER_DEFAULT;

  const historyPanelSlideDistance = useMemo(
    () =>
      resolvedHistoryPanelContentHeight +
      MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP +
      historyPanelChromeHeight() +
      24,
    [resolvedHistoryPanelContentHeight],
  );
  const historyPanelSlideDistanceRef = useRef(historyPanelSlideDistance);
  historyPanelSlideDistanceRef.current = historyPanelSlideDistance;

  const historyPanelBottom =
    insets.bottom +
    historyPanelChromeHeight() +
    MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP +
    resolvedHistoryPanelContentHeight;
  const stackBaseBottom = historyPanelOpen
    ? historyPanelBottom + MAP_HISTORY_FLOATING_CONTROLS_GAP
    : insets.bottom + MAP_LOCATE_BUTTON_BOTTOM_GAP;

  const locateButtonBottom = mapStackButtonBottom(stackBaseBottom, 0);
  const historyButtonBottom = mapStackButtonBottom(
    stackBaseBottom,
    viewingToday ? 1 : 0,
  );
  const placesButtonBottom = mapStackButtonBottom(stackBaseBottom, 2);
  const settingsButtonBottom = mapStackButtonBottom(
    stackBaseBottom,
    viewingToday ? 3 : 1,
  );

  const cameraButtonBottom = mapStackButtonBottom(stackBaseBottom, 0);
  const voiceButtonBottom = mapStackButtonBottom(stackBaseBottom, 1);
  const noteButtonBottom = mapStackButtonBottom(stackBaseBottom, 2);
  const activityButtonBottom = mapStackButtonBottom(stackBaseBottom, 3);

  const dateNavAnchorBottom = stackBaseBottom;

  const leftStackButtonCount = viewingToday ? 4 : 2;
  const leftStackHeight = mapStackTotalHeight(
    leftStackButtonCount,
    MAP_STACK_BUTTON_SIZE,
    MAP_STACK_BUTTON_GAP,
  );
  const floatingControlsClearance = stackBaseBottom + leftStackHeight + 16;

  const backgroundWorkRevision = useSyncExternalStore(
    subscribeBackgroundWork,
    getBackgroundWorkRevision,
    getBackgroundWorkRevision,
  );
  const backgroundWorkBannerVisible = useSyncExternalStore(
    subscribeBackgroundWork,
    isBackgroundWorkBannerVisible,
    isBackgroundWorkBannerVisible,
  );

  const mapPadding = useMemo(
    () => ({
      top:
        insets.top +
        MAP_SETTINGS_TOP_GAP +
        (backgroundWorkBannerVisible ? BACKGROUND_WORK_BANNER_BODY_HEIGHT : 0),
      right: 12,
      bottom: floatingControlsClearance,
      left: 12,
    }),
    [
      floatingControlsClearance,
      insets.top,
      backgroundWorkBannerVisible,
      backgroundWorkRevision,
    ],
  );

  const screenWidth = Dimensions.get('window').width;
  const mapAttributionInsets = useMemo(
    () =>
      buildMapAttributionInsets({
        screenWidth,
        dateNavBottom: dateNavAnchorBottom,
      }),
    [screenWidth, dateNavAnchorBottom],
  );

  const scrubOnEvent = historyScrubOnEvent;

  const selectedVisitPlaceDisplay = useVisitPlaceDisplay(
    scrubOnEvent && selectedStay ? selectedStay : null,
    savedPlaces,
  );

  const visitPlaceResolving = useResolvePlaceOnStaySelect(
    scrubOnEvent && selectedStay ? selectedStay : null,
    selectedDateKey,
    savedPlaces,
    historyScrubOnEvent,
  );

  const placeLabelEditDisplay = useVisitPlaceDisplay(
    placeLabelEditStay,
    savedPlaces,
  );
  const {
    cacheId: placeLabelEditCacheId,
    candidates: placeLabelEditCandidates,
    materializedTripId: placeLabelEditMaterializedTripId,
    selectedPoiId: placeLabelEditSelectedPoiId,
  } = placeLabelEditDisplay;

  const visitPlaceLabelInEventCard = useMemo(() => {
    if (visitPlaceResolving) {
      return 'Finding place…';
    }
    if (!historyScrubOnEvent || selectedSavedPlace != null) {
      return null;
    }
    if (isVisitPlaceLabelConfirmed(selectedVisitPlaceDisplay)) {
      return selectedVisitPlaceDisplay.primaryLabel;
    }
    return visitPlaceDefaultLabel(selectedVisitPlaceDisplay);
  }, [
    visitPlaceResolving,
    historyScrubOnEvent,
    selectedSavedPlace,
    selectedVisitPlaceDisplay,
  ]);

  const openPlaceLabelCardForStay = useCallback(
    (stay: DetectedTrip) => {
      if (matchSavedPlaceForStay(stay, savedPlaces)) {
        return;
      }
      setPlaceLabelEditStay(stay);
    },
    [savedPlaces],
  );

  const openVisitPlaceLabelCard = useCallback(() => {
    if (selectedStay) {
      openPlaceLabelCardForStay(selectedStay);
    }
  }, [openPlaceLabelCardForStay, selectedStay]);

  const openDriveStartLabelCard = useCallback(() => {
    const stay = selectedTravelAdjacentStays.previousStay;
    if (stay) {
      openPlaceLabelCardForStay(stay);
    }
  }, [openPlaceLabelCardForStay, selectedTravelAdjacentStays.previousStay]);

  const openDriveEndLabelCard = useCallback(() => {
    const stay = selectedTravelAdjacentStays.nextStay;
    if (stay) {
      openPlaceLabelCardForStay(stay);
    }
  }, [openPlaceLabelCardForStay, selectedTravelAdjacentStays.nextStay]);

  const canEditDriveStartLabel =
    selectedTravelAdjacentStays.previousStay != null &&
    selectedDriveEndpointLabels.start.source !== 'saved';
  const canEditDriveEndLabel =
    selectedTravelAdjacentStays.nextStay != null &&
    selectedDriveEndpointLabels.end.source !== 'saved';

  const currentOpenVisitPlaceDisplay = useVisitPlaceDisplay(
    currentOpenVisit,
    savedPlaces,
  );

  const selectVisitPlaceCandidate = useSelectVisitPlaceCandidate();
  const setCustomVisitPlaceLabel = useSetCustomVisitPlaceLabel();
  const expandVisitPlaceLookupArea = useExpandVisitPlaceLookupArea();

  const handleSelectVisitPlacePoi = useCallback(
    (poiId: number, poiLabel: string) => {
      if (!placeLabelEditStay) {
        return;
      }
      void selectVisitPlaceCandidate({
        cacheId: placeLabelEditDisplay.cacheId,
        poiId,
        poiLabel,
        stay: placeLabelEditStay,
        dateKey: selectedDateKey,
        materializedTripId: placeLabelEditDisplay.materializedTripId,
      });
    },
    [
      placeLabelEditDisplay.cacheId,
      placeLabelEditDisplay.materializedTripId,
      placeLabelEditStay,
      selectVisitPlaceCandidate,
      selectedDateKey,
    ],
  );

  const handleDonePlaceLabel = useCallback(() => {
    const stay = placeLabelEditStay;
    if (!stay) {
      return;
    }
    const selected =
      placeLabelEditSelectedPoiId != null
        ? placeLabelEditCandidates.find(
            candidate => candidate.id === placeLabelEditSelectedPoiId,
          )
        : null;
    const done =
      selected != null
        ? selectVisitPlaceCandidate({
            cacheId: placeLabelEditCacheId,
            poiId: selected.id,
            poiLabel: selected.name,
            stay,
            dateKey: selectedDateKey,
            materializedTripId: placeLabelEditMaterializedTripId,
          })
        : Promise.resolve();
    void done.finally(() => {
      setPlaceLabelEditStay(null);
    });
  }, [
    placeLabelEditCacheId,
    placeLabelEditCandidates,
    placeLabelEditMaterializedTripId,
    placeLabelEditSelectedPoiId,
    placeLabelEditStay,
    selectVisitPlaceCandidate,
    selectedDateKey,
  ]);

  const handleExpandVisitPlaceArea = useCallback(() => {
    if (!placeLabelEditStay || placeLabelEditCacheId == null) {
      return;
    }
    setExpandingVisitPlaceArea(true);
    void expandVisitPlaceLookupArea(placeLabelEditCacheId).finally(() =>
      setExpandingVisitPlaceArea(false),
    );
  }, [expandVisitPlaceLookupArea, placeLabelEditCacheId, placeLabelEditStay]);

  const handleSaveCustomVisitPlaceLabel = useCallback(
    (label: string) => {
      if (!placeLabelEditStay) {
        return;
      }
      void setCustomVisitPlaceLabel({
        cacheId: placeLabelEditDisplay.cacheId,
        label,
        stay: placeLabelEditStay,
        dateKey: selectedDateKey,
        materializedTripId: placeLabelEditDisplay.materializedTripId,
      }).then(() => {
        setPlaceLabelEditStay(null);
      });
    },
    [
      placeLabelEditDisplay.cacheId,
      placeLabelEditDisplay.materializedTripId,
      placeLabelEditStay,
      selectedDateKey,
      setCustomVisitPlaceLabel,
    ],
  );

  const showHistoryMap =
    historyPanelOpen &&
    historyReadyForDay &&
    selectedHistoryIndex >= 0 &&
    historyMapPlan.selected != null;

  /** Defer pins until today's timeline exists so Home isn't shown then hidden when the card loads. */
  const showSavedPlaceMarkersOnMap =
    showHistoryMap || !viewingToday || historyHasGpsData;

  const dayMomentMapPinsRaw = useMemo((): MomentMapPin[] => {
    if (!showDayJourney || currentOpenVisit != null) {
      return [];
    }
    return coalesceMomentMapPins(
      buildMomentMapPins(dayMoments, historyData.points, historyEntries),
    );
  }, [
    currentOpenVisit,
    showDayJourney,
    dayMoments,
    historyData.points,
    historyEntries,
  ]);

  const historyMomentMapPinsRaw = useMemo((): MomentMapPin[] => {
    if (!showHistoryMap || !selectedEntry) {
      return [];
    }
    return buildHistoryMomentMapPins(
      selectedEntry,
      dayMoments,
      historyData.points,
    );
  }, [showHistoryMap, selectedEntry, dayMoments, historyData.points]);

  const dayMomentMapPins = useMemo(
    () =>
      partitionMomentMapPins(
        dayMomentMapPinsRaw,
        savedPlaces,
        clusterMomentsOnMap,
      ).individualPins,
    [dayMomentMapPinsRaw, savedPlaces, clusterMomentsOnMap],
  );

  const historyMomentMapPins = useMemo(
    () =>
      partitionMomentMapPins(
        historyMomentMapPinsRaw,
        savedPlaces,
        clusterMomentsOnMap,
      ).individualPins,
    [historyMomentMapPinsRaw, savedPlaces, clusterMomentsOnMap],
  );

  const openMomentPreview = useCallback(
    (payload: {
      moments: MomentRow[];
      initialType?: MomentType;
      initialMomentId?: number;
      initialIndex?: number;
      previewEntry?: DayTimelineEntry | null;
    }) => {
      if (payload.moments.length === 0) {
        return;
      }
      let initialIndex = payload.initialIndex ?? 0;
      if (payload.initialMomentId != null) {
        const momentIndex = payload.moments.findIndex(
          moment => moment.id === payload.initialMomentId,
        );
        if (momentIndex >= 0) {
          initialIndex = momentIndex;
        }
      } else if (payload.initialType != null) {
        initialIndex = Math.max(
          0,
          firstMomentIndexOfType(payload.moments, payload.initialType),
        );
      }
      queueMomentPreview({
        moments: payload.moments,
        initialIndex,
        previewEntry: payload.previewEntry ?? null,
        dateKey: selectedDateKey,
      });
      navigation.navigate('MomentPreview');
    },
    [navigation, selectedDateKey],
  );

  const savedPlaceMomentClusters =
    useMemo((): SavedPlaceMomentClusterOnMap[] => {
      const raw = showDayJourney
        ? dayMomentMapPinsRaw
        : showHistoryMap
        ? historyMomentMapPinsRaw
        : [];
      if (raw.length === 0 || !clusterMomentsOnMap) {
        return [];
      }

      const calloutSavedPlaceId = showDayJourney
        ? currentOpenVisitSavedPlace?.id
        : selectedSavedPlace?.id;
      const calloutMomentCounts = showDayJourney
        ? currentVisitMomentCounts
        : selectedEntryMomentCounts;

      return partitionMomentMapPins(raw, savedPlaces, true)
        .savedPlaceClusters.filter(
          cluster =>
            !shouldHideSavedPlaceMomentCluster(
              cluster.place.id,
              calloutSavedPlaceId,
              calloutMomentCounts,
            ),
        )
        .map(cluster => {
          const initialMomentId = cluster.momentIds[0];
          return {
            placeId: cluster.place.id,
            counts: cluster.counts,
            onPress: () => {
              openMomentPreview({
                moments: dayMoments,
                initialMomentId,
              });
            },
          };
        });
    }, [
      clusterMomentsOnMap,
      currentOpenVisitSavedPlace?.id,
      currentVisitMomentCounts,
      dayMomentMapPinsRaw,
      dayMoments,
      historyMomentMapPinsRaw,
      openMomentPreview,
      savedPlaces,
      selectedEntryMomentCounts,
      selectedSavedPlace?.id,
      showDayJourney,
      showHistoryMap,
    ]);

  const openCurrentVisitMomentsPreview = useCallback(
    (initialType?: MomentCountType) => {
      if (!currentOpenVisit) {
        return;
      }
      openMomentPreview({
        moments: currentVisitPreviewMoments,
        initialType,
        previewEntry: currentOpenVisit,
      });
    },
    [currentOpenVisit, currentVisitPreviewMoments, openMomentPreview],
  );

  const openSelectedEntryMomentsPreview = useCallback(
    (initialType?: MomentCountType) => {
      if (!selectedEntry) {
        return;
      }
      openMomentPreview({
        moments: selectedEntryPreviewMoments,
        initialType,
        previewEntry: selectedEntry,
      });
    },
    [openMomentPreview, selectedEntry, selectedEntryPreviewMoments],
  );

  const openMomentMapPinPreview = useCallback(
    (pin: MomentMapPin) => {
      const grouped = pin.groupedMoments ?? [];
      const moments =
        grouped.length > 0
          ? [pin.moment, ...grouped].sort(
              (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
            )
          : dayMoments;
      openMomentPreview({
        moments,
        initialMomentId: pin.moment.id,
      });
    },
    [dayMoments, openMomentPreview],
  );

  const showUserLocation =
    !historyPanelOpen && !playback.isPlaying && viewingToday;

  const onRegionChangeComplete = useCallback((region: Region) => {
    mapRegionRef.current = region;
    const nextClusterMoments = shouldClusterMomentsOnMap(region.latitudeDelta);
    if (nextClusterMoments !== clusterMomentsOnMapRef.current) {
      clusterMomentsOnMapRef.current = nextClusterMoments;
      setClusterMomentsOnMap(nextClusterMoments);
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
      nativeEvent: { coordinate?: { latitude: number; longitude: number } };
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
        ? selectedMap?.travelPoints ?? selectedPlayable.points
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
    queueHistoryDatePickerOpen({ selectedDateKey });
    navigation.navigate('HistoryDatePicker');
  }, [navigation, selectedDateKey]);

  const handleSelectMapDate = useCallback(
    (dateKey: string) => {
      setSelectedDateKey(clampDateKeyToHistoryBounds(dateKey));
      setSelectedHistoryIndex(-1);
      playback.stop();
    },
    [playback],
  );

  const handleHistoryDateKeyChange = useCallback(
    (dateKey: string) => {
      setSelectedDateKey(clampDateKeyToHistoryBounds(dateKey));
      setSelectedHistoryIndex(-1);
      playback.stop();
    },
    [playback],
  );

  const goToTodayOnPanelClosedRef = useRef(() => {});
  goToTodayOnPanelClosedRef.current = () => {
    handleHistoryDateKeyChange(todayKey);
  };

  const goToToday = useCallback(() => {
    if (historyPanelOpen || historyPanelChromeVisible) {
      // Defer the date change until the panel close animation finishes so
      // historyPanelSlideDistance and chrome layout stay stable mid-animation.
      pendingGoToTodayRef.current = true;
      void preloadTodayHistory();
      setHistoryPanelOpen(false);
      playback.stop();
      return;
    }
    handleHistoryDateKeyChange(todayKey);
  }, [
    handleHistoryDateKeyChange,
    historyPanelChromeVisible,
    historyPanelOpen,
    playback,
    todayKey,
  ]);

  const closeHistoryPanel = useCallback(() => {
    setHistoryPanelOpen(false);
    setPlaceLabelEditStay(null);
    playback.stop();
  }, [playback]);

  const goToPrevDay = useCallback(() => {
    if (!canGoPrevDay) {
      return;
    }
    const nextKey = shiftDateKey(selectedDateKey, -1);
    if (earliestDateKey != null && nextKey < earliestDateKey) {
      handleHistoryDateKeyChange(earliestDateKey);
      return;
    }
    handleHistoryDateKeyChange(nextKey);
  }, [
    canGoPrevDay,
    earliestDateKey,
    handleHistoryDateKeyChange,
    selectedDateKey,
  ]);

  const goToNextDay = useCallback(() => {
    if (!canGoNextDay) {
      return;
    }
    handleHistoryDateKeyChange(shiftDateKey(selectedDateKey, 1));
  }, [canGoNextDay, handleHistoryDateKeyChange, selectedDateKey]);

  const handleToggleHistoryPanel = useCallback(() => {
    setHistoryPanelOpen(open => {
      const next = !open;
      if (next) {
        setHistoryPanelChromeVisible(true);
        historyPanelY.setValue(historyPanelSlideDistanceRef.current);
        setSelectedHistoryIndex(firstPlayableTimelineIndex(historyEntries));
      } else {
        playback.stop();
      }
      return next;
    });
  }, [historyEntries, historyPanelY, playback]);

  const handlePlayHistory = useCallback(() => {
    if (!selectedPlayable || selectedPlayable.kind !== 'travel') {
      return;
    }
    scheduleFitSelectedHistory(true);
    playback.start(getTripPlaybackDurationMs(selectedPlayable.durationMs));
  }, [playback, scheduleFitSelectedHistory, selectedPlayable]);

  const handleMapLongPress = useCallback(
    (event: {
      nativeEvent: { coordinate: { latitude: number; longitude: number } };
    }) => {
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
    async (coordinate: { latitude: number; longitude: number }) => {
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
    async (coordinate: { latitude: number; longitude: number }) => {
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
      coordinate: { latitude: number; longitude: number },
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

  const openSavedPlaces = useCallback(() => {
    navigation.navigate('SavedPlaces');
  }, [navigation]);

  const openSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  const openCaptureVoice = useCallback(() => {
    navigation.navigate('CaptureVoice');
  }, [navigation]);

  const openCaptureActivity = useCallback(() => {
    navigation.navigate('CaptureActivity');
  }, [navigation]);

  const handleSelectSavedPlace = useCallback((place: SavedPlaceRow) => {
    if (!mapRef.current) {
      return;
    }
    const region = regionAroundCoordinate(
      { latitude: place.lat, longitude: place.lng },
      VISIT_MAX_ZOOM_DELTA,
      VISIT_MAX_ZOOM_DELTA,
    );
    mapRef.current.animateToRegion(region, 400);
    mapRegionRef.current = region;
    needsDefaultCenterRef.current = false;
  }, []);

  useEffect(() => {
    const focusPlaceId = route.params?.focusPlaceId;
    if (focusPlaceId == null) {
      return;
    }
    const place = savedPlaces.find(entry => entry.id === focusPlaceId);
    if (place != null) {
      handleSelectSavedPlace(place);
    }
    navigation.setParams({ focusPlaceId: undefined });
  }, [
    handleSelectSavedPlace,
    navigation,
    route.params?.focusPlaceId,
    savedPlaces,
  ]);

  const handleZoomVisit = useCallback(() => {
    if (
      !mapRef.current ||
      !selectedPlayable ||
      selectedPlayable.kind !== 'stay'
    ) {
      return;
    }
    const ongoing = isVisitOngoing(selectedPlayable.endAt, new Date(), {
      openThroughNow: selectedPlayable.openThroughNow,
    });
    const coordinate = stayMapMarkerCoordinate(selectedPlayable, { ongoing });
    const region = regionAroundCoordinate(
      coordinate,
      VISIT_MAX_ZOOM_DELTA,
      VISIT_MAX_ZOOM_DELTA,
    );
    mapRef.current.animateToRegion(region, 400);
    mapRegionRef.current = region;
  }, [selectedPlayable]);

  useEffect(() => {
    const opening = historyPanelOpen && !historyPanelOpenRef.current;
    historyPanelOpenRef.current = historyPanelOpen;

    const slideDistance = historyPanelSlideDistanceRef.current;

    if (opening) {
      setHistoryPanelChromeVisible(true);
      historyPanelY.setValue(slideDistance);
    }

    const animation = historyPanelOpen
      ? Animated.spring(historyPanelY, {
          toValue: 0,
          damping: 22,
          stiffness: 340,
          mass: 0.7,
          useNativeDriver: true,
        })
      : Animated.timing(historyPanelY, {
          toValue: slideDistance,
          duration: MAP_HISTORY_PANEL_CLOSE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });

    animation.start(({ finished }) => {
      if (finished && !historyPanelOpen) {
        setHistoryPanelChromeVisible(false);
        setSelectedHistoryIndex(-1);
        if (pendingGoToTodayRef.current) {
          pendingGoToTodayRef.current = false;
          goToTodayOnPanelClosedRef.current();
        }
      }
    });

    return () => {
      animation.stop();
    };
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

  const historyPointFitKey = useMemo(() => {
    const points = historyData.points;
    if (points.length === 0) {
      return '0';
    }
    const first = points[0]!;
    const last = points[points.length - 1]!;
    return `${points.length}:${first.id}:${last.id}`;
  }, [historyData.points]);

  useEffect(() => {
    if (historyPanelOpen || historyBlockingLoader || !mapRef.current) {
      return;
    }

    if (viewingToday) {
      if (!needsDefaultCenterRef.current) {
        return;
      }
      const lastHistoryPoint = historyData.points.at(-1);
      const coordinate =
        userCoordinate ??
        bootstrapCoordinateRef.current ??
        (lastHistoryPoint != null
          ? { latitude: lastHistoryPoint.lat, longitude: lastHistoryPoint.lng }
          : null);
      if (coordinate == null) {
        return;
      }
      needsDefaultCenterRef.current = false;
      const region = regionAroundCoordinate(
        coordinate,
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
    historyBlockingLoader,
    historyData.points,
    historyPanelOpen,
    historyPointFitKey,
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
  }, [historyEntries, historyLoading, historyPanelOpen, selectedHistoryIndex]);

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

  const handleCaptureCamera = useCallback(() => {
    if (captureInFlightRef.current) {
      return;
    }
    captureInFlightRef.current = true;
    try {
      navigation.navigate('CapturePhoto');
    } finally {
      captureInFlightRef.current = false;
    }
  }, [navigation]);

  const handleCaptureNote = useCallback(() => {
    navigation.navigate('CaptureNote');
  }, [navigation]);

  useEffect(() => {
    registerWidgetSheetHandlers({
      refresh: () => {
        void refreshWidgetSnapshot().catch(() => undefined);
      },
    });

    return () => registerWidgetSheetHandlers(null);
  }, []);

  useEffect(() => {
    void refreshWidgetSnapshotIfStale().catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setBackgroundWorkMapFocused(true);
      return () => {
        setBackgroundWorkMapFocused(false);
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      const dateKey = consumeHistoryDatePickerResult();
      if (dateKey != null) {
        handleSelectMapDate(dateKey);
      }
    }, [handleSelectMapDate]),
  );

  return useMemo(
    () => ({
      tripDetectionConfig,
      insets,
      colorScheme,
      distanceUnit,
      mapRef,
      mapInitialRegion,
      provider,
      mapPadding,
      mapAttributionInsets,
      locateButtonBottom,
      settingsButtonBottom,
      placesButtonBottom,
      historyButtonBottom,
      cameraButtonBottom,
      voiceButtonBottom,
      noteButtonBottom,
      activityButtonBottom,
      openCaptureVoice,
      openCaptureActivity,
      handleCaptureCamera,
      handleCaptureNote,
      openCurrentVisitMomentsPreview,
      openSelectedEntryMomentsPreview,
      openMomentMapPinPreview,
      historyData,
      historyLoading,
      historyBlockingLoader,
      historyEntries,
      dayStays,
      dayTravels,
      historyMapPlan,
      historyBadgeCount,
      trackingGapWarning,
      emptySelectedDayMessage,
      viewingToday,
      historyHasGpsData,
      canGoPrevDay,
      canGoNextDay,
      goToPrevDay,
      goToNextDay,
      goToToday,
      closeHistoryPanel,
      dateNavAnchorBottom,
      historyPanelOpen,
      historyPanelChromeVisible,
      historyPanelY,
      historyPanelSlideDistance,
      handleHistoryPanelContentLayout,
      selectedDateKey,
      mapDateLabel,
      selectedHistoryIndex,
      selectedEntry,
      selectedPlayable,
      scrubOnEvent,
      showHistoryPanelContent,
      showHistoryMap,
      showDayJourney,
      showSavedPlaceMarkersOnMap,
      currentVisitMomentCounts,
      dayMomentMapPins,
      historyMomentMapPins,
      selectedEntryMomentCounts,
      showUserLocation,
      currentOpenVisit,
      currentOpenDrive,
      currentOpenVisitSavedPlace,
      currentOpenDriveEndpointLabels,
      selectedSavedPlace,
      selectedDriveEndpointLabels,
      selectedVisitPlaceDisplay,
      visitPlaceLabelInEventCard,
      visitPlaceResolving,
      showPlaceLabelCard,
      placeLabelEditDisplay,
      openVisitPlaceLabelCard,
      openDriveStartLabelCard,
      openDriveEndLabelCard,
      canEditDriveStartLabel,
      canEditDriveEndLabel,
      handleDonePlaceLabel,
      currentOpenVisitPlaceDisplay,
      handleSelectVisitPlacePoi,
      handleExpandVisitPlaceArea,
      handleSaveCustomVisitPlaceLabel,
      expandingVisitPlaceArea,
      savedPlaces,
      hasHome,
      hasWork,
      canSaveHome,
      canSaveWork,
      canSaveFavorite,
      isAtSavedPlaceLimit,
      maxSavedPlaces: MAX_SAVED_PLACES,
      savedPlaceMomentClusters,
      savePlaceCoordinate,
      userCoordinate,
      playback,
      onRegionChangeComplete,
      handleUserLocation,
      handleMapLongPress,
      closeSavePlaceSheet,
      handleSaveHomePlace,
      handleSaveWorkPlace,
      handleSaveFavoritePlace,
      openSavedPlaces,
      openSettings,
      goToCurrentLocation,
      openHistoryDatePicker,
      handleSelectMapDate,
      handleHistoryDateKeyChange,
      handleToggleHistoryPanel,
      selectHistoryIndex,
      handlePlayHistory,
      handleZoomVisit,
    }),
    [
      tripDetectionConfig,
      insets,
      colorScheme,
      distanceUnit,
      mapRef,
      mapInitialRegion,
      provider,
      mapPadding,
      mapAttributionInsets,
      locateButtonBottom,
      settingsButtonBottom,
      placesButtonBottom,
      historyButtonBottom,
      cameraButtonBottom,
      voiceButtonBottom,
      noteButtonBottom,
      activityButtonBottom,
      openCaptureVoice,
      openCaptureActivity,
      handleCaptureCamera,
      handleCaptureNote,
      openCurrentVisitMomentsPreview,
      openSelectedEntryMomentsPreview,
      openMomentMapPinPreview,
      historyData,
      historyLoading,
      historyBlockingLoader,
      historyEntries,
      dayStays,
      dayTravels,
      historyMapPlan,
      historyBadgeCount,
      trackingGapWarning,
      emptySelectedDayMessage,
      viewingToday,
      historyHasGpsData,
      canGoPrevDay,
      canGoNextDay,
      goToPrevDay,
      goToNextDay,
      goToToday,
      closeHistoryPanel,
      dateNavAnchorBottom,
      historyPanelOpen,
      historyPanelChromeVisible,
      historyPanelY,
      historyPanelSlideDistance,
      handleHistoryPanelContentLayout,
      selectedDateKey,
      mapDateLabel,
      selectedHistoryIndex,
      selectedEntry,
      selectedPlayable,
      scrubOnEvent,
      showHistoryPanelContent,
      showHistoryMap,
      showDayJourney,
      showSavedPlaceMarkersOnMap,
      currentVisitMomentCounts,
      dayMomentMapPins,
      historyMomentMapPins,
      selectedEntryMomentCounts,
      showUserLocation,
      currentOpenVisit,
      currentOpenDrive,
      currentOpenVisitSavedPlace,
      currentOpenDriveEndpointLabels,
      selectedSavedPlace,
      selectedDriveEndpointLabels,
      selectedVisitPlaceDisplay,
      visitPlaceLabelInEventCard,
      visitPlaceResolving,
      showPlaceLabelCard,
      placeLabelEditDisplay,
      openVisitPlaceLabelCard,
      openDriveStartLabelCard,
      openDriveEndLabelCard,
      canEditDriveStartLabel,
      canEditDriveEndLabel,
      handleDonePlaceLabel,
      currentOpenVisitPlaceDisplay,
      handleSelectVisitPlacePoi,
      handleExpandVisitPlaceArea,
      handleSaveCustomVisitPlaceLabel,
      expandingVisitPlaceArea,
      savedPlaces,
      hasHome,
      hasWork,
      canSaveHome,
      canSaveWork,
      canSaveFavorite,
      isAtSavedPlaceLimit,
      savedPlaceMomentClusters,
      savePlaceCoordinate,
      userCoordinate,
      playback,
      onRegionChangeComplete,
      handleUserLocation,
      handleMapLongPress,
      closeSavePlaceSheet,
      handleSaveHomePlace,
      handleSaveWorkPlace,
      handleSaveFavoritePlace,
      openSavedPlaces,
      openSettings,
      goToCurrentLocation,
      openHistoryDatePicker,
      handleSelectMapDate,
      handleHistoryDateKeyChange,
      handleToggleHistoryPanel,
      selectHistoryIndex,
      handlePlayHistory,
      handleZoomVisit,
    ],
  );
}

export type MapScreenController = ReturnType<typeof useMapScreenController>;
