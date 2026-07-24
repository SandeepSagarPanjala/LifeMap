import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Animated,
  AppState,
  Easing,
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
import { type Region } from 'react-native-maps';
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
import { useDayStoryStops } from '@/hooks/use-day-story-stops';
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
  EMPTY_MOMENT_COUNTS,
  type MomentCountType,
  type MomentCounts,
} from '@/lib/moments/moment-counts';
import {
  isCoordinateOnDayStoryStop,
  type DayStoryStop,
} from '@/lib/day-story-stops';
import { collectMomentsForDayStoryStop } from '@/lib/day-story-moments';
import { queueMomentPreview } from '@/lib/moments/moment-preview-navigation';
import {
  coalesceMomentMapPins,
  partitionMomentMapPins,
  shouldClusterMomentsOnMap,
} from '@/lib/moments/moment-map-clustering';
import {
  useSelectVisitPlaceCandidate,
  useSetCustomVisitPlaceLabel,
  useVisitPlaceDisplay,
} from '@/hooks/use-visit-place-display';
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
import {
  BACKGROUND_WORK_BANNER_BODY_HEIGHT,
  MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP,
  MAP_HISTORY_FLOATING_CONTROLS_GAP,
  MAP_HISTORY_PANEL_CLOSE_MS,
  MAP_LOCATE_BUTTON_BOTTOM_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_SETTINGS_SIZE,
  MAP_SETTINGS_TOP_GAP,
  MAP_STACK_BUTTON_GAP,
  MAP_STACK_BUTTON_SIZE,
  MAP_USER_ZOOM_DELTA,
  MAX_SAVED_PLACES,
  RECENTER_FRESH_CACHE_MS,
  ROUTE_DIRECTION_ARROW_REF_ZOOM_DELTA,
  VISIT_MAX_ZOOM_DELTA,
} from '@/lib/app-constants';
import {
  animateRecenterToUser,
  centerMapOnUser,
  regionAroundCoordinate,
} from '@/lib/map-location-utils';
import { getTripPlaybackDurationMs } from '@/lib/trip-playback';
import { isVisitOngoing } from '@/lib/trip-format';
import BackgroundGeolocation from 'react-native-background-geolocation';
import {
  isLocationLike,
  isSampleLocation,
} from '@/location/location-persist-pipeline';
import {
  HEARTBEAT_CURRENT_POSITION_REQUEST,
  RECENTER_CURRENT_POSITION_REQUEST,
} from '@/lib/motion-tracking-policy';
import {
  canAddSavedPlace,
  matchSavedPlaceForStay,
  SavedPlaceLimitError,
} from '@/lib/saved-places';
import { getCurrentOpenActivity } from '@/lib/today-history';
import {
  isPlayableTimelineEntry,
  firstNavigableTimelineIndex,
  lastNavigableTimelineIndex,
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
  visitPlaceSelectedCategory,
} from '@/lib/place-lookup-types';
import { mapProviderForPlatform } from '@/lib/map-provider';
import {
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
  MAP_FALLBACK_REGION,
  mapHistoryPanelContentHeight,
  mapStackButtonBottom,
  mapStackTotalHeight,
} from './map-screen-constants';

const EMPTY_MOMENT_ROWS: MomentRow[] = [];

export function useMapScreenController() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Map'>>();
  const tripDetectionConfig = useTripDetectionConfig();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
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
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(-1);
  const [userCoordinate, setUserCoordinate] =
    useState<MapUserCoordinate | null>(null);
  const [mapInitialRegion, setMapInitialRegion] = useState<Region | null>(null);
  const [savePlaceCoordinate, setSavePlaceCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [clusterMomentsOnMap, setClusterMomentsOnMap] = useState(false);
  const [routeDirectionMapLatitudeDelta, setRouteDirectionMapLatitudeDelta] =
    useState(ROUTE_DIRECTION_ARROW_REF_ZOOM_DELTA);
  /** Unthrottled zoom for UI thresholds (saved-place dots, etc.). */
  const [mapUiLatitudeDelta, setMapUiLatitudeDelta] = useState(
    ROUTE_DIRECTION_ARROW_REF_ZOOM_DELTA,
  );
  /** Hide geographic arrows while pinching zoom — they only resize on settle. */
  const [mapGestureActive, setMapGestureActive] = useState(false);
  /**
   * After fitting today's trips overview, hide the red half until the user
   * recenters (blue) — another fit is a no-op while already zoomed out.
   */
  const [todayTripsOverviewActive, setTodayTripsOverviewActive] =
    useState(false);

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
  const routeDirectionMapLatitudeDeltaRef = useRef(
    ROUTE_DIRECTION_ARROW_REF_ZOOM_DELTA,
  );
  const mapUiLatitudeDeltaRef = useRef(ROUTE_DIRECTION_ARROW_REF_ZOOM_DELTA);
  const mapGestureActiveRef = useRef(false);
  /** latitudeDelta at the start of the current drag/pinch (for zoom vs pan). */
  const mapGestureStartDeltaRef = useRef<number | null>(null);
  /**
   * Keep arrow ground-size in sync with camera target. Programmatic
   * animateToRegion often skips onRegionChangeComplete — without this,
   * day/history fits leave a large delta and arrows look giant on Today.
   */
  const commitMapRegion = useCallback((region: Region) => {
    mapRegionRef.current = region;
    if (
      Math.abs(region.latitudeDelta - mapUiLatitudeDeltaRef.current) >= 1e-9
    ) {
      mapUiLatitudeDeltaRef.current = region.latitudeDelta;
      setMapUiLatitudeDelta(region.latitudeDelta);
    }
    const prevDelta = routeDirectionMapLatitudeDeltaRef.current;
    const zoomChanged =
      Math.abs(region.latitudeDelta - prevDelta) / Math.max(prevDelta, 1e-6) >=
      0.04;
    if (!zoomChanged) {
      return;
    }
    routeDirectionMapLatitudeDeltaRef.current = region.latitudeDelta;
    setRouteDirectionMapLatitudeDelta(region.latitudeDelta);
  }, []);
  const fitHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userCoordinateRef = useRef<MapUserCoordinate | null>(null);
  const lastUserCoordinateRefreshMsRef = useRef(0);
  /** Only the latest locate-button press may apply getCurrentPosition results. */
  const recenterRequestIdRef = useRef(0);
  const historyPanelY = useRef(new Animated.Value(400)).current;
  const historyPanelOpenRef = useRef(false);
  const pendingGoToTodayRef = useRef(false);
  /**
   * After a day change: land on the first bar segment (visit, drive, or gap).
   * Missing/gap counts like any other timeline event for day-edge selection.
   */
  const pendingHistoryEdgeSelectRef = useRef<'first' | 'last' | null>(null);
  const bootstrapCoordinateRef = useRef<MapUserCoordinate | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveMapBootstrapRegion().then(region => {
      if (cancelled) {
        return;
      }
      setMapInitialRegion(region);
      mapRegionRef.current = region;
      routeDirectionMapLatitudeDeltaRef.current = region.latitudeDelta;
      setRouteDirectionMapLatitudeDelta(region.latitudeDelta);
      mapUiLatitudeDeltaRef.current = region.latitudeDelta;
      setMapUiLatitudeDelta(region.latitudeDelta);
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
            commitMapRegion(region);
            needsDefaultCenterRef.current = false;
          }
        }
      }
    });
    return () => subscription.remove();
  }, [commitMapRegion, selectedDateKey, syncSelectedDateKeyForTodayRoll]);

  const playback = useTripPlayback();
  // Depend on the stable start/stop refs (not the whole `playback` object) so
  // progress ticks during playback don't recreate every navigation callback.
  const { start: startPlayback, stop: stopPlayback } = playback;
  // Progress updates ~66ms while playing — keep it out of the controller bag so
  // History panel / floating controls don't re-render on every tick.
  const playbackControls = useMemo(
    () => ({
      isPlaying: playback.isPlaying,
      start: playback.start,
      stop: playback.stop,
    }),
    [playback.isPlaying, playback.start, playback.stop],
  );

  const historyHasGpsData =
    historyData.entries.length > 0 || historyData.points.length > 0;
  const historyDayLoaded =
    historyData.dateKey === selectedDateKey &&
    (!historyLoading || viewingToday || historyHasGpsData);
  const historyReadyForDay = historyDayLoaded && historyHasGpsData;
  const historyBlockingLoader =
    historyLoading && !historyDayLoaded && !viewingToday;

  const historyBadgeCount = useMemo(() => {
    if (!historyDayLoaded) {
      return 0;
    }
    return countHistoryTimelineEvents(historyEntries);
  }, [historyDayLoaded, historyEntries]);
  /** Blue/red split locate — only while not already in today's trips overview. */
  const showLocateFitSplit =
    viewingToday && historyBadgeCount > 1 && !todayTripsOverviewActive;

  // Drop overview mode when the split is no longer eligible.
  useEffect(() => {
    if (!viewingToday || historyBadgeCount <= 1) {
      setTodayTripsOverviewActive(false);
    }
  }, [viewingToday, historyBadgeCount]);

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
    // Intentionally omit selectedHistoryIndex — resetting height on every scrub
    // step thrashs mapPadding and makes event-arrow navigation feel laggy.
  }, [selectedDateKey, showPlaceLabelCard, historyEventCardHasMoments]);

  // Wait for History chrome to finish closing so day-story routes do not flash
  // over the still-zoomed-out History camera. (User puck has no accuracy ring.)
  const showDayJourney =
    !historyPanelOpen &&
    !historyPanelChromeVisible &&
    !playback.isPlaying &&
    historyDayLoaded;
  const currentVisitMomentCounts = useMemo((): MomentCounts => {
    if (!currentOpenVisit) {
      return EMPTY_MOMENT_COUNTS;
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
      return EMPTY_MOMENT_ROWS;
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

  const provider = mapProviderForPlatform();

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
  // Moments glass bar is bottom-center. Date text sits just above it.
  // History / search share the glass row; places sits above history; locate
  // sits above search — same column gap as the in-stack spacing.
  const showMomentsBar = viewingToday && !historyPanelOpen;
  const momentsBarBottom = insets.bottom + MAP_LOCATE_BUTTON_BOTTOM_GAP;
  const rowBaseBottom = historyPanelOpen
    ? historyPanelBottom + MAP_HISTORY_FLOATING_CONTROLS_GAP
    : showMomentsBar
      ? momentsBarBottom +
        (MAP_MOMENTS_BAR_HEIGHT - MAP_STACK_BUTTON_SIZE) / 2
      : insets.bottom + MAP_LOCATE_BUTTON_BOTTOM_GAP;

  // Left: history (glass row) → places above. Right: search (in bar) → locate above.
  const historyButtonBottom = rowBaseBottom;
  const placesButtonBottom = mapStackButtonBottom(rowBaseBottom, 1);
  const locateButtonBottom = mapStackButtonBottom(rowBaseBottom, 1);
  const settingsButtonTop = insets.top + MAP_SETTINGS_TOP_GAP;

  const dateNavAnchorBottom = rowBaseBottom;

  const rightStackButtonCount = viewingToday ? 1 : 0;
  const rightStackHeight = mapStackTotalHeight(
    rightStackButtonCount,
    MAP_STACK_BUTTON_SIZE,
    MAP_STACK_BUTTON_GAP,
  );
  const leftStackHeight = mapStackTotalHeight(
    viewingToday ? 2 : 1,
    MAP_STACK_BUTTON_SIZE,
    MAP_STACK_BUTTON_GAP,
  );
  const floatingControlsClearance =
    rowBaseBottom + Math.max(leftStackHeight, rightStackHeight) + 16;

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
        MAP_SETTINGS_SIZE +
        (backgroundWorkBannerVisible ? BACKGROUND_WORK_BANNER_BODY_HEIGHT : 0),
      right: 12,
      bottom: floatingControlsClearance,
      left: 12,
    }),
    [floatingControlsClearance, insets.top, backgroundWorkBannerVisible],
  );

  const scrubOnEvent = historyScrubOnEvent;

  const selectedVisitPlaceDisplay = useVisitPlaceDisplay(
    scrubOnEvent && selectedStay ? selectedStay : null,
    savedPlaces,
  );

  const placeLabelEditDisplay = useVisitPlaceDisplay(
    placeLabelEditStay,
    savedPlaces,
  );
  const {
    cacheId: placeLabelEditCacheId,
    materializedTripId: placeLabelEditMaterializedTripId,
  } = placeLabelEditDisplay;

  const visitPlaceLabelInEventCard = useMemo(() => {
    if (!historyScrubOnEvent || selectedSavedPlace != null) {
      return null;
    }
    if (isVisitPlaceLabelConfirmed(selectedVisitPlaceDisplay)) {
      return selectedVisitPlaceDisplay.primaryLabel;
    }
    return visitPlaceDefaultLabel(selectedVisitPlaceDisplay);
  }, [
    historyScrubOnEvent,
    selectedSavedPlace,
    selectedVisitPlaceDisplay,
  ]);

  const visitPlacePinnedInEventCard =
    historyScrubOnEvent &&
    selectedSavedPlace == null &&
    isVisitPlaceLabelConfirmed(selectedVisitPlaceDisplay);
  const visitPlaceCategoryInEventCard = visitPlacePinnedInEventCard
    ? visitPlaceSelectedCategory(selectedVisitPlaceDisplay)
    : null;
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

  const handleDonePlaceLabel = useCallback(
    (selection: { poiId: number; poiLabel: string } | null) => {
      const stay = placeLabelEditStay;
      if (!stay) {
        return;
      }
      const unchanged =
        selection != null &&
        placeLabelEditDisplay.selectedPoiId != null &&
        selection.poiId === placeLabelEditDisplay.selectedPoiId;
      const done =
        selection != null && !unchanged
          ? selectVisitPlaceCandidate({
              cacheId: placeLabelEditCacheId,
              poiId: selection.poiId,
              poiLabel: selection.poiLabel,
              stay,
              dateKey: selectedDateKey,
              materializedTripId: placeLabelEditMaterializedTripId,
            })
          : Promise.resolve();
      void done.finally(() => {
        setPlaceLabelEditStay(null);
      });
    },
    [
      placeLabelEditCacheId,
      placeLabelEditDisplay.selectedPoiId,
      placeLabelEditMaterializedTripId,
      placeLabelEditStay,
      selectVisitPlaceCandidate,
      selectedDateKey,
    ],
  );

  const handleClosePlaceLabel = useCallback(() => {
    setPlaceLabelEditStay(null);
  }, []);

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

  const dayStoryStops = useDayStoryStops(
    showDayJourney,
    dayStays,
    savedPlaces,
    tripDetectionConfig.dwellRadiusMeters,
  );

  const dayStoryHasHomeStop = useMemo(
    () => dayStoryStops.some(stop => stop.isHome),
    [dayStoryStops],
  );

  const mapSavedPlaces = useMemo((): SavedPlaceRow[] => {
    if (!showSavedPlaceMarkersOnMap) {
      return [];
    }
    // History-closed day browse: story overlay owns Home only when a Home stay exists.
    // Keep the saved-place Home pin on Today until then (and always keep Work/favorites).
    if (showDayJourney) {
      if (!viewingToday) {
        return [];
      }
      return dayStoryHasHomeStop
        ? savedPlaces.filter(place => place.kind !== 'home')
        : savedPlaces;
    }
    // History mode (and any non-today day): only Home. Work/favorites are today-only.
    if (historyPanelOpen || !viewingToday) {
      return savedPlaces.filter(place => place.kind === 'home');
    }
    return savedPlaces;
  }, [
    dayStoryHasHomeStop,
    historyPanelOpen,
    savedPlaces,
    showDayJourney,
    showSavedPlaceMarkersOnMap,
    viewingToday,
  ]);

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

  const dayMomentMapPins = useMemo(() => {
    const individual = partitionMomentMapPins(
      dayMomentMapPinsRaw,
      savedPlaces,
      clusterMomentsOnMap,
    ).individualPins;
    if (dayStoryStops.length === 0) {
      return individual;
    }
    return individual.filter(
      pin =>
        !isCoordinateOnDayStoryStop(
          pin.coordinate,
          dayStoryStops,
          tripDetectionConfig.dwellRadiusMeters,
        ),
    );
  }, [
    dayMomentMapPinsRaw,
    savedPlaces,
    clusterMomentsOnMap,
    dayStoryStops,
    tripDetectionConfig.dwellRadiusMeters,
  ]);

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
      // Day-story callout owns Home moments+numbers while History is closed.
      if (showDayJourney) {
        return [];
      }
      const raw = showHistoryMap ? historyMomentMapPinsRaw : [];
      if (raw.length === 0 || !clusterMomentsOnMap) {
        return [];
      }

      const calloutSavedPlaceId = selectedSavedPlace?.id;
      const calloutMomentCounts = selectedEntryMomentCounts;

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
      dayMoments,
      historyMomentMapPinsRaw,
      openMomentPreview,
      savedPlaces,
      selectedEntryMomentCounts,
      selectedSavedPlace?.id,
      showDayJourney,
      showHistoryMap,
    ]);

  const openDayStoryMomentType = useCallback(
    (stop: DayStoryStop, initialType?: MomentCountType) => {
      const primary = stop.stays[0];
      if (primary == null) {
        return;
      }
      const moments = collectMomentsForDayStoryStop(
        stop,
        dayMoments,
        savedPlaces,
        historyData.points,
        historyEntries,
        tripDetectionConfig.dwellRadiusMeters,
      );
      openMomentPreview({
        moments,
        initialType,
        previewEntry: primary,
      });
    },
    [
      dayMoments,
      historyData.points,
      historyEntries,
      openMomentPreview,
      savedPlaces,
      tripDetectionConfig.dwellRadiusMeters,
    ],
  );

  const openHistoryToStay = useCallback(
    (stay: DetectedTrip) => {
      const index = historyEntries.findIndex(entry => entry.id === stay.id);
      if (index < 0) {
        return;
      }
      stopPlayback();
      setSelectedHistoryIndex(index);
      if (!historyPanelOpen) {
        setHistoryPanelChromeVisible(true);
        historyPanelY.setValue(historyPanelSlideDistanceRef.current);
        setHistoryPanelOpen(true);
      }
    },
    [historyEntries, historyPanelOpen, historyPanelY, stopPlayback],
  );

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

  const onRegionChange = useCallback((region: Region) => {
    if (mapGestureStartDeltaRef.current == null) {
      mapGestureStartDeltaRef.current = routeDirectionMapLatitudeDeltaRef.current;
    }
    const startDelta = mapGestureStartDeltaRef.current;
    const deltaRatio =
      Math.abs(region.latitudeDelta - startDelta) / Math.max(startDelta, 1e-6);
    // Only hide on real pinch zoom — pan must not touch arrow state.
    if (deltaRatio < 0.08 || mapGestureActiveRef.current) {
      return;
    }
    mapGestureActiveRef.current = true;
    setMapGestureActive(true);
  }, []);

  const onRegionChangeComplete = useCallback((region: Region) => {
    mapRegionRef.current = region;
    mapGestureStartDeltaRef.current = null;

    if (
      Math.abs(region.latitudeDelta - mapUiLatitudeDeltaRef.current) >= 1e-9
    ) {
      mapUiLatitudeDeltaRef.current = region.latitudeDelta;
      setMapUiLatitudeDelta(region.latitudeDelta);
    }

    const nextClusterMoments = shouldClusterMomentsOnMap(region.latitudeDelta);
    if (nextClusterMoments !== clusterMomentsOnMapRef.current) {
      clusterMomentsOnMapRef.current = nextClusterMoments;
      setClusterMomentsOnMap(nextClusterMoments);
    }

    const prevDelta = routeDirectionMapLatitudeDeltaRef.current;
    const zoomSettled =
      Math.abs(region.latitudeDelta - prevDelta) / Math.max(prevDelta, 1e-6) >=
      0.04;
    // Pan-only completes must not rebuild arrows (that was the flicker).
    if (zoomSettled) {
      routeDirectionMapLatitudeDeltaRef.current = region.latitudeDelta;
      setRouteDirectionMapLatitudeDelta(region.latitudeDelta);
    }

    if (mapGestureActiveRef.current) {
      mapGestureActiveRef.current = false;
      setMapGestureActive(false);
    }
  }, []);

  const goToCurrentLocation = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    // Leaving trips overview → restore blue/red split when eligible.
    setTodayTripsOverviewActive(false);

    const requestId = ++recenterRequestIdRef.current;

    // Instant feedback only when the cached puck fix is genuinely recent. While
    // driving the cache can lag near home, so a stale fix must not win — we wait
    // for the fresh read below instead of flying to the wrong place first.
    const cached = userCoordinateRef.current;
    const cacheAgeMs = Date.now() - lastUserCoordinateRefreshMsRef.current;
    if (cached && cacheAgeMs <= RECENTER_FRESH_CACHE_MS) {
      animateRecenterToUser(map, cached, mapRegionRef.current);
    }

    // Always request a fresh, high-accuracy fix so recenter lands on the true
    // current location (Google-Maps-style), regardless of puck throttling.
    void (async () => {
      try {
        const current = await BackgroundGeolocation.getCurrentPosition(
          RECENTER_CURRENT_POSITION_REQUEST,
        );
        if (requestId !== recenterRequestIdRef.current) {
          return;
        }
        const latitude = current?.coords?.latitude;
        const longitude = current?.coords?.longitude;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return;
        }
        const fresh = { latitude, longitude };
        // Force-refresh the puck + recenter target, bypassing the throttle so a
        // stale near-home fix can never override this user-requested fix.
        lastUserCoordinateRefreshMsRef.current = Date.now();
        userCoordinateRef.current = fresh;
        setUserCoordinate(fresh);
        if (mapRef.current) {
          animateRecenterToUser(mapRef.current, fresh, mapRegionRef.current);
        }
      } catch {
        if (requestId !== recenterRequestIdRef.current) {
          return;
        }
        // GPS unavailable / timed out — fall back to the last known coordinate.
        const fallback = userCoordinateRef.current;
        if (fallback && mapRef.current) {
          animateRecenterToUser(mapRef.current, fallback, mapRegionRef.current);
        }
      }
    })();
  }, []);

  /** Zoom out to frame all of today's tracked points (past-day overview camera). */
  const fitTodayTrips = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const coordinates = toMapCoordinates(historyData.points);
    if (coordinates.length === 0) {
      return;
    }
    const region = regionForCoordinates(coordinates);
    map.animateToRegion(region, 400);
    commitMapRegion(region);
    // Already zoomed to trips — full blue locate until user recenters.
    setTodayTripsOverviewActive(true);
  }, [commitMapRegion, historyData.points]);

  const applyUserCoordinate = useCallback(
    (coordinate: { latitude: number; longitude: number }) => {
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
      commitMapRegion(region);
    },
    [commitMapRegion],
  );

  // Live puck from BackgroundGeolocation — not MapKit showsUserLocation (that
  // draws the giant blue GPS accuracy halo on History exit / poor indoor fix).
  useEffect(() => {
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    // Register synchronously so no fixes are missed during the initial
    // getCurrentPosition await below. A throw inside this callback propagates
    // back through the native TurboModule invocation and aborts the whole app
    // (SIGABRT via objc_exception_rethrow), so it must never throw. The SDK can
    // emit locations without a `coords` object; guard before destructuring.
    try {
      subscription = BackgroundGeolocation.onLocation(
        location => {
          try {
            if (isSampleLocation(location) || !isLocationLike(location)) {
              return;
            }
            const { latitude, longitude } = location.coords;
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
              return;
            }
            applyUserCoordinate({ latitude, longitude });
          } catch {
            // Never let a bad location payload crash the app.
          }
        },
        () => {
          // onLocation error callback — tracking off / no fix. Ignored here.
        },
      );
    } catch {
      // Native module unavailable in some test / early-boot paths.
    }

    void (async () => {
      try {
        const current = await BackgroundGeolocation.getCurrentPosition(
          HEARTBEAT_CURRENT_POSITION_REQUEST,
        );
        if (
          !cancelled &&
          current?.coords != null &&
          Number.isFinite(current.coords.latitude) &&
          Number.isFinite(current.coords.longitude)
        ) {
          applyUserCoordinate({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          });
        }
      } catch {
        // Tracking may be off or permission pending — bootstrap region covers it.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [applyUserCoordinate]);

  const fitSelectedHistoryNow = useCallback(
    (animated = false) => {
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
      // Scrub jumps instantly; playback keeps a short ease. Sync arrow zoom so
      // chevrons on the selected trip are sized for this trip's camera; the
      // coarse arrowSizeKey keeps sub-threshold deltas from remounting.
      mapRef.current.animateToRegion(region, animated ? 280 : 0);
      commitMapRegion(region);
    },
    [commitMapRegion, historyMapPlan.selected, selectedPlayable],
  );

  const scheduleFitSelectedHistory = useCallback(
    (immediate = false) => {
      if (fitHistoryTimerRef.current != null) {
        clearTimeout(fitHistoryTimerRef.current);
        fitHistoryTimerRef.current = null;
      }
      if (immediate) {
        fitSelectedHistoryNow(true);
        return;
      }
      // Event-arrow scrub: no 280ms debounce — camera follows the selection now.
      fitSelectedHistoryNow(false);
    },
    [fitSelectedHistoryNow],
  );

  const selectHistoryIndex = useCallback(
    (index: number) => {
      setSelectedHistoryIndex(prev => {
        if (prev !== index) {
          stopPlayback();
        }
        return index;
      });
    },
    [stopPlayback],
  );

  const openHistoryDatePicker = useCallback(() => {
    queueHistoryDatePickerOpen({ selectedDateKey });
    navigation.navigate('HistoryDatePicker');
  }, [navigation, selectedDateKey]);

  const handleSelectMapDate = useCallback(
    (dateKey: string) => {
      setSelectedDateKey(clampDateKeyToHistoryBounds(dateKey));
      setSelectedHistoryIndex(-1);
      stopPlayback();
    },
    [stopPlayback],
  );

  const handleHistoryDateKeyChange = useCallback(
    (dateKey: string) => {
      setSelectedDateKey(clampDateKeyToHistoryBounds(dateKey));
      setSelectedHistoryIndex(-1);
      stopPlayback();
    },
    [stopPlayback],
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
      stopPlayback();
      return;
    }
    handleHistoryDateKeyChange(todayKey);
  }, [
    handleHistoryDateKeyChange,
    historyPanelChromeVisible,
    historyPanelOpen,
    stopPlayback,
    todayKey,
  ]);

  const closeHistoryPanel = useCallback(() => {
    setHistoryPanelOpen(false);
    setPlaceLabelEditStay(null);
    stopPlayback();
  }, [stopPlayback]);

  const goToPrevDay = useCallback(() => {
    if (!canGoPrevDay) {
      return;
    }
    const nextKey = shiftDateKey(selectedDateKey, -1);
    pendingHistoryEdgeSelectRef.current = 'first';
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
    pendingHistoryEdgeSelectRef.current = 'first';
    handleHistoryDateKeyChange(shiftDateKey(selectedDateKey, 1));
  }, [canGoNextDay, handleHistoryDateKeyChange, selectedDateKey]);

  const handleToggleHistoryPanel = useCallback(() => {
    setHistoryPanelOpen(open => {
      const next = !open;
      if (next) {
        setHistoryPanelChromeVisible(true);
        historyPanelY.setValue(historyPanelSlideDistanceRef.current);
        pendingHistoryEdgeSelectRef.current = 'first';
        setSelectedHistoryIndex(firstNavigableTimelineIndex(historyEntries));
      } else {
        stopPlayback();
      }
      return next;
    });
  }, [historyEntries, historyPanelY, stopPlayback]);

  const handlePlayHistory = useCallback(() => {
    if (!selectedPlayable || selectedPlayable.kind !== 'travel') {
      return;
    }
    scheduleFitSelectedHistory(true);
    startPlayback(getTripPlaybackDurationMs(selectedPlayable.durationMs));
  }, [startPlayback, scheduleFitSelectedHistory, selectedPlayable]);

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

  const openYou = useCallback(() => {
    navigation.navigate('You');
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
    commitMapRegion(region);
    needsDefaultCenterRef.current = false;
  }, [commitMapRegion]);

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
    commitMapRegion(region);
  }, [commitMapRegion, selectedPlayable]);

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
      // Day/history fits leave a large delta; reset before DayJourney paints
      // so arrows are not sized for the previous zoomed-out camera.
      commitMapRegion(
        regionAroundCoordinate(
          {
            latitude: mapRegionRef.current.latitude,
            longitude: mapRegionRef.current.longitude,
          },
          MAP_USER_ZOOM_DELTA,
          MAP_USER_ZOOM_DELTA,
        ),
      );
    }
  }, [commitMapRegion, historyPanelOpen, viewingToday, selectedDateKey]);

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
      commitMapRegion(region);
      return;
    }

    const coordinates = toMapCoordinates(historyData.points);
    if (coordinates.length === 0) {
      return;
    }
    const region = regionForCoordinates(coordinates);
    mapRef.current.animateToRegion(region, 400);
    commitMapRegion(region);
  }, [
    commitMapRegion,
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
    if (!historyPanelOpen || historyLoading) {
      return;
    }
    if (historyEntries.length === 0) {
      if (selectedHistoryIndex >= 0) {
        setSelectedHistoryIndex(-1);
      }
      return;
    }
    // Day swap can briefly keep yesterday's scrub index against a shorter list.
    if (selectedHistoryIndex >= historyEntries.length) {
      const edge = pendingHistoryEdgeSelectRef.current ?? 'first';
      pendingHistoryEdgeSelectRef.current = null;
      setSelectedHistoryIndex(
        edge === 'last'
          ? lastNavigableTimelineIndex(historyEntries)
          : firstNavigableTimelineIndex(historyEntries),
      );
      return;
    }
    if (selectedHistoryIndex >= 0) {
      return;
    }
    const edge = pendingHistoryEdgeSelectRef.current ?? 'first';
    pendingHistoryEdgeSelectRef.current = null;
    setSelectedHistoryIndex(
      edge === 'last'
        ? lastNavigableTimelineIndex(historyEntries)
        : firstNavigableTimelineIndex(historyEntries),
    );
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

  const controller = useMemo(
    () => ({
      tripDetectionConfig,
      insets,
      colorScheme,
      distanceUnit,
      mapRef,
      mapInitialRegion,
      provider,
      mapPadding,
      locateButtonBottom,
      settingsButtonTop,
      placesButtonBottom,
      historyButtonBottom,
      showMomentsBar,
      momentsBarBottom,
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
      dayStoryStops,
      historyMapPlan,
      historyBadgeCount,
      showLocateFitSplit,
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
      mapSavedPlaces,
      // Hide only while pinch-zooming; History shows chevrons on the selected
      // trip while scrubbing (the coarse arrowSizeKey limits remount flicker).
      showRouteDirectionArrows: !mapGestureActive,
      routeDirectionMapLatitudeDelta,
      mapUiLatitudeDelta,
      onRegionChange,
      onRegionChangeComplete,
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
      visitPlacePinnedInEventCard,
      visitPlaceCategoryInEventCard,
      showPlaceLabelCard,
      placeLabelEditDisplay,
      openVisitPlaceLabelCard,
      openDriveStartLabelCard,
      openDriveEndLabelCard,
      canEditDriveStartLabel,
      canEditDriveEndLabel,
      handleDonePlaceLabel,
      handleClosePlaceLabel,
      currentOpenVisitPlaceDisplay,
      handleSaveCustomVisitPlaceLabel,
      savedPlaces,
      openDayStoryMomentType,
      openHistoryToStay,
      dayMoments,
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
      playback: playbackControls,
      handleMapLongPress,
      closeSavePlaceSheet,
      handleSaveHomePlace,
      handleSaveWorkPlace,
      handleSaveFavoritePlace,
      openSavedPlaces,
      openSettings,
      openYou,
      goToCurrentLocation,
      fitTodayTrips,
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
      locateButtonBottom,
      settingsButtonTop,
      placesButtonBottom,
      historyButtonBottom,
      showMomentsBar,
      momentsBarBottom,
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
      dayStoryStops,
      historyMapPlan,
      historyBadgeCount,
      showLocateFitSplit,
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
      mapSavedPlaces,
      mapGestureActive,
      routeDirectionMapLatitudeDelta,
      mapUiLatitudeDelta,
      onRegionChange,
      onRegionChangeComplete,
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
      visitPlacePinnedInEventCard,
      visitPlaceCategoryInEventCard,
      showPlaceLabelCard,
      placeLabelEditDisplay,
      openVisitPlaceLabelCard,
      openDriveStartLabelCard,
      openDriveEndLabelCard,
      canEditDriveStartLabel,
      canEditDriveEndLabel,
      handleDonePlaceLabel,
      handleClosePlaceLabel,
      currentOpenVisitPlaceDisplay,
      handleSaveCustomVisitPlaceLabel,
      savedPlaces,
      openDayStoryMomentType,
      openHistoryToStay,
      dayMoments,
      hasHome,
      hasWork,
      canSaveHome,
      canSaveWork,
      canSaveFavorite,
      isAtSavedPlaceLimit,
      savedPlaceMomentClusters,
      savePlaceCoordinate,
      userCoordinate,
      playbackControls,
      handleMapLongPress,
      closeSavePlaceSheet,
      handleSaveHomePlace,
      handleSaveWorkPlace,
      handleSaveFavoritePlace,
      openSavedPlaces,
      openSettings,
      openYou,
      goToCurrentLocation,
      fitTodayTrips,
      openHistoryDatePicker,
      handleSelectMapDate,
      handleHistoryDateKeyChange,
      handleToggleHistoryPanel,
      selectHistoryIndex,
      handlePlayHistory,
      handleZoomVisit,
    ],
  );

  return {
    controller,
    /** Isolated from `controller` so progress ticks don't invalidate panel memo. */
    playbackProgress: playback.progress,
  };
}

export type MapScreenController = ReturnType<
  typeof useMapScreenController
>['controller'];
