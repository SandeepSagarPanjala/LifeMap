import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { MapDateLabel } from '@/components/map/MapDateLabel';
import type { MapScreenController } from './use-map-screen-controller';

type MapScreenTopBarProps = {
  controller: MapScreenController;
};

export const MapScreenTopBar = memo(function MapScreenTopBar({
  controller,
}: MapScreenTopBarProps) {
  const {
    insets,
    mapDateLabel,
    viewingToday,
    historyPanelChromeVisible,
    dateNavAnchorBottom,
    canGoPrevDay,
    canGoNextDay,
    goToPrevDay,
    goToNextDay,
    goToToday,
    openHistoryDatePicker,
  } = controller;
  const showRestingDateNav = !historyPanelChromeVisible;

  return (
    <View pointerEvents="box-none" style={styles.bar}>
      {showRestingDateNav ? (
        <MapDateLabel
          label={mapDateLabel}
          topInset={insets.top}
          showNavigation
          showCloseButton={!viewingToday}
          anchorBottom={dateNavAnchorBottom}
          canGoPrev={canGoPrevDay}
          canGoNext={canGoNextDay}
          onPrev={goToPrevDay}
          onNext={goToNextDay}
          onClose={goToToday}
          onPressLabel={openHistoryDatePicker}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 20,
  },
});
