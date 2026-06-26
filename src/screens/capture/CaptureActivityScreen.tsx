import {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';

import {
  ActivityFormSheet,
  type ActivityFormRequest,
} from '@/components/map/ActivityFormSheet';
import {ActivityLogSheet} from '@/components/map/ActivityLogSheet';
import type {ActivityRow} from '@/db/repositories/activities';
import {NativeHalfSheetShell} from '@/components/ui/NativeHalfSheetShell';
import {useNativeHalfSheetClose} from '@/components/ui/native-half-sheet-context';
import {useDayMoments} from '@/hooks/use-day-moments';
import {getTodayDateKey} from '@/lib/day-utils';
import {ACTIVITY_SHEET_HEIGHT_RATIO} from '@/navigation/activity-capture-screen-options';
import {useSheetCaptureClose} from '@/screens/sheets/use-sheet-capture-close';

function CaptureActivityPanel({
  onBeginCreateFirst,
  onBeginCreate,
  onBeginEdit,
  reloadNonce,
  onRegisterClose,
}: {
  onBeginCreateFirst: () => void;
  onBeginCreate: () => void;
  onBeginEdit: (activity: ActivityRow) => void;
  reloadNonce: number;
  onRegisterClose: (close: () => void) => void;
}) {
  const closeSheet = useNativeHalfSheetClose();
  const {refreshDayMoments} = useDayMoments(getTodayDateKey());

  useEffect(() => {
    onRegisterClose(closeSheet);
  }, [closeSheet, onRegisterClose]);

  const handleLogged = async () => {
    await refreshDayMoments();
  };

  return (
    <ActivityLogSheet
      visible
      onClose={closeSheet}
      onLogged={handleLogged}
      onBeginCreateFirst={onBeginCreateFirst}
      onBeginCreate={onBeginCreate}
      onBeginEdit={onBeginEdit}
      reloadNonce={reloadNonce}
    />
  );
}

export function CaptureActivityScreen() {
  const navigationClose = useSheetCaptureClose();
  const {refreshDayMoments} = useDayMoments(getTodayDateKey());
  const closeShellRef = useRef<(() => void) | null>(null);
  const [formRequest, setFormRequest] = useState<ActivityFormRequest | null>(null);
  const [formSheetOpen, setFormSheetOpen] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const registerClose = useCallback((close: () => void) => {
    closeShellRef.current = close;
  }, []);

  const openForm = useCallback((request: ActivityFormRequest) => {
    setFormRequest(request);
    setFormSheetOpen(true);
  }, []);

  const handleFormDismissed = useCallback(() => {
    setFormRequest(null);
    setFormSheetOpen(false);
  }, []);

  const finishClose = useCallback(() => {
    if (formSheetOpen) {
      return;
    }
    navigationClose();
  }, [formSheetOpen, navigationClose]);

  const handleFormSaved = useCallback(() => {
    setReloadNonce(n => n + 1);
  }, []);

  const handleLoggedAndClose = useCallback(async () => {
    setFormRequest(null);
    setFormSheetOpen(false);
    await refreshDayMoments();
    closeShellRef.current?.();
  }, [refreshDayMoments]);

  const handleBeginCreateFirst = useCallback(() => {
    openForm({kind: 'create-first'});
  }, [openForm]);

  const handleBeginCreate = useCallback(() => {
    openForm({kind: 'create'});
  }, [openForm]);

  const handleBeginEdit = useCallback(
    (activity: ActivityRow) => {
      openForm({kind: 'edit', activity});
    },
    [openForm],
  );

  return (
    <View style={styles.root}>
      <View
        pointerEvents={formSheetOpen ? 'none' : 'auto'}
        style={styles.shellHost}>
        <NativeHalfSheetShell
          onClose={finishClose}
          backdropDismissEnabled={!formSheetOpen}
          heightRatio={ACTIVITY_SHEET_HEIGHT_RATIO}>
          <CaptureActivityPanel
            reloadNonce={reloadNonce}
            onRegisterClose={registerClose}
            onBeginCreateFirst={handleBeginCreateFirst}
            onBeginCreate={handleBeginCreate}
            onBeginEdit={handleBeginEdit}
          />
        </NativeHalfSheetShell>
      </View>
      <ActivityFormSheet
        request={formRequest}
        onClose={handleFormDismissed}
        onSaved={handleFormSaved}
        onLoggedAndClose={handleLoggedAndClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  shellHost: {
    flex: 1,
  },
});
