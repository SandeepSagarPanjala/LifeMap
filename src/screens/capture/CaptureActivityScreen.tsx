import {useState} from 'react';

import {ActivityLogSheet} from '@/components/map/ActivityLogSheet';
import {useDayMoments} from '@/hooks/use-day-moments';
import {getTodayDateKey} from '@/lib/day-utils';
import {SheetCaptureScreen} from '@/screens/sheets/SheetCaptureScreen';
import {useSheetCaptureClose} from '@/screens/sheets/use-sheet-capture-close';

const HALF_SHEET_SNAP_POINTS = ['50%'] as const;

export function CaptureActivityScreen() {
  const [touchPassthrough, setTouchPassthrough] = useState(false);
  const handleClose = useSheetCaptureClose();
  const {refreshDayMoments} = useDayMoments(getTodayDateKey());

  const handleLogged = async () => {
    await refreshDayMoments();
  };

  return (
    <SheetCaptureScreen touchPassthrough={touchPassthrough}>
      <ActivityLogSheet
        visible
        snapPoints={[...HALF_SHEET_SNAP_POINTS]}
        instantPresent
        onWillClose={() => setTouchPassthrough(true)}
        onClose={handleClose}
        onLogged={handleLogged}
      />
    </SheetCaptureScreen>
  );
}
