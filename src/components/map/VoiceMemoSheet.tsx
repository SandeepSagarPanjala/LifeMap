import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { AudioLines, Pause, Play } from 'lucide-react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { CAPTURE_BUTTON_THEMES } from '@/components/map/map-capture-button-theme';
import {
  VoiceLiveMeter,
  VoicePlaybackMeter,
} from '@/components/voice/VoiceMeter';
import { Text } from '@/components/ui/text';
import { BOTTOM_SHEET_SURFACE } from '@/lib/app-constants';
import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';
import type { VoiceMemoPreviewDraft } from '@/components/map/VoiceMemoPreviewSheet';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  formatVoiceDurationCap,
  formatVoiceDurationMs,
  isVoiceDurationAtCap,
} from '@/lib/moments/format-voice-duration';
import { saveVoiceMoment } from '@/lib/moments/capture-voice';
import {
  normalizeVoiceMetering,
  throttleVoiceUi,
  type ThrottledVoiceUiFn,
} from '@/lib/moments/voice-waveform';
import {
  createVoiceRecorderSession,
  getVoiceRecordingErrorMessage,
} from '@/lib/moments/voice-recorder';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VOICE_RECORD_RED = '#FF3B30';

type VoiceMemoPhase = 'idle' | 'recording' | 'preview' | 'saving';

export type VoiceMemoSaveTarget = 'moment' | 'diary' | 'photo';

type VoiceMemoSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  saveTarget?: VoiceMemoSaveTarget;
  onDiaryAttach?: (attachment: { uri: string; durationMs: number }) => void;
  onWillClose?: () => void;
  /** When true, begin recording as soon as the sheet opens. Default: tap mic (Voice Memos style). */
  startRecordingOnOpen?: boolean;
  /** Gate for auto-start (e.g. wait until slide animation finishes). Default true. */
  canAutoStart?: boolean;
  snapPoints?: (string | number)[];
  instantPresent?: boolean;
  /** Render inside SheetFlowScreen panel — skips gorhom (instant open). */
  embedded?: boolean;
  /** Map capture: preview + note opens in a gorhom overlay via parent. */
  onBeginPreview?: (draft: VoiceMemoPreviewDraft) => void;
  /** Increment after preview discard — resets to manual mic (no auto-record). */
  restartNonce?: number;
};

export function VoiceMemoSheet({
  visible,
  onClose,
  onSaved,
  saveTarget = 'moment',
  onDiaryAttach,
  onWillClose,
  startRecordingOnOpen = false,
  canAutoStart = true,
  snapPoints,
  instantPresent = false,
  embedded = false,
  onBeginPreview,
  restartNonce = 0,
}: VoiceMemoSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const voiceTheme = CAPTURE_BUTTON_THEMES.voice;
  const useExternalPreview = embedded && onBeginPreview != null;

  const [phase, setPhase] = useState<VoiceMemoPhase>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [noteText, setNoteText] = useState('');
  const [noteFocused, setNoteFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [autoStartFailed, setAutoStartFailed] = useState(false);
  const [manualStartOnly, setManualStartOnly] = useState(false);

  const recorderRef = useRef<ReturnType<
    typeof createVoiceRecorderSession
  > | null>(null);
  const aliveRef = useRef(true);
  const visibleRef = useRef(visible);
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});
  const durationMsRef = useRef(0);
  const previewPathRef = useRef<string | null>(null);
  const phaseRef = useRef<VoiceMemoPhase>('idle');
  const liveLevelRef = useRef(0.04);
  const sheetRef = useRef<BottomSheetModal>(null);
  const restoreSheetAfterKeyboardRef = useRef(false);

  const paintDurationRef = useRef<ThrottledVoiceUiFn<(ms: number) => void>>(
    throttleVoiceUi(() => {}, 250),
  );
  const paintPlaybackRef = useRef<ThrottledVoiceUiFn<(ms: number) => void>>(
    throttleVoiceUi(() => {}, 150),
  );
  const recordingActiveRef = useRef(false);

  useEffect(() => {
    durationMsRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    previewPathRef.current = previewPath;
  }, [previewPath]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    paintDurationRef.current = throttleVoiceUi((ms: number) => {
      setDurationMs(ms);
    }, 250);
    paintPlaybackRef.current = throttleVoiceUi((ms: number) => {
      setPlaybackPositionMs(ms);
    }, 150);
    return () => {
      paintDurationRef.current.cancel();
      paintPlaybackRef.current.cancel();
    };
  }, []);

  const resetDraft = useCallback(async () => {
    recordingActiveRef.current = false;
    paintDurationRef.current.cancel();
    paintPlaybackRef.current.cancel();
    await recorderRef.current?.stopPreview();
    await recorderRef.current?.discardRecording(previewPathRef.current);
    setPhase('idle');
    setDurationMs(0);
    setPreviewPath(null);
    setIsPlayingPreview(false);
    liveLevelRef.current = 0.04;
    setPlaybackPositionMs(0);
    setNoteText('');
    setNoteFocused(false);
    durationMsRef.current = 0;
  }, []);

  const promptDiscardOnClose = useCallback(() => {
    Alert.alert('Discard voice memo?', 'This recording will be deleted.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          onClose();
          void resetDraft();
        },
      },
    ]);
  }, [onClose, resetDraft]);

  const closeSheet = useCallback(() => {
    if (phaseRef.current === 'saving') {
      return;
    }
    if (
      !useExternalPreview &&
      phaseRef.current === 'preview' &&
      previewPathRef.current
    ) {
      promptDiscardOnClose();
      return;
    }
    onClose();
    void resetDraft();
  }, [onClose, promptDiscardOnClose, resetDraft, useExternalPreview]);

  useEffect(() => {
    if (!visible) {
      setAutoStartFailed(false);
      void resetDraft();
    }
  }, [resetDraft, visible]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () =>
      setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      if (restoreSheetAfterKeyboardRef.current) {
        restoreSheetAfterKeyboardRef.current = false;
        sheetRef.current?.snapToIndex(0);
      }
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    const session = createVoiceRecorderSession({
      onDurationMs: ms => {
        if (!aliveRef.current || !recordingActiveRef.current) {
          return;
        }
        durationMsRef.current = ms;
        paintDurationRef.current(ms);
      },
      onMaxDurationReached: () => {
        if (!aliveRef.current) {
          return;
        }
        void stopRecordingRef.current();
      },
      onMetering: meteringDb => {
        if (!aliveRef.current) {
          return;
        }
        liveLevelRef.current = normalizeVoiceMetering(meteringDb);
      },
      onPlaybackProgress: (positionMs, totalMs) => {
        if (!aliveRef.current) {
          return;
        }
        paintPlaybackRef.current(positionMs);
        if (totalMs > 0 && positionMs >= totalMs - 80) {
          setIsPlayingPreview(false);
        }
      },
      onPlaybackEnded: () => {
        if (!aliveRef.current) {
          return;
        }
        setIsPlayingPreview(false);
        setPlaybackPositionMs(durationMsRef.current);
      },
    });
    recorderRef.current = session;
    return () => {
      aliveRef.current = false;
      void (async () => {
        try {
          await session.stopPreview();
        } catch {
          // Not playing.
        }
        try {
          await session.discardRecording(previewPathRef.current);
        } catch {
          // Not recording.
        }
        session.dispose();
        if (recorderRef.current === session) {
          recorderRef.current = null;
        }
      })();
    };
  }, []);

  const handleStopRecording = useCallback(async () => {
    if (!recorderRef.current) {
      return;
    }
    recordingActiveRef.current = false;
    paintDurationRef.current.cancel();
    try {
      const result = await recorderRef.current.stopRecording();
      setDurationMs(result.durationMs);
      durationMsRef.current = result.durationMs;
      if (result.durationMs < 500) {
        await recorderRef.current.discardRecording(result.filePath);
        setPhase('idle');
        setDurationMs(0);
        durationMsRef.current = 0;
        Alert.alert(
          'Recording too short',
          'Hold the mic for at least half a second.',
        );
        return;
      }
      if (useExternalPreview) {
        onBeginPreview?.({
          path: result.filePath,
          durationMs: result.durationMs,
        });
        setPhase('idle');
        setDurationMs(0);
        durationMsRef.current = 0;
        setIsPlayingPreview(false);
        setPlaybackPositionMs(0);
        return;
      }
      setPreviewPath(result.filePath);
      setPhase('preview');
      setIsPlayingPreview(false);
      setPlaybackPositionMs(0);
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotStopRecording,
        getVoiceRecordingErrorMessage(error),
      );
      setPhase('idle');
      setDurationMs(0);
      durationMsRef.current = 0;
    }
  }, [onBeginPreview, useExternalPreview]);

  useEffect(() => {
    stopRecordingRef.current = async () => {
      if (phaseRef.current !== 'recording') {
        return;
      }
      await handleStopRecording();
    };
  }, [handleStopRecording]);

  const playbackProgress =
    phase === 'preview' && durationMs > 0
      ? Math.min(1, playbackPositionMs / durationMs)
      : 0;
  const timerMs =
    phase === 'preview'
      ? isPlayingPreview || playbackPositionMs > 0
        ? playbackPositionMs
        : durationMs
      : durationMs;

  const handleStartRecording = useCallback(
    async (options?: { showErrorAlert?: boolean }) => {
      const session = recorderRef.current;
      if (!session || !aliveRef.current || !visibleRef.current) {
        return false;
      }
      const showErrorAlert = options?.showErrorAlert ?? true;
      try {
        setAutoStartFailed(false);
        setManualStartOnly(false);
        setPreviewPath(null);
        setIsPlayingPreview(false);
        paintDurationRef.current.cancel();
        setDurationMs(0);
        durationMsRef.current = 0;
        liveLevelRef.current = 0.04;
        setPlaybackPositionMs(0);
        recordingActiveRef.current = true;
        await session.startRecording();
        if (!aliveRef.current || !visibleRef.current) {
          recordingActiveRef.current = false;
          try {
            await session.discardRecording();
          } catch {
            // Not recording.
          }
          return false;
        }
        setPhase('recording');
        return true;
      } catch (error) {
        recordingActiveRef.current = false;
        if (!aliveRef.current) {
          return false;
        }
        setAutoStartFailed(true);
        if (showErrorAlert) {
          Alert.alert(
            APP_COPY.alerts.couldNotStartRecording,
            getVoiceRecordingErrorMessage(error),
          );
        }
        return false;
      }
    },
    [],
  );

  const startRecordingRef = useRef(handleStartRecording);
  const autoStartAttemptedRef = useRef(false);

  useEffect(() => {
    startRecordingRef.current = handleStartRecording;
  }, [handleStartRecording]);

  useEffect(() => {
    if (!visible) {
      autoStartAttemptedRef.current = false;
      setManualStartOnly(false);
    }
  }, [visible]);

  const tryAutoStartRecording = useCallback(() => {
    if (
      !visible ||
      !startRecordingOnOpen ||
      !canAutoStart ||
      autoStartAttemptedRef.current
    ) {
      return;
    }
    if (phaseRef.current !== 'idle') {
      return;
    }
    autoStartAttemptedRef.current = true;
    void startRecordingRef.current();
  }, [canAutoStart, startRecordingOnOpen, visible]);

  const handleTogglePreview = async () => {
    if (!previewPath || !recorderRef.current) {
      return;
    }
    try {
      if (isPlayingPreview) {
        await recorderRef.current.pausePreview();
        setIsPlayingPreview(false);
        return;
      }
      if (playbackPositionMs >= durationMs - 80) {
        setPlaybackPositionMs(0);
      }
      await recorderRef.current.startPreview(previewPath);
      setIsPlayingPreview(true);
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotPlayRecording,
        getVoiceRecordingErrorMessage(error),
      );
    }
  };

  const handleSave = async () => {
    if (!previewPath || phase === 'saving' || !recorderRef.current) {
      return;
    }
    setPhase('saving');
    try {
      await recorderRef.current.stopPreview();
      if (saveTarget === 'diary' || saveTarget === 'photo') {
        onDiaryAttach?.({ uri: previewPath, durationMs });
        setPreviewPath(null);
        setPhase('idle');
        setDurationMs(0);
        setIsPlayingPreview(false);
        onClose();
        return;
      }
      await saveVoiceMoment(previewPath, durationMs, noteText);
      setPreviewPath(null);
      await onSaved();
      setPhase('idle');
      setDurationMs(0);
      setIsPlayingPreview(false);
      onClose();
    } catch (error) {
      setPhase('preview');
      Alert.alert(APP_COPY.alerts.couldNotSaveVoiceMemo, errorMessageOr(error));
    }
  };

  const durationLabel = formatVoiceDurationMs(timerMs);
  const capLabel = formatVoiceDurationCap();
  const saveActionLabel =
    saveTarget === 'diary'
      ? 'Add to diary'
      : saveTarget === 'photo'
      ? 'Add to photo'
      : 'Save moment';
  const previewHint =
    saveTarget === 'diary'
      ? 'Preview your memo, then add it to this diary entry.'
      : saveTarget === 'photo'
      ? 'Preview your memo, then add it to this photo.'
      : 'Preview your memo, then save it.';
  const idleHint =
    saveTarget === 'diary'
      ? `Record up to ${capLabel} for this diary entry.`
      : saveTarget === 'photo'
      ? `Record up to ${capLabel} for this photo.`
      : `Record up to ${capLabel} and save to your day.`;

  const handleAnimate = useCallback(
    (_fromIndex: number, toIndex: number) => {
      if (toIndex >= 0) {
        void tryAutoStartRecording();
      }
    },
    [tryAutoStartRecording],
  );

  const useFixedSnapPoints = snapPoints != null && snapPoints.length > 0;

  useEffect(() => {
    if (visible && (instantPresent || embedded)) {
      void tryAutoStartRecording();
    }
  }, [embedded, instantPresent, tryAutoStartRecording, visible]);

  useEffect(() => {
    if (!visible || restartNonce === 0) {
      return;
    }
    autoStartAttemptedRef.current = true;
    setAutoStartFailed(false);
    setManualStartOnly(true);
    recordingActiveRef.current = false;
    paintDurationRef.current.cancel();
    setPhase('idle');
    setDurationMs(0);
    durationMsRef.current = 0;
    setIsPlayingPreview(false);
    setPlaybackPositionMs(0);
    liveLevelRef.current = 0.04;
  }, [restartNonce, visible]);

  const NoteInput = embedded ? TextInput : BottomSheetTextInput;

  const showNoteInput =
    phase === 'preview' && saveTarget === 'moment' && !useExternalPreview;
  const noteEditingActive = showNoteInput && (noteFocused || keyboardVisible);

  const handleBackdropPress = useCallback(() => {
    if (noteEditingActive) {
      restoreSheetAfterKeyboardRef.current = true;
      Keyboard.dismiss();
      setNoteFocused(false);
      return true;
    }
    if (phaseRef.current === 'preview' && previewPathRef.current) {
      promptDiscardOnClose();
      return true;
    }
    return false;
  }, [noteEditingActive, promptDiscardOnClose]);

  const sheetBody = (
    <>
      <Text variant="h4" className="border-0 pb-0">
        Voice memo
      </Text>
      <Text variant="muted" className="mt-1 text-sm">
        {phase === 'recording'
          ? `Recording… max ${capLabel}`
          : phase === 'preview'
          ? previewHint
          : idleHint}
      </Text>

      <View style={styles.timerRow}>
        <Text className="text-3xl font-semibold tabular-nums">
          {durationLabel}
        </Text>
        {phase === 'recording' ? (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text className="text-sm font-medium">Recording</Text>
          </View>
        ) : null}
        {isVoiceDurationAtCap(durationMs) && phase !== 'idle' ? (
          <Text variant="muted" className="text-xs">
            Max length reached
          </Text>
        ) : null}
      </View>

      <View style={styles.meterSlot}>
        {phase === 'recording' ? (
          <VoiceLiveMeter
            levelRef={liveLevelRef}
            accentColor={VOICE_RECORD_RED}
          />
        ) : null}

        {phase === 'preview' && !useExternalPreview ? (
          <VoicePlaybackMeter
            progress={playbackProgress}
            isPlaying={isPlayingPreview}
            accentColor={VOICE_RECORD_RED}
          />
        ) : null}
      </View>

      <View style={styles.controls}>
        {phase === 'idle' ? (
          <View style={styles.manualStartBlock}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start recording"
              disabled={
                startRecordingOnOpen && !autoStartFailed && !manualStartOnly
              }
              onPress={() => void handleStartRecording()}
              style={styles.recordButton}
            >
              <View style={styles.recordInner} />
            </Pressable>
            <View style={styles.controlCaption}>
              {!startRecordingOnOpen ||
              autoStartFailed ||
              manualStartOnly ? (
                <Text variant="muted" className="text-xs text-center">
                  Tap to record
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {phase === 'recording' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop recording"
            onPress={() => void handleStopRecording()}
            style={styles.stopButton}
          >
            <View style={styles.stopSquare} />
          </Pressable>
        ) : null}

        {phase === 'preview' && !useExternalPreview ? (
          <View style={styles.previewRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isPlayingPreview ? 'Pause preview' : 'Play preview'
              }
              onPress={() => void handleTogglePreview()}
              style={[
                styles.secondaryCircle,
                { backgroundColor: voiceTheme.badgeBg },
              ]}
            >
              {isPlayingPreview ? (
                <Pause size={22} color={voiceTheme.icon} strokeWidth={2.25} />
              ) : (
                <Play size={22} color={voiceTheme.icon} strokeWidth={2.25} />
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save voice memo"
              onPress={() => void handleSave()}
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
            >
              <AudioLines
                size={18}
                color={colors.primaryForeground}
                strokeWidth={2.25}
              />
              <Text className="text-primary-foreground font-medium">
                {saveActionLabel}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'saving' ? (
          <View style={styles.savingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text variant="muted">Saving voice memo…</Text>
          </View>
        ) : null}
      </View>

      {showNoteInput ? (
        <NoteInput
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Add a note about this recording (optional)"
          placeholderTextColor="#9CA3AF"
          style={styles.noteInput}
          multiline
          maxLength={280}
          editable={phase === 'preview'}
          onFocus={() => setNoteFocused(true)}
          onBlur={() => {
            setNoteFocused(false);
            if (!embedded) {
              sheetRef.current?.snapToIndex(0);
            }
          }}
        />
      ) : null}
    </>
  );

  if (embedded) {
    if (!visible) {
      return null;
    }
    return (
      <View
        style={[
          styles.embeddedRoot,
          {
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        {sheetBody}
      </View>
    );
  }

  return (
    <AppBottomSheet
      visible={visible}
      onClose={closeSheet}
      onAnimate={handleAnimate}
      onClosing={onWillClose}
      closeOnAnimateOut={onWillClose != null}
      instantPresent={instantPresent}
      enableDynamicSizing={!useFixedSnapPoints}
      snapPoints={useFixedSnapPoints ? snapPoints : undefined}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="none"
      bottomSheetRef={sheetRef}
      onBackdropPress={handleBackdropPress}
      enablePanDownToClose={!noteEditingActive && phase !== 'preview'}
    >
      {sheetBody}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  embeddedRoot: {
    flex: 1,
    paddingHorizontal: BOTTOM_SHEET_SURFACE.contentPaddingHorizontal,
    paddingTop: BOTTOM_SHEET_SURFACE.contentPaddingTop,
    minHeight: 0,
  },
  timerRow: {
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    marginBottom: 4,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: VOICE_RECORD_RED,
  },
  meterSlot: {
    minHeight: 28,
    justifyContent: 'center',
    marginBottom: 2,
  },
  controls: {
    alignItems: 'center',
    minHeight: 88,
    justifyContent: 'center',
  },
  manualStartBlock: {
    alignItems: 'center',
    gap: 8,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
  },
  recordInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: VOICE_RECORD_RED,
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
  },
  stopSquare: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: VOICE_RECORD_RED,
  },
  controlCaption: {
    minHeight: 16,
    justifyContent: 'center',
  },
  secondaryCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noteInput: {
    marginTop: 16,
    minHeight: 44,
    maxHeight: 96,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 20,
    color: '#111827',
    textAlignVertical: 'top',
  },
});
