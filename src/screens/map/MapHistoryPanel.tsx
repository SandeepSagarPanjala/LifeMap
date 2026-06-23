import {useState} from 'react';
import {Animated, StyleSheet, View} from 'react-native';

import {HistoryEventCard} from '@/components/map/HistoryEventCard';
import {HistoryPanelChrome} from '@/components/map/HistoryPanelChrome';
import {HistoryPanelSkeleton} from '@/components/map/HistoryPanelSkeleton';
import {HistoryTimelineBar} from '@/components/map/HistoryTimelineBar';
import {VisitPlaceAddressCard} from '@/components/map/VisitPlaceAddressCard';
import {VisitPlaceCustomLabelSheet} from '@/components/map/VisitPlaceCustomLabelSheet';
import {MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP} from '@/screens/map/map-screen-constants';

import type {MapScreenController} from './use-map-screen-controller';

type MapHistoryPanelProps = {
  controller: MapScreenController;
};

export function MapHistoryPanel({controller}: MapHistoryPanelProps) {
  const {
    historyPanelChromeVisible,
    insets,
    historyPanelY,
    showHistoryPanelContent,
    scrubOnEvent,
    selectedEntry,
    selectedSavedPlace,
    selectedDriveEndpointLabels,
    placeLabelEditDisplay,
    handleSelectVisitPlaceIndex,
    handleExpandVisitPlaceArea,
    handleSaveCustomVisitPlaceLabel,
    handleDonePlaceLabel,
    expandingVisitPlaceArea,
    showPlaceLabelCard,
    visitPlaceLabelInEventCard,
    openVisitPlaceLabelCard,
    openDriveStartLabelCard,
    openDriveEndLabelCard,
    canEditDriveStartLabel,
    canEditDriveEndLabel,
    historyEntries,
    distanceUnit,
    playback,
    handlePlayHistory,
    handleZoomVisit,
    selectedHistoryIndex,
    selectHistoryIndex,
    selectedDateKey,
    selectedEntryMomentCounts,
    openSelectedEntryMomentsPreview,
    viewingToday,
    historyHasGpsData,
    handleHistoryPanelContentLayout,
    mapDateLabel,
    canGoPrevDay,
    canGoNextDay,
    goToPrevDay,
    goToNextDay,
    goToToday,
    closeHistoryPanel,
    openHistoryDatePicker,
  } = controller;

  const [customLabelOpen, setCustomLabelOpen] = useState(false);
  const eventSelected =
    selectedHistoryIndex >= 0 && selectedEntry != null;

  if (!historyPanelChromeVisible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          bottom: insets.bottom,
          transform: [{translateY: historyPanelY}],
        },
      ]}>
      <HistoryPanelChrome
        viewingToday={viewingToday}
        label={mapDateLabel}
        canGoPrev={canGoPrevDay}
        canGoNext={canGoNextDay}
        onPrev={goToPrevDay}
        onNext={goToNextDay}
        onClose={viewingToday ? closeHistoryPanel : goToToday}
        onPressLabel={openHistoryDatePicker}
      />
      {showHistoryPanelContent ? (
        <View
          style={styles.content}
          onLayout={handleHistoryPanelContentLayout}>
          {showPlaceLabelCard ? (
            <VisitPlaceAddressCard
              display={placeLabelEditDisplay}
              expandingArea={expandingVisitPlaceArea}
              onSelectIndex={handleSelectVisitPlaceIndex}
              onExpandArea={handleExpandVisitPlaceArea}
              onRequestCustomLabel={() => setCustomLabelOpen(true)}
              onDone={handleDonePlaceLabel}
            />
          ) : null}
          <HistoryEventCard
            entry={eventSelected ? selectedEntry : null}
            savedPlace={scrubOnEvent ? selectedSavedPlace : null}
            visitPlaceLabel={visitPlaceLabelInEventCard}
            onEditVisitPlaceLabel={
              scrubOnEvent &&
              selectedEntry?.kind === 'stay' &&
              selectedSavedPlace == null
                ? openVisitPlaceLabelCard
                : undefined
            }
            canEditDriveStartLabel={scrubOnEvent && canEditDriveStartLabel}
            canEditDriveEndLabel={scrubOnEvent && canEditDriveEndLabel}
            onEditDriveStartLabel={openDriveStartLabelCard}
            onEditDriveEndLabel={openDriveEndLabelCard}
            driveStartLabel={
              scrubOnEvent ? selectedDriveEndpointLabels.start : undefined
            }
            driveEndLabel={
              scrubOnEvent ? selectedDriveEndpointLabels.end : undefined
            }
            momentCounts={scrubOnEvent ? selectedEntryMomentCounts : undefined}
            onPressMomentType={
              scrubOnEvent ? openSelectedEntryMomentsPreview : undefined
            }
            scrubOnEmpty={
              historyEntries.length > 0 && !eventSelected && showHistoryPanelContent
            }
            emptyDayWithoutData={!historyHasGpsData}
            viewingToday={viewingToday}
            distanceUnit={distanceUnit}
            isPlaying={playback.isPlaying}
            onPlay={handlePlayHistory}
            onStop={playback.stop}
            onZoomVisit={handleZoomVisit}
          />
          <HistoryTimelineBar
            dateKey={selectedDateKey}
            entries={historyEntries}
            selectedIndex={selectedHistoryIndex}
            onSelectIndex={selectHistoryIndex}
          />
          <VisitPlaceCustomLabelSheet
            visible={customLabelOpen}
            initialValue={placeLabelEditDisplay.customLabel ?? ''}
            onClose={() => setCustomLabelOpen(false)}
            onSave={label => {
              handleSaveCustomVisitPlaceLabel(label);
              setCustomLabelOpen(false);
            }}
          />
        </View>
      ) : (
        <View style={styles.content}>
          <HistoryPanelSkeleton />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
  },
  content: {
    marginTop: MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP,
  },
});
