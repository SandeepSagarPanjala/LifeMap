import {View} from 'react-native';

import {HistoryDatePickerSheet} from '@/components/map/HistoryDatePickerSheet';

import {MapHistoryPanel} from './map/MapHistoryPanel';
import {MapScreenFloatingControls} from './map/MapScreenFloatingControls';
import {MapScreenMap} from './map/MapScreenMap';
import {MapScreenTopBar} from './map/MapScreenTopBar';
import {useMapScreenController} from './map/use-map-screen-controller';

export function MapScreen() {
  const controller = useMapScreenController();

  return (
    <View className="bg-background flex-1">
      <MapScreenMap controller={controller} />
      <MapScreenFloatingControls controller={controller} />
      <HistoryDatePickerSheet
        visible={controller.historyDatePickerOpen}
        selectedDateKey={controller.selectedDateKey}
        onSelectDate={controller.handleSelectMapDate}
        onClose={controller.closeHistoryDatePicker}
      />
      <MapHistoryPanel controller={controller} />
      <MapScreenTopBar controller={controller} />
    </View>
  );
}
