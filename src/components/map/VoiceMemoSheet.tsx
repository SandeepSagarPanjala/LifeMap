import {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {AudioLines, Mic, Pause, Play, Square} from 'lucide-react-native';

import {CAPTURE_BUTTON_THEMES} from '@/components/map/map-capture-button-theme';
import {VoiceLiveMeter, VoicePlaybackMeter} from '@/components/voice/VoiceMeter';
import {Text} from '@/components/ui/text';
import {AppBottomSheet} from '@/components/ui/app-bottom-sheet';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  formatVoiceDurationCap,
  formatVoiceDurationMs,
  isVoiceDurationAtCap,
} from '@/lib/moments/format-voice-duration';
import {saveVoiceMoment} from '@/lib/moments/capture-voice';
import {normalizeVoiceMetering, throttleVoiceUi} from '@/lib/moments/voice-waveform';
import {
  createVoiceRecorderSession,
  getVoiceRecordingErrorMessage,
} from '@/lib/moments/voice-recorder';

type VoiceMemoPhase = 'idle' | 'recording' | 'preview' | 'saving';

export type VoiceMemoSaveTarget = 'moment' | 'diary';

type VoiceMemoSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  saveTarget?: VoiceMemoSaveTarget;
  onDiaryAttach?: (attachment: {uri: string; durationMs: number}) => void;
  onWillClose?: () => void;
};

export function VoiceMemoSheet({
  visible,
  onClose,
  onSaved,
  saveTarget = 'moment',
  onDiaryAttach,
  onWillClose,
}: VoiceMemoSheetProps) {
  const colors = useThemeColors();
  const voiceTheme = CAPTURE_BUTTON_THEMES.voice;

  const [phase, setPhase] = useState<VoiceMemoPhase>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [liveLevel, setLiveLevel] = useState(0.12);
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);

  const recorderRef = useRef(createVoiceRecorderSession());
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});
  const durationMsRef = useRef(0);
  const previewPathRef = useRef<string | null>(null);
  const phaseRef = useRef<VoiceMemoPhase>('idle');

  const paintDurationRef = useRef<(ms: number) => void>(() => {});
  const paintLiveLevelRef = useRef<(level: number) => void>(() => {});
  const paintPlaybackRef = useRef<(ms: number) => void>(() => {});

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
    paintDurationRef.current = throttleVoiceUi((ms: number) => {
      setDurationMs(ms);
    }, 250);
    paintLiveLevelRef.current = throttleVoiceUi((level: number) => {
      setLiveLevel(level);
    }, 120);
    paintPlaybackRef.current = throttleVoiceUi((ms: number) => {
      setPlaybackPositionMs(ms);
    }, 150);
  }, []);

  const resetDraft = useCallback(async () => {
    await recorderRef.current.stopPreview();
    await recorderRef.current.discardRecording(previewPathRef.current);
    setPhase('idle');
    setDurationMs(0);
    setPreviewPath(null);
    setIsPlayingPreview(false);
    setLiveLevel(0.12);
    setPlaybackPositionMs(0);
    durationMsRef.current = 0;
  }, []);

  const closeSheet = useCallback(() => {
    if (phaseRef.current === 'saving') {
      return;
    }
    void resetDraft().finally(onClose);
  }, [onClose, resetDraft]);

  useEffect(() => {
    if (!visible) {
      void resetDraft();
    }
  }, [resetDraft, visible]);

  useEffect(() => {
    const session = createVoiceRecorderSession({
      onDurationMs: ms => {
        durationMsRef.current = ms;
        paintDurationRef.current(ms);
      },
      onMaxDurationReached: () => {
        void stopRecordingRef.current();
      },
      onMetering: meteringDb => {
        paintLiveLevelRef.current(normalizeVoiceMetering(meteringDb));
      },
      onPlaybackProgress: (positionMs, totalMs) => {
        paintPlaybackRef.current(positionMs);
        if (totalMs > 0 && positionMs >= totalMs - 80) {
          setIsPlayingPreview(false);
        }
      },
      onPlaybackEnded: () => {
        setIsPlayingPreview(false);
        setPlaybackPositionMs(durationMsRef.current);
      },
    });
    recorderRef.current = session;
    return () => {
      session.dispose();
    };
  }, []);

  const handleStopRecording = useCallback(async () => {
    try {
      const result = await recorderRef.current.stopRecording();
      setDurationMs(result.durationMs);
      durationMsRef.current = result.durationMs;
      if (result.durationMs < 500) {
        await recorderRef.current.discardRecording(result.filePath);
        setPhase('idle');
        setDurationMs(0);
        durationMsRef.current = 0;
        Alert.alert('Recording too short', 'Hold the mic for at least half a second.');
        return;
      }
      setPreviewPath(result.filePath);
      setPhase('preview');
      setIsPlayingPreview(false);
      setPlaybackPositionMs(0);
    } catch (error) {
      Alert.alert('Could not stop recording', getVoiceRecordingErrorMessage(error));
      setPhase('idle');
    }
  }, []);

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

  const handleStartRecording = async () => {
    try {
      setPreviewPath(null);
      setIsPlayingPreview(false);
      setDurationMs(0);
      durationMsRef.current = 0;
      setLiveLevel(0.12);
      setPlaybackPositionMs(0);
      await recorderRef.current.startRecording();
      setPhase('recording');
    } catch (error) {
      Alert.alert('Could not start recording', getVoiceRecordingErrorMessage(error));
    }
  };

  const handleTogglePreview = async () => {
    if (!previewPath) {
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
      Alert.alert('Could not play recording', getVoiceRecordingErrorMessage(error));
    }
  };

  const handleDiscard = () => {
    Alert.alert('Discard voice memo?', 'This recording will be deleted.', [
      {text: 'Keep editing', style: 'cancel'},
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          void resetDraft();
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!previewPath || phase === 'saving') {
      return;
    }
    setPhase('saving');
    try {
      await recorderRef.current.stopPreview();
      if (saveTarget === 'diary') {
        onDiaryAttach?.({uri: previewPath, durationMs});
        setPreviewPath(null);
        setPhase('idle');
        setDurationMs(0);
        setIsPlayingPreview(false);
        onClose();
        return;
      }
      await saveVoiceMoment(previewPath, durationMs);
      setPreviewPath(null);
      await onSaved();
      setPhase('idle');
      setDurationMs(0);
      setIsPlayingPreview(false);
      onClose();
    } catch (error) {
      setPhase('preview');
      Alert.alert(
        'Could not save voice memo',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    }
  };

  const durationLabel = formatVoiceDurationMs(timerMs);
  const capLabel = formatVoiceDurationCap();
  const isDiaryAttach = saveTarget === 'diary';

  const handleAnimate = useCallback(
    (_fromIndex: number, toIndex: number) => {
      if (toIndex === -1) {
        onWillClose?.();
      }
    },
    [onWillClose],
  );

  return (
    <AppBottomSheet
      visible={visible}
      onClose={closeSheet}
      onAnimate={handleAnimate}
      enableDynamicSizing>
      <Text variant="h4" className="border-0 pb-0">
        Voice memo
      </Text>
      <Text variant="muted" className="mt-1 text-sm">
        {phase === 'recording'
          ? `Recording… max ${capLabel}`
          : phase === 'preview'
            ? saveTarget === 'diary'
              ? 'Preview your memo, then add it to this diary entry.'
              : 'Preview your memo, then save or discard.'
            : `Record up to ${capLabel} and save to your day.`}
      </Text>

      <View style={styles.timerRow}>
        <Text className="text-3xl font-semibold tabular-nums">{durationLabel}</Text>
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

      {phase === 'recording' ? (
        <VoiceLiveMeter level={liveLevel} accentColor="#FF9500" />
      ) : null}

      {phase === 'preview' ? (
        <VoicePlaybackMeter
          progress={playbackProgress}
          isPlaying={isPlayingPreview}
          accentColor="#FF9500"
        />
      ) : null}

      <View style={styles.controls}>
        {phase === 'idle' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start recording"
            onPress={() => void handleStartRecording()}
            style={[styles.primaryCircle, {backgroundColor: voiceTheme.badgeBg}]}>
            <Mic size={28} color={voiceTheme.icon} strokeWidth={2.25} />
          </Pressable>
        ) : null}

        {phase === 'recording' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop recording"
            onPress={() => void handleStopRecording()}
            style={[styles.primaryCircle, {backgroundColor: voiceTheme.badgeBg}]}>
            <Square
              size={24}
              color={voiceTheme.icon}
              strokeWidth={2.25}
              fill={voiceTheme.icon}
            />
          </Pressable>
        ) : null}

        {phase === 'preview' ? (
          <View style={styles.previewRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPlayingPreview ? 'Pause preview' : 'Play preview'}
              onPress={() => void handleTogglePreview()}
              style={[styles.secondaryCircle, {backgroundColor: voiceTheme.badgeBg}]}>
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
              style={[styles.saveButton, {backgroundColor: colors.primary}]}>
              <AudioLines size={18} color={colors.primaryForeground} strokeWidth={2.25} />
              <Text className="text-primary-foreground font-medium">
                {saveTarget === 'diary' ? 'Add to diary' : 'Save moment'}
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

      {phase === 'preview' && !isDiaryAttach ? (
        <View style={styles.footerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Discard recording"
            onPress={handleDiscard}
            style={styles.discardButton}>
            <Text className="text-sm font-medium text-red-500">Discard</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={closeSheet}>
            <Text variant="muted" className="text-sm">
              Cancel
            </Text>
          </Pressable>
        </View>
      ) : phase !== 'preview' && !isDiaryAttach ? (
        <Pressable accessibilityRole="button" onPress={closeSheet} style={styles.cancelOnly}>
          <Text variant="muted" className="text-sm">
            Cancel
          </Text>
        </Pressable>
      ) : null}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  timerRow: {
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
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
    backgroundColor: '#EF4444',
  },
  controls: {
    alignItems: 'center',
    minHeight: 96,
    justifyContent: 'center',
  },
  primaryCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
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
  footerActions: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  discardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelOnly: {
    marginTop: 8,
    alignSelf: 'center',
  },
});
