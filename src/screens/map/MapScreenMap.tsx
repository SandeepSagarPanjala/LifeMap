import { memo, useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView from 'react-native-maps';

import { DriveActivityCallout } from '@/components/map/DriveActivityCallout';
import { DayJourneyOverlay } from '@/components/map/DayJourneyOverlay';
import { HistoryDayMapOverlay } from '@/components/map/HistoryDayMapOverlay';
import { MomentMapOverlay } from '@/components/map/MomentMapOverlay';
import { SavedPlacesMapOverlay } from '@/components/map/SavedPlacesMapOverlay';
import { StayDurationCallout } from '@/components/map/StayDurationCallout';
import { UserLocationPuck } from '@/components/map/UserLocationPuck';
import { isVisitPlaceLabelConfirmed, visitPlaceSelectedCategory } from '@/lib/place-lookup-types';

import { areMapScreenMapPropsEqual } from './map-screen-map-props';
import type { MapScreenController } from './use-map-screen-controller';

/** Approximate MapKit Maps logo + Legal widths for bottom-center placement. */
const APPLE_LOGO_WIDTH = 52;
const APPLE_LEGAL_WIDTH = 40;
const APPLE_ATTRIBUTION_GAP = 8;
const APPLE_ATTRIBUTION_CLUSTER =
  APPLE_LOGO_WIDTH + APPLE_ATTRIBUTION_GAP + APPLE_LEGAL_WIDTH;


type MapScreenMapProps = {
  controller: MapScreenController;
  /** Kept outside controller so History UI isn't invalidated every ~66ms. */
  playbackProgress: number | null;
};

export const MapScreenMap = memo(
  function MapScreenMap({
    controller,
    playbackProgress,
  }: MapScreenMapProps) {
    const { width: windowWidth } = useWindowDimensions();
    // Native props move logo/Legal by frame — no camera bias (unlike mapPadding).
    // Note: AIRMap ignores 0 insets, so left must be >= 1.
    const appleAttributionInsets = useMemo(() => {
      if (Platform.OS !== 'ios') {
        return null;
      }
      const clusterLeft = Math.max(
        1,
        Math.round((windowWidth - APPLE_ATTRIBUTION_CLUSTER) / 2),
      );
      return {
        appleLogoInsets: { top: 0, right: 0, bottom: 0, left: clusterLeft },
        legalLabelInsets: {
          top: 0,
          right: 0,
          bottom: 0,
          left: clusterLeft + APPLE_LOGO_WIDTH + APPLE_ATTRIBUTION_GAP,
        },
      };
    }, [windowWidth]);

    const {
      mapRef,
      mapInitialRegion,
      provider,
      colorScheme,
      showUserLocation,
      onRegionChange,
      onRegionChangeComplete,
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
      showRouteDirectionArrows,
      routeDirectionMapLatitudeDelta,
      mapUiLatitudeDelta,
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
        appleLogoInsets={appleAttributionInsets?.appleLogoInsets}
        legalLabelInsets={appleAttributionInsets?.legalLabelInsets}
        // Custom UserLocationPuck only — MapKit's showsUserLocation draws a
        // giant GPS accuracy halo (the blue flash on History exit).
        showsUserLocation={false}
        showsMyLocationButton={false}
        userInterfaceStyle={colorScheme === 'dark' ? 'dark' : 'light'}
        followsUserLocation={false}
        scrollEnabled
        zoomEnabled
        pitchEnabled
        rotateEnabled
        onRegionChange={onRegionChange}
        onRegionChangeComplete={onRegionChangeComplete}
        onLongPress={handleMapLongPress}
      >
        {showUserLocation && userCoordinate != null ? (
          <UserLocationPuck coordinate={userCoordinate} />
        ) : null}
        <SavedPlacesMapOverlay
          places={mapSavedPlaces}
          momentClusters={savedPlaceMomentClusters}
          mapLatitudeDelta={mapUiLatitudeDelta}
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
              showDirectionArrows={showRouteDirectionArrows}
              mapLatitudeDelta={routeDirectionMapLatitudeDelta}
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
              playbackProgress={
                playback.isPlaying ? playbackProgress : null
              }
              showDirectionArrows={showRouteDirectionArrows}
              mapLatitudeDelta={routeDirectionMapLatitudeDelta}
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
    previous.playbackProgress === next.playbackProgress &&
    areMapScreenMapPropsEqual(previous.controller, next.controller),
);
