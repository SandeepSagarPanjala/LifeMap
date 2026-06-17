import {Animated, StyleSheet} from 'react-native';

import {HistoryEventCard} from '@/components/map/HistoryEventCard';
import {HistoryPanelSkeleton} from '@/components/map/HistoryPanelSkeleton';
import {HistoryTimelineBar} from '@/components/map/HistoryTimelineBar';

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
    handleSelectVisitPlaceIndex,
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
  } = controller;

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
        <>
          <HistoryEventCard
            entry={scrubOnEvent ? selectedEntry : null}
            savedPlace={scrubOnEvent ? selectedSavedPlace : null}
            visitPlaceDisplay={
              scrubOnEvent && selectedEntry?.kind === 'stay'
                ? selectedVisitPlaceDisplay
                : null
            }
            onSelectVisitPlaceIndex={handleSelectVisitPlaceIndex}
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
        </>
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
