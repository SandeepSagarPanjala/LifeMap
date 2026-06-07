import {StyleSheet} from 'react-native';
import MapView from 'react-native-maps';

import {DayJourneyOverlay} from '@/components/map/DayJourneyOverlay';
import {HistoryDayMapOverlay} from '@/components/map/HistoryDayMapOverlay';
import {StayDurationCallout} from '@/components/map/StayDurationCallout';

import {MAP_FALLBACK_REGION} from './map-screen-constants';
import type {MapScreenController} from './use-map-screen-controller';

type MapScreenMapProps = {
  controller: MapScreenController;
};

export function MapScreenMap({controller}: MapScreenMapProps) {
  const {
    mapRef,
    provider,
    mapPadding,
    legalLabelInsets,
    colorScheme,
    showUserLocation,
    onRegionChangeComplete,
    handleUserLocation,
    showDayJourney,
    historyData,
    dayStays,
    tripDetectionConfig,
    currentOpenVisit,
    userCoordinate,
    showHistoryMap,
    historyMapPlan,
    playback,
  } = controller;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={provider}
      initialRegion={MAP_FALLBACK_REGION}
      mapPadding={mapPadding}
      legalLabelInsets={legalLabelInsets}
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
      onUserLocationChange={handleUserLocation}>
      {showDayJourney ? (
        <>
          <DayJourneyOverlay
            points={historyData.points}
            stays={dayStays}
            tripConfig={tripDetectionConfig}
          />
          {currentOpenVisit ? (
            <StayDurationCallout
              trip={currentOpenVisit}
              showVisitPin={false}
              anchorCoordinate={userCoordinate}
            />
          ) : null}
        </>
      ) : null}
      {showHistoryMap ? (
        <HistoryDayMapOverlay
          plan={historyMapPlan}
          tripConfig={tripDetectionConfig}
          playbackProgress={playback.isPlaying ? playback.progress : null}
        />
      ) : null}
    </MapView>
  );
}
