import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { HistoryDatePickerPanel } from '@/components/map/HistoryDatePickerSheet';
import { NativeHalfSheetShell } from '@/components/ui/NativeHalfSheetShell';
import { useNativeHalfSheetClose } from '@/components/ui/native-half-sheet-context';
import { queueHistoryDatePickerResult } from '@/lib/history-date-picker-navigation';
import { getTodayDateKey } from '@/lib/day-utils';
import { HISTORY_DATE_PICKER_HEIGHT_RATIO } from '@/lib/app-constants';
import type { RootStackParamList } from '@/navigation/types';
import { useSheetCaptureClose } from '@/screens/sheets/use-sheet-capture-close';

type Props = NativeStackScreenProps<RootStackParamList, 'HistoryDatePicker'>;

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

export function HistoryDatePickerScreen({ route }: Props) {
  const navigationClose = useSheetCaptureClose();
  const [shellClosed, setShellClosed] = useState(false);
  const selectedDateKey =
    route.params?.selectedDateKey ?? getTodayDateKey();

  const finishClose = useCallback(() => {
    // Drop the transparent modal's hit target before/while popping so a
    // canceled animation cannot leave an invisible full-screen blocker.
    setShellClosed(true);
    navigationClose();
  }, [navigationClose]);

  return (
    <View
      style={styles.root}
      pointerEvents={shellClosed ? 'none' : 'box-none'}
    >
      <NativeHalfSheetShell
        onClose={finishClose}
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
