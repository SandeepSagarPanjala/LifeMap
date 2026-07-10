import { StyleSheet, Text, View } from 'react-native';

import { MapCameraButton } from '@/components/map/MapCameraButton';
import { MapHistoryButton } from '@/components/map/MapHistoryButton';
import { MapLocateButton } from '@/components/map/MapLocateButton';
import { MapNoteButton } from '@/components/map/MapNoteButton';
import { MapSettingsButton } from '@/components/map/MapSettingsButton';
import { MapPlacesButton } from '@/components/map/MapPlacesButton';
import { MapActivityButton } from '@/components/map/MapActivityButton';
import { MapVoiceButton } from '@/components/map/MapVoiceButton';

import type { MapScreenController } from './use-map-screen-controller';

type MapScreenFloatingControlsProps = {
  controller: MapScreenController;
};

export function MapScreenFloatingControls({
  controller,
}: MapScreenFloatingControlsProps) {
  const {
    viewingToday,
    historyPanelOpen,
    locateButtonBottom,
    settingsButtonBottom,
    placesButtonBottom,
    historyButtonBottom,
    cameraButtonBottom,
    voiceButtonBottom,
    noteButtonBottom,
    activityButtonBottom,
    goToCurrentLocation,
    openSavedPlaces,
    handleToggleHistoryPanel,
    handleCaptureCamera,
    openCaptureVoice,
    openCaptureActivity,
    handleCaptureNote,
    openSettings,
    historyBadgeCount,
    trackingGapWarning,
    emptySelectedDayMessage,
  } = controller;

  const historyPanelActive = historyPanelOpen;
  const showTodayControls = viewingToday && !historyPanelActive;
  const showHistoryButton = !historyPanelActive;
  const messageAnchorBottom = viewingToday
    ? settingsButtonBottom + 64
    : historyButtonBottom + 64;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {showTodayControls ? (
        <MapLocateButton
          bottom={locateButtonBottom}
          onPress={goToCurrentLocation}
        />
      ) : null}
      {showHistoryButton ? (
        <MapHistoryButton
          bottom={historyButtonBottom}
          active={historyPanelOpen}
          eventCount={historyBadgeCount}
          onPress={handleToggleHistoryPanel}
        />
      ) : null}
      {showHistoryButton ? (
        <MapSettingsButton bottom={settingsButtonBottom} onPress={openSettings} />
      ) : null}
      {showTodayControls ? (
        <MapPlacesButton
          bottom={placesButtonBottom}
          onPress={openSavedPlaces}
        />
      ) : null}

      {showTodayControls ? (
        <>
          <MapCameraButton
            bottom={cameraButtonBottom}
            onPress={handleCaptureCamera}
          />
          <MapVoiceButton
            bottom={voiceButtonBottom}
            onPress={openCaptureVoice}
          />
          <MapNoteButton
            bottom={noteButtonBottom}
            onPress={handleCaptureNote}
          />
          <MapActivityButton
            bottom={activityButtonBottom}
            onPress={openCaptureActivity}
          />
        </>
      ) : null}

      {emptySelectedDayMessage && !historyPanelActive ? (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: messageAnchorBottom,
            backgroundColor: '#111827',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13, textAlign: 'center' }}>
            {emptySelectedDayMessage}
          </Text>
        </View>
      ) : null}

      {trackingGapWarning &&
      showTodayControls &&
      !historyPanelActive &&
      !emptySelectedDayMessage ? (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: messageAnchorBottom,
            backgroundColor: '#111827',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13 }}>
            {trackingGapWarning}. Tracking may have paused.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
