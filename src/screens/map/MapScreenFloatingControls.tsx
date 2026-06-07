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
    </>
  );
}
