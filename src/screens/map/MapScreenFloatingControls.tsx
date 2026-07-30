import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MapHealthMetricChip,
  MAP_HEALTH_CHIP_HEIGHT,
  mapHealthChipBottom,
} from '@/components/map/MapHealthMetricChip';
import { MapHistoryButton } from '@/components/map/MapHistoryButton';
import { MapLocateButton } from '@/components/map/MapLocateButton';
import { MapMomentsGlassBar } from '@/components/map/MapMomentsGlassBar';
import { MapSettingsButton } from '@/components/map/MapSettingsButton';
import { MapPlacesButton } from '@/components/map/MapPlacesButton';
import { useDayHealthChips } from '@/hooks/use-day-health-chips';
import {
  MAP_SETTINGS_SIZE,
  MAP_SETTINGS_STACK_GAP,
  MAP_STACK_BUTTON_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';

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
      openCaptureMood,
      openCaptureActivity,
      handleCaptureNote,
      openSettings,
      openYou,
      historyBadgeCount,
      showLocateFitSplit,
      trackingGapWarning,
      emptySelectedDayMessage,
      selectedDateKey,
    } = controller;

    const health = useDayHealthChips(selectedDateKey);
    const historyPanelActive = historyPanelOpen;
    const showTodayControls = viewingToday && !historyPanelActive;
    const showHistoryButton = !historyPanelActive;
    const showSettingsButton = !historyPanelActive;

    const showStepsChip =
      showHistoryButton && health.masterOn && health.stepsEnabled;
    const showSleepChip =
      showHistoryButton && health.masterOn && health.sleepEnabled;
    const healthMetricsActive =
      health.masterOn && (health.sleepEnabled || health.stepsEnabled);
    const placesUnderSettings = healthMetricsActive;

    const stepsChipBottom = showStepsChip
      ? mapHealthChipBottom(historyButtonBottom, 0)
      : null;
    const sleepChipBottom = showSleepChip
      ? mapHealthChipBottom(
          historyButtonBottom,
          showStepsChip ? 1 : 0,
        )
      : null;

    const placesTop = placesUnderSettings
      ? settingsButtonTop + MAP_SETTINGS_SIZE + MAP_SETTINGS_STACK_GAP
      : null;

    const leftStackAboveHistory =
      (showStepsChip ? 1 : 0) + (showSleepChip ? 1 : 0);
    const leftStackTop =
      historyButtonBottom +
      MAP_STACK_BUTTON_SIZE +
      (leftStackAboveHistory > 0
        ? MAP_STACK_BUTTON_GAP +
          leftStackAboveHistory * MAP_HEALTH_CHIP_HEIGHT +
          (leftStackAboveHistory - 1) * MAP_STACK_BUTTON_GAP
        : 0) +
      (!placesUnderSettings && showTodayControls
        ? MAP_STACK_BUTTON_GAP + MAP_STACK_BUTTON_SIZE
        : 0);

    const messageAnchorBottom = Math.max(
      leftStackTop + 20,
      viewingToday ? placesButtonBottom + 64 : historyButtonBottom + 64,
    );

    return (
      <View pointerEvents="box-none" style={styles.overlay}>
        {showSettingsButton ? (
          <MapSettingsButton top={settingsButtonTop} onPress={openSettings} />
        ) : null}

        {showTodayControls && placesUnderSettings && placesTop != null ? (
          <MapPlacesButton
            placement="right"
            top={placesTop}
            onPress={openSavedPlaces}
          />
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
        {showStepsChip && stepsChipBottom != null ? (
          <MapHealthMetricChip
            kind="steps"
            bottom={stepsChipBottom}
            value={health.steps}
          />
        ) : null}
        {showSleepChip && sleepChipBottom != null ? (
          <MapHealthMetricChip
            kind="sleep"
            bottom={sleepChipBottom}
            value={health.sleepMs}
          />
        ) : null}
        {showTodayControls && !placesUnderSettings ? (
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
            onMood={openCaptureMood}
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
