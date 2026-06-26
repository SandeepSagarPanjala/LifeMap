import {useCallback, useState} from 'react';

import {useSheetCaptureClose} from '@/screens/sheets/use-sheet-capture-close';

/** Transparent capture screens: pass touches through and pop immediately on dismiss. */
export function useSheetCaptureDismiss() {
  const [touchPassthrough, setTouchPassthrough] = useState(false);
  const handleClose = useSheetCaptureClose();

  const handleWillClose = useCallback(() => {
    setTouchPassthrough(true);
    handleClose();
  }, [handleClose]);

  return {touchPassthrough, handleWillClose, handleClose};
}
