import {useState} from 'react';

import {VoiceMemoSheet} from '@/components/map/VoiceMemoSheet';
import {useDayMoments} from '@/hooks/use-day-moments';
import {getTodayDateKey} from '@/lib/day-utils';
import {SheetCaptureScreen} from '@/screens/sheets/SheetCaptureScreen';
import {useSheetCaptureClose} from '@/screens/sheets/use-sheet-capture-close';

export function CaptureVoiceScreen() {
  const [touchPassthrough, setTouchPassthrough] = useState(false);
  const handleClose = useSheetCaptureClose();
  const {refreshDayMoments} = useDayMoments(getTodayDateKey());

  const handleSaved = async () => {
    await refreshDayMoments();
  };

  return (
    <SheetCaptureScreen touchPassthrough={touchPassthrough}>
      <VoiceMemoSheet
        visible
        instantPresent
        onWillClose={() => setTouchPassthrough(true)}
        onClose={handleClose}
        onSaved={handleSaved}
      />
    </SheetCaptureScreen>
  );
}
