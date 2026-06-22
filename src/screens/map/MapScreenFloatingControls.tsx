import {StyleSheet, Text, View} from 'react-native';

import {MapCalendarButton} from '@/components/map/MapCalendarButton';
import {MapCameraButton} from '@/components/map/MapCameraButton';
import {MapHistoryButton} from '@/components/map/MapHistoryButton';
import {MapLocateButton} from '@/components/map/MapLocateButton';
import {MapNoteButton} from '@/components/map/MapNoteButton';
import {MapPlacesButton} from '@/components/map/MapPlacesButton';
import {MapActivityButton} from '@/components/map/MapActivityButton';
import {MapVoiceButton} from '@/components/map/MapVoiceButton';

import type {MapScreenController} from './use-map-screen-controller';

type MapScreenFloatingControlsProps = {
  controller: MapScreenController;
};

export function MapScreenFloatingControls({
  controller,
}: MapScreenFloatingControlsProps) {
  const {
    historyPanelOpen,
    locateButtonBottom,
    placesButtonBottom,
    calendarButtonBottom,
    historyButtonBottom,
    cameraButtonBottom,
    voiceButtonBottom,
    noteButtonBottom,
    activityButtonBottom,
    goToCurrentLocation,
    openSavedPlaces,
    openHistoryDatePicker,
    handleToggleHistoryPanel,
    handleCaptureCamera,
    openCaptureVoice,
    openCaptureActivity,
    handleCaptureNote,
    historyBadgeCount,
    trackingGapWarning,
    emptySelectedDayMessage,
    viewingToday,
  } = controller;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <MapLocateButton bottom={locateButtonBottom} onPress={goToCurrentLocation} />
      <MapHistoryButton
        bottom={historyButtonBottom}
        active={historyPanelOpen}
        eventCount={historyBadgeCount}
        onPress={handleToggleHistoryPanel}
      />
      <MapCalendarButton
        bottom={calendarButtonBottom}
        highlighted={!viewingToday}
        onPress={openHistoryDatePicker}
      />
      <MapPlacesButton bottom={placesButtonBottom} onPress={openSavedPlaces} />

      <MapCameraButton bottom={cameraButtonBottom} onPress={handleCaptureCamera} />
      <MapVoiceButton bottom={voiceButtonBottom} onPress={openCaptureVoice} />
      <MapNoteButton bottom={noteButtonBottom} onPress={handleCaptureNote} />
      <MapActivityButton bottom={activityButtonBottom} onPress={openCaptureActivity} />

      {emptySelectedDayMessage && !historyPanelOpen ? (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: placesButtonBottom + 64,
            backgroundColor: '#111827',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}>
          <Text style={{color: '#FFFFFF', fontSize: 13, textAlign: 'center'}}>
            {emptySelectedDayMessage}
          </Text>
        </View>
      ) : null}

      {trackingGapWarning && !historyPanelOpen && !emptySelectedDayMessage ? (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: placesButtonBottom + 64,
            backgroundColor: '#111827',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}>
          <Text style={{color: '#FFFFFF', fontSize: 13}}>
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
