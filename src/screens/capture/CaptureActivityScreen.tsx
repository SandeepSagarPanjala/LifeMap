import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ActivityFormSheet,
  type ActivityFormRequest,
} from '@/components/map/ActivityFormSheet';
import { ActivityLogEntrySheet } from '@/components/map/ActivityLogEntrySheet';
import { ActivityLogSheet } from '@/components/map/ActivityLogSheet';
import { ActivityCatalogSheet } from '@/components/map/ActivityCatalogSheet';
import type { ActivityRow } from '@/db/repositories/activities';
import { NativeHalfSheetShell } from '@/components/ui/NativeHalfSheetShell';
import { useNativeHalfSheetClose } from '@/components/ui/native-half-sheet-context';
import { useDayMoments } from '@/hooks/use-day-moments';
import { getTodayDateKey } from '@/lib/day-utils';
import { ACTIVITY_SHEET_HEIGHT_RATIO } from '@/navigation/activity-capture-screen-options';
import { useSheetCaptureClose } from '@/screens/sheets/use-sheet-capture-close';

/** Keep the half-sheet locked briefly after an overlay closes so the same
 *  touch/gesture cannot dismiss the shell underneath (invisible map blocker). */
const OVERLAY_UNLOCK_GRACE_MS = 450;

function CaptureActivityPanel({
  refreshDayMoments,
  onBeginCreateFirst,
  onBeginCreate,
  onBeginEdit,
  onBeginStructuredLog,
  onBeginCatalog,
  reloadNonce,
  onRegisterClose,
}: {
  refreshDayMoments: () => Promise<void>;
  onBeginCreateFirst: () => void;
  onBeginCreate: () => void;
  onBeginEdit: (activity: ActivityRow) => void;
  onBeginStructuredLog: (activity: ActivityRow) => void;
  onBeginCatalog: () => void;
  reloadNonce: number;
  onRegisterClose: (close: () => void) => void;
}) {
  const closeSheet = useNativeHalfSheetClose();

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
      onBeginStructuredLog={onBeginStructuredLog}
      onBeginCatalog={onBeginCatalog}
      reloadNonce={reloadNonce}
    />
  );
}

export function CaptureActivityScreen() {
  const navigationClose = useSheetCaptureClose();
  const { refreshDayMoments } = useDayMoments(getTodayDateKey());
  const closeShellRef = useRef<(() => void) | null>(null);
  const overlayGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [formRequest, setFormRequest] = useState<ActivityFormRequest | null>(
    null,
  );
  const [logActivity, setLogActivity] = useState<ActivityRow | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [overlayGrace, setOverlayGrace] = useState(false);
  /** After the half-sheet animates out, pass touches through until goBack. */
  const [shellClosed, setShellClosed] = useState(false);

  useEffect(() => {
    return () => {
      if (overlayGraceTimerRef.current != null) {
        clearTimeout(overlayGraceTimerRef.current);
      }
    };
  }, []);

  const registerClose = useCallback((close: () => void) => {
    closeShellRef.current = close;
  }, []);

  const armOverlayGrace = useCallback(() => {
    if (overlayGraceTimerRef.current != null) {
      clearTimeout(overlayGraceTimerRef.current);
    }
    setOverlayGrace(true);
    overlayGraceTimerRef.current = setTimeout(() => {
      overlayGraceTimerRef.current = null;
      setOverlayGrace(false);
    }, OVERLAY_UNLOCK_GRACE_MS);
  }, []);

  const openForm = useCallback((request: ActivityFormRequest) => {
    setFormRequest(request);
  }, []);

  const handleFormDismissed = useCallback(() => {
    setFormRequest(null);
    armOverlayGrace();
  }, [armOverlayGrace]);

  const clearOverlays = useCallback(() => {
    setFormRequest(null);
    setLogActivity(null);
    setCatalogOpen(false);
    setOverlayGrace(false);
    if (overlayGraceTimerRef.current != null) {
      clearTimeout(overlayGraceTimerRef.current);
      overlayGraceTimerRef.current = null;
    }
  }, []);

  const finishClose = useCallback(() => {
    // Always pop this transparent modal. Bailing leaves an invisible
    // full-screen host over the map that eats every touch.
    setShellClosed(true);
    clearOverlays();
    navigationClose();
  }, [clearOverlays, navigationClose]);

  const handleFormSaved = useCallback(() => {
    setReloadNonce(n => n + 1);
  }, []);

  const handleLoggedAndClose = useCallback(async () => {
    clearOverlays();
    await refreshDayMoments();
    closeShellRef.current?.();
  }, [clearOverlays, refreshDayMoments]);

  const handleBeginCreateFirst = useCallback(() => {
    openForm({ kind: 'create-first' });
  }, [openForm]);

  const handleBeginCreate = useCallback(() => {
    openForm({ kind: 'create' });
  }, [openForm]);

  const handleBeginEdit = useCallback(
    (activity: ActivityRow) => {
      openForm({ kind: 'edit', activity });
    },
    [openForm],
  );

  const handleBeginStructuredLog = useCallback((activity: ActivityRow) => {
    setLogActivity(activity);
  }, []);

  const handleLogEntryClose = useCallback(() => {
    setLogActivity(null);
    armOverlayGrace();
  }, [armOverlayGrace]);

  const handleStructuredLogged = useCallback(async () => {
    await refreshDayMoments();
    clearOverlays();
    closeShellRef.current?.();
  }, [clearOverlays, refreshDayMoments]);

  const handleBeginCatalog = useCallback(() => {
    setCatalogOpen(true);
  }, []);

  const handleCatalogClose = useCallback(() => {
    setCatalogOpen(false);
    armOverlayGrace();
  }, [armOverlayGrace]);

  const handleCatalogInstalled = useCallback(() => {
    setReloadNonce(n => n + 1);
  }, []);

  const anyOverlay =
    formRequest != null || logActivity != null || catalogOpen;
  const shellLocked = anyOverlay || overlayGrace || shellClosed;

  return (
    <View
      style={styles.root}
      pointerEvents={shellClosed ? 'none' : 'box-none'}
    >
      <View
        pointerEvents={shellLocked ? 'none' : 'auto'}
        style={styles.shellHost}
      >
        <NativeHalfSheetShell
          onClose={finishClose}
          backdropDismissEnabled={!shellLocked}
          heightRatio={ACTIVITY_SHEET_HEIGHT_RATIO}
        >
          <CaptureActivityPanel
            refreshDayMoments={refreshDayMoments}
            reloadNonce={reloadNonce}
            onRegisterClose={registerClose}
            onBeginCreateFirst={handleBeginCreateFirst}
            onBeginCreate={handleBeginCreate}
            onBeginEdit={handleBeginEdit}
            onBeginStructuredLog={handleBeginStructuredLog}
            onBeginCatalog={handleBeginCatalog}
          />
        </NativeHalfSheetShell>
      </View>
      {/* Keep overlays mounted (Saved Places pattern) so Gorhom present/dismiss
          stays stable — remounting caused Back → pencil-needs-two-taps. */}
      <ActivityFormSheet
        request={formRequest}
        onClose={handleFormDismissed}
        onSaved={handleFormSaved}
        onLoggedAndClose={handleLoggedAndClose}
      />
      <ActivityLogEntrySheet
        activity={logActivity}
        onClose={handleLogEntryClose}
        onLogged={handleStructuredLogged}
      />
      <ActivityCatalogSheet
        visible={catalogOpen}
        onClose={handleCatalogClose}
        onInstalled={handleCatalogInstalled}
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
