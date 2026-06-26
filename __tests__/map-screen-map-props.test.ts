import type {MapScreenController} from '@/screens/map/use-map-screen-controller';
import {areMapScreenMapPropsEqual} from '@/screens/map/map-screen-map-props';

describe('areMapScreenMapPropsEqual', () => {
  const mapSlice = {
    mapRef: {current: null},
    mapInitialRegion: {
      latitude: 33.2,
      longitude: -97.1,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    },
    provider: 'default',
    mapPadding: {top: 0, right: 0, bottom: 0, left: 0},
    mapAttributionInsets: {
      legalLabelInsets: {top: 0, right: 0, bottom: 0, left: 0},
      appleLogoInsets: {top: 0, right: 0, bottom: 0, left: 0},
    },
    colorScheme: 'light',
    showUserLocation: true,
    onRegionChangeComplete: () => {},
    handleUserLocation: () => {},
    showDayJourney: true,
    dayMomentMapPins: [],
    historyMomentMapPins: [],
    openMomentMapPinPreview: () => {},
    historyData: {dateKey: '2026-06-22', points: [], entries: [], range: {}},
    dayStays: [],
    dayTravels: [],
    tripDetectionConfig: {},
    currentOpenVisit: null,
    currentOpenDrive: null,
    currentOpenVisitSavedPlace: null,
    currentOpenDriveEndpointLabels: {start: {}, end: {}},
    currentOpenVisitPlaceDisplay: {primaryLabel: ''},
    currentVisitMomentCounts: {photo: 3, video: 0, voice: 1, note: 0, activity: 0},
    openCurrentVisitMomentsPreview: () => {},
    userCoordinate: null,
    handleMapLongPress: () => {},
    showHistoryMap: false,
    historyMapPlan: {selected: null},
    selectedSavedPlace: null,
    selectedVisitPlaceDisplay: {primaryLabel: ''},
    selectedDriveEndpointLabels: {start: {}, end: {}},
    selectedEntryMomentCounts: undefined,
    openSelectedEntryMomentsPreview: () => {},
    playback: {isPlaying: false, progress: 0},
    savedPlaces: [],
    savedPlaceMomentClusters: [],
  } as unknown as MapScreenController;

  it('ignores moments preview state changes', () => {
    const before = {
      ...mapSlice,
      momentsPreviewOpen: false,
      momentsPreviewMoments: [],
    } as unknown as MapScreenController;
    const after = {
      ...mapSlice,
      momentsPreviewOpen: true,
      momentsPreviewMoments: [{id: 1}],
      momentsPreviewTitle: 'Home moments',
    } as unknown as MapScreenController;

    expect(areMapScreenMapPropsEqual(before, after)).toBe(true);
  });

  it('detects map pin changes', () => {
    const before = mapSlice as unknown as MapScreenController;
    const after = {
      ...mapSlice,
      dayMomentMapPins: [{moment: {id: 2}, coordinate: {latitude: 1, longitude: 2}}],
    } as unknown as MapScreenController;

    expect(areMapScreenMapPropsEqual(before, after)).toBe(false);
  });

  it('ignores playback wrapper object identity when values are unchanged', () => {
    const playback = {
      isPlaying: false,
      progress: null,
      start: () => {},
      stop: () => {},
    };
    const before = {
      ...mapSlice,
      playback,
    } as unknown as MapScreenController;
    const after = {
      ...mapSlice,
      playback: {...playback},
    } as unknown as MapScreenController;

    expect(areMapScreenMapPropsEqual(before, after)).toBe(true);
  });
});
