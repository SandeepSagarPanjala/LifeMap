import {useState} from 'react';

import {HistoryDatePickerSheet} from '@/components/map/HistoryDatePickerSheet';
import {
  consumeHistoryDatePickerOpen,
  queueHistoryDatePickerResult,
} from '@/lib/history-date-picker-navigation';
import {getTodayDateKey} from '@/lib/day-utils';
import {SheetCaptureScreen} from '@/screens/sheets/SheetCaptureScreen';
import {useSheetCaptureDismiss} from '@/screens/sheets/use-sheet-capture-dismiss';

export function HistoryDatePickerScreen() {
  const {touchPassthrough, handleWillClose, handleClose} =
    useSheetCaptureDismiss();
  const [payload] = useState(() => consumeHistoryDatePickerOpen());
  const selectedDateKey = payload?.selectedDateKey ?? getTodayDateKey();

  const handleSelectDate = (dateKey: string) => {
    queueHistoryDatePickerResult(dateKey);
    handleClose();
  };

  return (
    <SheetCaptureScreen touchPassthrough={touchPassthrough}>
      <HistoryDatePickerSheet
        visible
        instantPresent
        selectedDateKey={selectedDateKey}
        onSelectDate={handleSelectDate}
        onClose={handleClose}
        onWillClose={handleWillClose}
      />
    </SheetCaptureScreen>
  );
}
