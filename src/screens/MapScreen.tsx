import {View} from 'react-native';

import {DayMomentSummaryBar} from '@/components/map/DayMomentSummaryBar';
import {HistoryDatePickerSheet} from '@/components/map/HistoryDatePickerSheet';
import {SavedPlacesSheet} from '@/components/map/SavedPlacesSheet';
import {SavePlaceSheet} from '@/components/map/SavePlaceSheet';
import {VoiceMemoSheet} from '@/components/map/VoiceMemoSheet';
import {MomentsPreviewSheet} from '@/components/moments/MomentsPreviewSheet';

import {MapHistoryPanel} from './map/MapHistoryPanel';
import {MapScreenFloatingControls} from './map/MapScreenFloatingControls';
import {MapDayLoadingOverlay} from '@/components/map/MapDayLoadingOverlay';
import {MapScreenMap} from './map/MapScreenMap';
import {MapScreenTopBar} from './map/MapScreenTopBar';
import {useMapScreenController} from './map/use-map-screen-controller';

export function MapScreen() {
  const controller = useMapScreenController();

  return (
    <View className="bg-background flex-1">
      <MapScreenMap controller={controller} />
      <MapDayLoadingOverlay visible={controller.historyBlockingLoader} />
      <MapScreenFloatingControls controller={controller} />
      {controller.showDayMomentSummary ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: controller.dayMomentSummaryBottom,
          }}>
          <DayMomentSummaryBar
            counts={controller.dayMomentCounts}
            docked
            onPressType={controller.openDayMomentsPreview}
          />
        </View>
      ) : null}
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
        onEditLabel={controller.handleEditFavoriteLabel}
        onDelete={controller.handleDeleteSavedPlace}
      />
      <VoiceMemoSheet
        visible={controller.voiceSheetOpen}
        onClose={controller.closeVoiceSheet}
        onSaved={controller.handleVoiceMomentSaved}
      />
      <MomentsPreviewSheet
        visible={controller.momentsPreviewOpen}
        title={controller.momentsPreviewTitle}
        moments={controller.momentsPreviewMoments}
        initialIndex={controller.momentsPreviewInitialIndex}
        timelineEntries={controller.historyEntries}
        savedPlaces={controller.savedPlaces}
        distanceUnit={controller.distanceUnit}
        previewEntry={controller.momentsPreviewEntry}
        suspendAudio={controller.voiceSheetOpen}
        onClose={controller.closeMomentsPreview}
        onDeleteMoment={controller.handleDeleteMoment}
      />
      <MapHistoryPanel controller={controller} />
      <MapScreenTopBar controller={controller} />
    </View>
  );
}
