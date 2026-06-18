import {useState} from 'react';
import {Animated, StyleSheet, View} from 'react-native';

import {HistoryEventCard} from '@/components/map/HistoryEventCard';
import {HistoryPanelSkeleton} from '@/components/map/HistoryPanelSkeleton';
import {HistoryTimelineBar} from '@/components/map/HistoryTimelineBar';
import {VisitPlaceAddressCard} from '@/components/map/VisitPlaceAddressCard';
import {VisitPlaceCustomLabelSheet} from '@/components/map/VisitPlaceCustomLabelSheet';

import type {MapScreenController} from './use-map-screen-controller';

type MapHistoryPanelProps = {
  controller: MapScreenController;
};

export function MapHistoryPanel({controller}: MapHistoryPanelProps) {
  const {
    historyPanelOpen,
    insets,
    historyPanelY,
    showHistoryPanelContent,
    scrubOnEvent,
    selectedEntry,
    selectedSavedPlace,
    selectedDriveEndpointLabels,
    selectedVisitPlaceDisplay,
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
  } = controller;

  const [customLabelOpen, setCustomLabelOpen] = useState(false);

  if (!historyPanelOpen) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.host,
        {
          bottom: insets.bottom,
          transform: [{translateY: historyPanelY}],
        },
      ]}>
      {showHistoryPanelContent ? (
        <View onLayout={handleHistoryPanelContentLayout}>
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
            entry={scrubOnEvent ? selectedEntry : null}
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
            onPressMomentCounts={
              scrubOnEvent ? openSelectedEntryMomentsPreview : undefined
            }
            scrubOnEmpty={historyEntries.length > 0 && !scrubOnEvent}
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
        <HistoryPanelSkeleton />
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
});
