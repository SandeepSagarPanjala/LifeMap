import {Text, View} from 'react-native';

import {MapCalendarButton} from '@/components/map/MapCalendarButton';
import {MapHistoryButton} from '@/components/map/MapHistoryButton';
import {MapLocateButton} from '@/components/map/MapLocateButton';

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
    calendarButtonBottom,
    historyButtonBottom,
    goToCurrentLocation,
    openHistoryDatePicker,
    handleToggleHistoryPanel,
    historyBadgeCount,
    trackingGapWarning,
  } = controller;

  return (
    <>
      {!historyPanelOpen ? (
        <MapLocateButton bottom={locateButtonBottom} onPress={goToCurrentLocation} />
      ) : null}
      <MapCalendarButton
        bottom={calendarButtonBottom}
        onPress={openHistoryDatePicker}
      />
      <MapHistoryButton
        bottom={historyButtonBottom}
        active={historyPanelOpen}
        eventCount={historyBadgeCount}
        onPress={handleToggleHistoryPanel}
      />
      {trackingGapWarning && !historyPanelOpen ? (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: locateButtonBottom + 64,
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
    </>
  );
}
