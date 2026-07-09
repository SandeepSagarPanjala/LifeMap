import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HistoryDatePickerPanel } from '@/components/map/HistoryDatePickerSheet';
import { NativeHalfSheetShell } from '@/components/ui/NativeHalfSheetShell';
import { useNativeHalfSheetClose } from '@/components/ui/native-half-sheet-context';
import {
  consumeHistoryDatePickerOpen,
  queueHistoryDatePickerResult,
} from '@/lib/history-date-picker-navigation';
import { getTodayDateKey } from '@/lib/day-utils';
import { HISTORY_DATE_PICKER_HEIGHT_RATIO } from '@/lib/app-constants';
import { useSheetCaptureClose } from '@/screens/sheets/use-sheet-capture-close';

function HistoryDatePickerPanelHost({
  selectedDateKey,
}: {
  selectedDateKey: string;
}) {
  const closeSheet = useNativeHalfSheetClose();

  const handleSelectDate = useCallback((dateKey: string) => {
    queueHistoryDatePickerResult(dateKey);
  }, []);

  return (
    <HistoryDatePickerPanel
      selectedDateKey={selectedDateKey}
      onSelectDate={handleSelectDate}
      onClose={closeSheet}
    />
  );
}

export function HistoryDatePickerScreen() {
  const navigationClose = useSheetCaptureClose();
  const [payload] = useState(() => consumeHistoryDatePickerOpen());
  const selectedDateKey = payload?.selectedDateKey ?? getTodayDateKey();

  return (
    <View style={styles.root}>
      <NativeHalfSheetShell
        onClose={navigationClose}
        heightRatio={HISTORY_DATE_PICKER_HEIGHT_RATIO}
      >
        <HistoryDatePickerPanelHost selectedDateKey={selectedDateKey} />
      </NativeHalfSheetShell>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
