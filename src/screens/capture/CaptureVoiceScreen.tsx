import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  VoiceMemoPreviewSheet,
  type VoiceMemoPreviewDraft,
} from '@/components/map/VoiceMemoPreviewSheet';
import { VoiceMemoSheet } from '@/components/map/VoiceMemoSheet';
import { NativeHalfSheetShell } from '@/components/ui/NativeHalfSheetShell';
import { useNativeHalfSheetClose } from '@/components/ui/native-half-sheet-context';
import { useDayMoments } from '@/hooks/use-day-moments';
import { getTodayDateKey } from '@/lib/day-utils';
import { VOICE_SHEET_HEIGHT_RATIO } from '@/navigation/voice-capture-screen-options';
import { useSheetCaptureClose } from '@/screens/sheets/use-sheet-capture-close';

function CaptureVoicePanel({
  onBeginPreview,
  onRegisterClose,
  recordingRestartNonce,
}: {
  onBeginPreview: (draft: VoiceMemoPreviewDraft) => void;
  onRegisterClose: (close: () => void) => void;
  recordingRestartNonce: number;
}) {
  const closeSheet = useNativeHalfSheetClose();

  useEffect(() => {
    onRegisterClose(closeSheet);
  }, [closeSheet, onRegisterClose]);

  return (
    <VoiceMemoSheet
      embedded
      visible
      instantPresent
      onBeginPreview={onBeginPreview}
      restartNonce={recordingRestartNonce}
      onClose={closeSheet}
      onSaved={async () => {}}
    />
  );
}

export function CaptureVoiceScreen() {
  const navigationClose = useSheetCaptureClose();
  const { refreshDayMoments } = useDayMoments(getTodayDateKey());
  const closeShellRef = useRef<(() => void) | null>(null);
  const savedAndClosingRef = useRef(false);
  const [previewDraft, setPreviewDraft] =
    useState<VoiceMemoPreviewDraft | null>(null);
  const [previewSheetOpen, setPreviewSheetOpen] = useState(false);
  const [recordingRestartNonce, setRecordingRestartNonce] = useState(0);

  const registerClose = useCallback((close: () => void) => {
    closeShellRef.current = close;
  }, []);

  const handleBeginPreview = useCallback((draft: VoiceMemoPreviewDraft) => {
    setPreviewDraft(draft);
    setPreviewSheetOpen(true);
  }, []);

  const handlePreviewDismissed = useCallback(() => {
    setPreviewSheetOpen(false);
    setPreviewDraft(null);
    if (savedAndClosingRef.current) {
      savedAndClosingRef.current = false;
      closeShellRef.current?.();
    } else {
      setRecordingRestartNonce(n => n + 1);
    }
  }, []);

  const handlePreviewSaved = useCallback(async () => {
    await refreshDayMoments();
    savedAndClosingRef.current = true;
  }, [refreshDayMoments]);

  const finishClose = useCallback(() => {
    if (previewSheetOpen) {
      return;
    }
    navigationClose();
  }, [navigationClose, previewSheetOpen]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View
        pointerEvents={previewSheetOpen ? 'none' : 'auto'}
        style={styles.shellHost}
      >
        <NativeHalfSheetShell
          onClose={finishClose}
          backdropDismissEnabled={!previewSheetOpen}
          heightRatio={VOICE_SHEET_HEIGHT_RATIO}
        >
          <CaptureVoicePanel
            onRegisterClose={registerClose}
            onBeginPreview={handleBeginPreview}
            recordingRestartNonce={recordingRestartNonce}
          />
        </NativeHalfSheetShell>
      </View>
      {previewSheetOpen ? (
        <VoiceMemoPreviewSheet
          draft={previewDraft}
          onClose={handlePreviewDismissed}
          onSaved={handlePreviewSaved}
        />
      ) : null}
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
