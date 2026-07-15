import { useMemo, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { HistoryEventCard } from '@/components/map/HistoryEventCard';
import { HistoryPanelChrome } from '@/components/map/HistoryPanelChrome';
import { HistoryPanelSkeleton } from '@/components/map/HistoryPanelSkeleton';
import { HistoryTimelineBar } from '@/components/map/HistoryTimelineBar';
import { VisitPlaceCustomLabelSheet } from '@/components/map/VisitPlaceCustomLabelSheet';
import { VisitPlacePickerSheet } from '@/components/map/VisitPlacePickerSheet';
import { MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP } from '@/lib/app-constants';

import type { MapScreenController } from './use-map-screen-controller';

type MapHistoryPanelProps = {
  controller: MapScreenController;
};

export function MapHistoryPanel({ controller }: MapHistoryPanelProps) {
  const {
    historyPanelChromeVisible,
    historyPanelOpen,
    insets,
    historyPanelY,
    showHistoryPanelContent,
    scrubOnEvent,
    selectedEntry,
    selectedSavedPlace,
    selectedDriveEndpointLabels,
    placeLabelEditDisplay,
    handleSaveCustomVisitPlaceLabel,
    handleDonePlaceLabel,
    handleClosePlaceLabel,
    showPlaceLabelCard,
    visitPlaceLabelInEventCard,
    visitPlacePinnedInEventCard,
    visitPlaceCategoryInEventCard,
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
    closeHistoryPanel,
    openHistoryDatePicker,
  } = controller;

  const [customLabelOpen, setCustomLabelOpen] = useState(false);
  const customLabelInitialValue = useMemo(() => {
    const selected =
      placeLabelEditDisplay.selectedPoiId != null
        ? placeLabelEditDisplay.candidates.find(
            candidate => candidate.id === placeLabelEditDisplay.selectedPoiId,
          )
        : null;
    return selected?.source === 'user' ? selected.name : '';
  }, [placeLabelEditDisplay.candidates, placeLabelEditDisplay.selectedPoiId]);
  const eventSelected = selectedHistoryIndex >= 0 && selectedEntry != null;
  const pickerVisible = showPlaceLabelCard && !customLabelOpen;

  if (!historyPanelChromeVisible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={historyPanelOpen ? 'box-none' : 'none'}
      style={[
        styles.host,
        {
          bottom: insets.bottom,
          transform: [{ translateY: historyPanelY }],
        },
      ]}
    >
      <HistoryPanelChrome
        viewingToday={viewingToday}
        label={mapDateLabel}
        canGoPrev={canGoPrevDay}
        canGoNext={canGoNextDay}
        onPrev={goToPrevDay}
        onNext={goToNextDay}
        onClose={closeHistoryPanel}
        onPressLabel={openHistoryDatePicker}
      />
      {showHistoryPanelContent ? (
        <View style={styles.content} onLayout={handleHistoryPanelContentLayout}>
          {pickerVisible ? (
            <VisitPlacePickerSheet
              display={placeLabelEditDisplay}
              onSelect={selection => {
                handleDonePlaceLabel(selection);
              }}
              onRequestCustom={() => setCustomLabelOpen(true)}
              onClose={handleClosePlaceLabel}
            />
          ) : null}
          <HistoryEventCard
            entry={eventSelected ? selectedEntry : null}
            savedPlace={scrubOnEvent ? selectedSavedPlace : null}
            visitPlaceLabel={visitPlaceLabelInEventCard}
            visitPlacePinned={visitPlacePinnedInEventCard}
            visitPlaceCategory={visitPlaceCategoryInEventCard}
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
              historyEntries.length > 0 &&
              !eventSelected &&
              showHistoryPanelContent
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
            canWrapToPrevDay={canGoPrevDay}
            canWrapToNextDay={canGoNextDay}
            onWrapToPrevDay={goToPrevDay}
            onWrapToNextDay={goToNextDay}
          />
          <VisitPlaceCustomLabelSheet
            visible={customLabelOpen}
            initialValue={customLabelInitialValue}
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
