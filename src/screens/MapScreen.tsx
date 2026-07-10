import { View } from 'react-native';

import { BackgroundWorkBanner } from '@/components/background-work/BackgroundWorkBanner';
import { SavePlaceSheet } from '@/components/map/SavePlaceSheet';

import { MapHistoryPanel } from './map/MapHistoryPanel';
import { MapScreenFloatingControls } from './map/MapScreenFloatingControls';
import { MapDayLoadingOverlay } from '@/components/map/MapDayLoadingOverlay';
import { MapScreenMap } from './map/MapScreenMap';
import { MapScreenTopBar } from './map/MapScreenTopBar';
import { useMapScreenController } from './map/use-map-screen-controller';

export function MapScreen() {
  const controller = useMapScreenController();

  return (
    <View className="bg-background flex-1">
      <MapScreenMap controller={controller} />
      <MapDayLoadingOverlay visible={controller.historyBlockingLoader} />
      <MapScreenFloatingControls controller={controller} />
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
      <MapHistoryPanel controller={controller} />
      <MapScreenTopBar controller={controller} />
      <BackgroundWorkBanner />
    </View>
  );
}
