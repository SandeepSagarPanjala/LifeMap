import {View} from 'react-native';

import {HistoryDatePickerSheet} from '@/components/map/HistoryDatePickerSheet';
import {SavedPlacesSheet} from '@/components/map/SavedPlacesSheet';
import {SavePlaceSheet} from '@/components/map/SavePlaceSheet';

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
      <SavePlaceSheet
        visible={controller.savePlaceCoordinate != null}
        coordinate={controller.savePlaceCoordinate}
        hasHome={controller.hasHome}
        hasWork={controller.hasWork}
        canSaveHome={controller.canSaveHome}
        canSaveWork={controller.canSaveWork}
        canSaveFavorite={controller.canSaveFavorite}
        isAtPlaceLimit={controller.isAtSavedPlaceLimit}
        maxPlaces={controller.maxSavedPlaces}
        onClose={controller.closeSavePlaceSheet}
        onSaveHome={controller.handleSaveHomePlace}
        onSaveWork={controller.handleSaveWorkPlace}
        onSaveFavorite={controller.handleSaveFavoritePlace}
      />
      <SavedPlacesSheet
        visible={controller.savedPlacesSheetOpen}
        places={controller.savedPlaces}
        onClose={controller.closeSavedPlacesSheet}
        onSelectPlace={controller.handleSelectSavedPlace}
        onDelete={controller.handleDeleteSavedPlace}
      />
      <MapHistoryPanel controller={controller} />
      <MapScreenTopBar controller={controller} />
    </View>
  );
}
