import {memo} from 'react';
import {StyleSheet} from 'react-native';
import MapView from 'react-native-maps';

import {DriveActivityCallout} from '@/components/map/DriveActivityCallout';
import {DayJourneyOverlay} from '@/components/map/DayJourneyOverlay';
import {HistoryDayMapOverlay} from '@/components/map/HistoryDayMapOverlay';
import {MomentMapOverlay} from '@/components/map/MomentMapOverlay';
import {SavedPlacesMapOverlay} from '@/components/map/SavedPlacesMapOverlay';
import {StayDurationCallout} from '@/components/map/StayDurationCallout';

import {MAP_FALLBACK_REGION} from './map-screen-constants';
import {areMapScreenMapPropsEqual} from './map-screen-map-props';
import type {MapScreenController} from './use-map-screen-controller';

type MapScreenMapProps = {
  controller: MapScreenController;
};

export const MapScreenMap = memo(function MapScreenMap({
  controller,
}: MapScreenMapProps) {
  const {
    mapRef,
    provider,
    mapPadding,
    mapAttributionInsets,
    colorScheme,
    showUserLocation,
    onRegionChangeComplete,
    handleUserLocation,
    showDayJourney,
    dayMomentMapPins,
    historyMomentMapPins,
    openMomentMapPinPreview,
    historyData,
    dayStays,
    dayTravels,
    tripDetectionConfig,
    currentOpenVisit,
    currentOpenDrive,
    currentOpenVisitSavedPlace,
    currentOpenDriveEndpointLabels,
    currentOpenVisitPlaceDisplay,
    currentVisitMomentCounts,
    openCurrentVisitMomentsPreview,
    userCoordinate,
    handleMapLongPress,
    showHistoryMap,
    historyMapPlan,
    selectedSavedPlace,
    selectedVisitPlaceDisplay,
  selectedDriveEndpointLabels,
    selectedEntryMomentCounts,
    openSelectedEntryMomentsPreview,
    playback,
    savedPlaces,
    savedPlaceMomentClusters,
  } = controller;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={provider}
      initialRegion={MAP_FALLBACK_REGION}
      mapPadding={mapPadding}
      legalLabelInsets={mapAttributionInsets.legalLabelInsets}
      appleLogoInsets={mapAttributionInsets.appleLogoInsets}
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
      onUserLocationChange={handleUserLocation}
      onLongPress={handleMapLongPress}>
      <SavedPlacesMapOverlay
        places={savedPlaces}
        momentClusters={savedPlaceMomentClusters}
        hideMarkerPlaceId={
          showHistoryMap
            ? (selectedSavedPlace?.id ??
              selectedDriveEndpointLabels.end.savedPlace?.id ??
              selectedDriveEndpointLabels.start.savedPlace?.id ??
              null)
            : (currentOpenVisitSavedPlace?.id ??
              currentOpenDriveEndpointLabels.start.savedPlace?.id ??
              null)
        }
      />
      {showDayJourney ? (
        <>
          <DayJourneyOverlay
            travels={dayTravels}
            stays={dayStays}
            tripConfig={tripDetectionConfig}
            savedPlaces={savedPlaces}
            fallbackPoints={historyData.points}
          />
          <MomentMapOverlay
            pins={dayMomentMapPins}
            onPressPin={openMomentMapPinPreview}
          />
          {currentOpenVisit ? (
            <StayDurationCallout
              trip={currentOpenVisit}
              savedPlace={currentOpenVisitSavedPlace}
              nearbyPlaceLabel={
                currentOpenVisitSavedPlace
                  ? null
                  : currentOpenVisitPlaceDisplay.primaryLabel
              }
              nearbyPlacePinned={
                !currentOpenVisitSavedPlace &&
                (currentOpenVisitPlaceDisplay.isAreaDefault ||
                  currentOpenVisitPlaceDisplay.isTripLabel)
              }
              showVisitPin={false}
              anchorCoordinate={userCoordinate}
              momentCounts={currentVisitMomentCounts}
              onPressMomentType={openCurrentVisitMomentsPreview}
            />
          ) : currentOpenDrive ? (
            <DriveActivityCallout
              trip={currentOpenDrive}
              startLabel={currentOpenDriveEndpointLabels.start}
              endLabel={currentOpenDriveEndpointLabels.end}
              anchorCoordinate={userCoordinate}
            />
          ) : null}
        </>
      ) : null}
      {showHistoryMap ? (
        <>
          <HistoryDayMapOverlay
            plan={historyMapPlan}
            savedPlaces={savedPlaces}
            selectedSavedPlace={selectedSavedPlace}
            selectedNearbyPlaceLabel={
              selectedSavedPlace ? null : selectedVisitPlaceDisplay.primaryLabel
            }
            selectedNearbyPlacePinned={
              !selectedSavedPlace &&
              (selectedVisitPlaceDisplay.isAreaDefault ||
                selectedVisitPlaceDisplay.isTripLabel)
            }
            selectedDriveStartLabel={selectedDriveEndpointLabels.start}
            selectedDriveEndLabel={selectedDriveEndpointLabels.end}
            selectedEntryMomentCounts={selectedEntryMomentCounts}
            onPressSelectedEntryMoments={openSelectedEntryMomentsPreview}
            tripConfig={tripDetectionConfig}
            playbackProgress={playback.isPlaying ? playback.progress : null}
          />
          <MomentMapOverlay
            pins={historyMomentMapPins}
            onPressPin={openMomentMapPinPreview}
          />
        </>
      ) : null}
    </MapView>
  );
}, (previous, next) =>
  areMapScreenMapPropsEqual(previous.controller, next.controller),
);
