import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MapHistoryButton } from '@/components/map/MapHistoryButton';
import { MapLocateButton } from '@/components/map/MapLocateButton';
import { MapMomentsGlassBar } from '@/components/map/MapMomentsGlassBar';
import { MapSettingsButton } from '@/components/map/MapSettingsButton';
import { MapPlacesButton } from '@/components/map/MapPlacesButton';

import type { MapScreenController } from './use-map-screen-controller';

type MapScreenFloatingControlsProps = {
  controller: MapScreenController;
};

export const MapScreenFloatingControls = memo(
  function MapScreenFloatingControls({
    controller,
  }: MapScreenFloatingControlsProps) {
    const {
      viewingToday,
      historyPanelOpen,
      locateButtonBottom,
      settingsButtonTop,
      placesButtonBottom,
      historyButtonBottom,
      showMomentsBar,
      momentsBarBottom,
      mapDateLabel,
      canGoPrevDay,
      goToPrevDay,
      openHistoryDatePicker,
      goToCurrentLocation,
      fitTodayTrips,
      openSavedPlaces,
      handleToggleHistoryPanel,
      handleCaptureCamera,
      openCaptureVoice,
      openCaptureActivity,
      handleCaptureNote,
      openSettings,
      openYou,
      historyBadgeCount,
      showLocateFitSplit,
      trackingGapWarning,
      emptySelectedDayMessage,
    } = controller;

    const historyPanelActive = historyPanelOpen;
    const showTodayControls = viewingToday && !historyPanelActive;
    const showHistoryButton = !historyPanelActive;
    const showSettingsButton = !historyPanelActive;
    const messageAnchorBottom = viewingToday
      ? placesButtonBottom + 64
      : historyButtonBottom + 64;

    return (
      <View pointerEvents="box-none" style={styles.overlay}>
        {showSettingsButton ? (
          <MapSettingsButton top={settingsButtonTop} onPress={openSettings} />
        ) : null}

        {showTodayControls ? (
          <MapLocateButton
            bottom={locateButtonBottom}
            split={showLocateFitSplit}
            onPressLocate={goToCurrentLocation}
            onPressFitTrips={fitTodayTrips}
          />
        ) : null}
        {showHistoryButton ? (
          <MapHistoryButton
            bottom={historyButtonBottom}
            active={historyPanelOpen}
            showDot={historyBadgeCount > 0}
            onPress={handleToggleHistoryPanel}
          />
        ) : null}
        {showTodayControls ? (
          <MapPlacesButton
            bottom={placesButtonBottom}
            onPress={openSavedPlaces}
          />
        ) : null}

        {showMomentsBar ? (
          <MapMomentsGlassBar
            bottom={momentsBarBottom}
            dateLabel={mapDateLabel}
            canGoPrev={canGoPrevDay}
            onPrevDay={goToPrevDay}
            onPressDate={openHistoryDatePicker}
            onCamera={handleCaptureCamera}
            onVoice={openCaptureVoice}
            onNote={handleCaptureNote}
            onActivity={openCaptureActivity}
            onYou={openYou}
          />
        ) : null}

        {emptySelectedDayMessage && !historyPanelActive ? (
          <View style={[styles.messageBanner, { bottom: messageAnchorBottom }]}>
            <Text style={styles.messageTextCentered}>
              {emptySelectedDayMessage}
            </Text>
          </View>
        ) : null}

        {trackingGapWarning &&
        showTodayControls &&
        !historyPanelActive &&
        !emptySelectedDayMessage ? (
          <View style={[styles.messageBanner, { bottom: messageAnchorBottom }]}>
            <Text style={styles.messageText}>
              {trackingGapWarning}. Tracking may have paused.
            </Text>
          </View>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  messageBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  messageTextCentered: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
  },
});
