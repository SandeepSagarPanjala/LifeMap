import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';

import { DriveActivityCallout } from '@/components/map/DriveActivityCallout';
import { DayJourneyOverlay } from '@/components/map/DayJourneyOverlay';
import { HistoryDayMapOverlay } from '@/components/map/HistoryDayMapOverlay';
import { MomentMapOverlay } from '@/components/map/MomentMapOverlay';
import { SavedPlacesMapOverlay } from '@/components/map/SavedPlacesMapOverlay';
import { StayDurationCallout } from '@/components/map/StayDurationCallout';
import { isVisitPlaceLabelConfirmed, visitPlaceSelectedCategory } from '@/lib/place-lookup-types';

import { areMapScreenMapPropsEqual } from './map-screen-map-props';
import type { MapScreenController } from './use-map-screen-controller';

type MapScreenMapProps = {
  controller: MapScreenController;
};

export const MapScreenMap = memo(
  function MapScreenMap({ controller }: MapScreenMapProps) {
    const {
      mapRef,
      mapInitialRegion,
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
      dayTravels,
      dayStoryStops,
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
      mapSavedPlaces,
      savedPlaceMomentClusters,
      openDayStoryMomentType,
      openHistoryToStay,
      dayMoments,
    } = controller;

    if (mapInitialRegion == null) {
      return <View style={StyleSheet.absoluteFill} className="bg-background" />;
    }

    return (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={provider}
        initialRegion={mapInitialRegion}
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
        onLongPress={handleMapLongPress}
      >
        <SavedPlacesMapOverlay
          places={mapSavedPlaces}
          momentClusters={savedPlaceMomentClusters}
          hideMarkerPlaceId={
            showHistoryMap
              ? selectedSavedPlace?.id ??
                selectedDriveEndpointLabels.end.savedPlace?.id ??
                selectedDriveEndpointLabels.start.savedPlace?.id ??
                null
              : currentOpenVisitSavedPlace?.id ??
                currentOpenDriveEndpointLabels.start.savedPlace?.id ??
                null
          }
        />
        {showDayJourney ? (
          <>
            <DayJourneyOverlay
              travels={dayTravels}
              stops={dayStoryStops}
              tripConfig={tripDetectionConfig}
              savedPlaces={savedPlaces}
              fallbackPoints={historyData.points}
              dayMoments={dayMoments}
              historyEntries={historyData.entries}
              hideSavedPlaceId={currentOpenVisitSavedPlace?.id ?? null}
              onPressStoryMomentType={openDayStoryMomentType}
              onPressStoryStay={openHistoryToStay}
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
                  isVisitPlaceLabelConfirmed(currentOpenVisitPlaceDisplay)
                }
                nearbyPlaceCategory={
                  currentOpenVisitSavedPlace
                    ? null
                    : visitPlaceSelectedCategory(currentOpenVisitPlaceDisplay)
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
                selectedSavedPlace
                  ? null
                  : selectedVisitPlaceDisplay.primaryLabel
              }
              selectedNearbyPlacePinned={
                !selectedSavedPlace &&
                isVisitPlaceLabelConfirmed(selectedVisitPlaceDisplay)
              }
              selectedNearbyPlaceCategory={
                selectedSavedPlace
                  ? null
                  : visitPlaceSelectedCategory(selectedVisitPlaceDisplay)
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
  },
  (previous, next) =>
    areMapScreenMapPropsEqual(previous.controller, next.controller),
);
