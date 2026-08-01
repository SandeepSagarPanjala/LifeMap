import { useCallback } from 'react';
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
  const selectedDateKey =
    route.params?.selectedDateKey ?? getTodayDateKey();

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
