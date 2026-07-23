import type { Region } from 'react-native-maps';

import type { MapUserCoordinate } from '@/lib/user-coordinate-throttle';

import type { MapScreenController } from './use-map-screen-controller';

function regionsEqual(previous: Region | null, next: Region | null): boolean {
  if (previous === next) {
    return true;
  }
  if (previous == null || next == null) {
    return previous === next;
  }
  return (
    previous.latitude === next.latitude &&
    previous.longitude === next.longitude &&
    previous.latitudeDelta === next.latitudeDelta &&
    previous.longitudeDelta === next.longitudeDelta
  );
}

function coordinatesEqual(
  previous: MapUserCoordinate | null,
  next: MapUserCoordinate | null,
): boolean {
  if (previous === next) {
    return true;
  }
  if (previous == null || next == null) {
    return previous === next;
  }
  return (
    previous.latitude === next.latitude && previous.longitude === next.longitude
  );
}

function playbackControlsEqual(
  previous: MapScreenController['playback'],
  next: MapScreenController['playback'],
): boolean {
  return (
    previous.isPlaying === next.isPlaying &&
    previous.start === next.start &&
    previous.stop === next.stop
  );
}

/** Fields read by MapScreenMap — preview open/close must not invalidate these. */
export function areMapScreenMapPropsEqual(
  previous: MapScreenController,
  next: MapScreenController,
): boolean {
  return (
    previous.mapRef === next.mapRef &&
    regionsEqual(previous.mapInitialRegion, next.mapInitialRegion) &&
    previous.provider === next.provider &&
    previous.mapPadding === next.mapPadding &&
    previous.mapAttributionInsets === next.mapAttributionInsets &&
    previous.colorScheme === next.colorScheme &&
    previous.showUserLocation === next.showUserLocation &&
    previous.onRegionChange === next.onRegionChange &&
    previous.onRegionChangeComplete === next.onRegionChangeComplete &&
    previous.showDayJourney === next.showDayJourney &&
    previous.showRouteDirectionArrows === next.showRouteDirectionArrows &&
    previous.routeDirectionMapLatitudeDelta ===
      next.routeDirectionMapLatitudeDelta &&
    previous.mapUiLatitudeDelta === next.mapUiLatitudeDelta &&
    previous.mapSavedPlaces === next.mapSavedPlaces &&
    previous.dayMomentMapPins === next.dayMomentMapPins &&
    previous.historyMomentMapPins === next.historyMomentMapPins &&
    previous.openMomentMapPinPreview === next.openMomentMapPinPreview &&
    previous.openDayStoryMomentType === next.openDayStoryMomentType &&
    previous.openHistoryToStay === next.openHistoryToStay &&
    previous.dayMoments === next.dayMoments &&
    previous.historyData === next.historyData &&
    previous.dayTravels === next.dayTravels &&
    previous.dayStoryStops === next.dayStoryStops &&
    previous.tripDetectionConfig === next.tripDetectionConfig &&
    previous.currentOpenVisit === next.currentOpenVisit &&
    previous.currentOpenDrive === next.currentOpenDrive &&
    previous.currentOpenVisitSavedPlace === next.currentOpenVisitSavedPlace &&
    previous.currentOpenDriveEndpointLabels ===
      next.currentOpenDriveEndpointLabels &&
    previous.currentOpenVisitPlaceDisplay ===
      next.currentOpenVisitPlaceDisplay &&
    previous.currentVisitMomentCounts === next.currentVisitMomentCounts &&
    previous.openCurrentVisitMomentsPreview ===
      next.openCurrentVisitMomentsPreview &&
    coordinatesEqual(previous.userCoordinate, next.userCoordinate) &&
    previous.handleMapLongPress === next.handleMapLongPress &&
    previous.showHistoryMap === next.showHistoryMap &&
    previous.historyMapPlan === next.historyMapPlan &&
    previous.selectedSavedPlace === next.selectedSavedPlace &&
    previous.selectedVisitPlaceDisplay === next.selectedVisitPlaceDisplay &&
    previous.selectedDriveEndpointLabels === next.selectedDriveEndpointLabels &&
    previous.selectedEntryMomentCounts === next.selectedEntryMomentCounts &&
    previous.openSelectedEntryMomentsPreview ===
      next.openSelectedEntryMomentsPreview &&
    playbackControlsEqual(previous.playback, next.playback) &&
    previous.savedPlaces === next.savedPlaces &&
    previous.savedPlaceMomentClusters === next.savedPlaceMomentClusters
  );
}
