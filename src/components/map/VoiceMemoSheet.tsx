import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {AudioLines, Mic, Pause, Play, Square, Trash2} from 'lucide-react-native';

import {CAPTURE_BUTTON_THEMES} from '@/components/map/map-capture-button-theme';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  formatVoiceDurationCap,
  formatVoiceDurationMs,
  isVoiceDurationAtCap,
} from '@/lib/moments/format-voice-duration';
import {saveVoiceMoment} from '@/lib/moments/capture-voice';
import {
  createVoiceRecorderSession,
  getVoiceRecordingErrorMessage,
} from '@/lib/moments/voice-recorder';

const SHEET_OFFSCREEN = 420;

type VoiceMemoPhase = 'idle' | 'recording' | 'preview' | 'saving';

type VoiceMemoSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function VoiceMemoSheet({visible, onClose, onSaved}: VoiceMemoSheetProps) {
  const colors = useThemeColors();
  const voiceTheme = CAPTURE_BUTTON_THEMES.voice;

  const [mounted, setMounted] = useState(visible);
  const [phase, setPhase] = useState<VoiceMemoPhase>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_OFFSCREEN)).current;
  const closingRef = useRef(false);
  const recorderRef = useRef(createVoiceRecorderSession());
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useLayoutEffect(() => {
    if (visible) {
      closingRef.current = false;
      setMounted(true);
    }
  }, [visible]);

  const resetDraft = useCallback(async () => {
    await recorderRef.current.stopPreview();
    await recorderRef.current.discardRecording(previewPath);
    setPhase('idle');
    setDurationMs(0);
    setPreviewPath(null);
    setIsPlayingPreview(false);
  }, [previewPath]);

  const animateIn = useCallback(() => {
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(SHEET_OFFSCREEN);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, sheetTranslateY]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: SHEET_OFFSCREEN,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({finished}) => {
        if (finished) {
          onDone();
        }
      });
    },
    [backdropOpacity, sheetTranslateY],
  );

  const closeSheet = useCallback(() => {
    if (closingRef.current || phase === 'saving') {
      return;
    }
    closingRef.current = true;
    void resetDraft().finally(() => {
      animateOut(() => {
        closingRef.current = false;
        setMounted(false);
        onClose();
      });
    });
  }, [animateOut, onClose, phase, resetDraft]);

  useEffect(() => {
    if (!visible && mounted && !closingRef.current) {
      closingRef.current = true;
      void resetDraft().finally(() => {
        animateOut(() => {
          closingRef.current = false;
          setMounted(false);
        });
      });
    }
  }, [animateOut, mounted, resetDraft, visible]);

  useEffect(() => {
    if (mounted && visible) {
      animateIn();
    }
  }, [animateIn, mounted, visible]);

  useEffect(() => {
    const session = createVoiceRecorderSession({
      onDurationMs: setDurationMs,
      onMaxDurationReached: () => {
        void stopRecordingRef.current();
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
      if (result.durationMs < 500) {
        await recorderRef.current.discardRecording(result.filePath);
        setPhase('idle');
        setDurationMs(0);
        Alert.alert('Recording too short', 'Hold the mic for at least half a second.');
        return;
      }
      setPreviewPath(result.filePath);
      setDurationMs(result.durationMs);
      setPhase('preview');
      setIsPlayingPreview(false);
    } catch (error) {
      Alert.alert('Could not stop recording', getVoiceRecordingErrorMessage(error));
      setPhase('idle');
    }
  }, []);

  useEffect(() => {
    stopRecordingRef.current = async () => {
      if (phase !== 'recording') {
        return;
      }
      await handleStopRecording();
    };
  }, [handleStopRecording, phase]);

  useEffect(() => {
    if (phase !== 'recording') {
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulseAnim]);

  const handleStartRecording = async () => {
    try {
      setPreviewPath(null);
      setIsPlayingPreview(false);
      setDurationMs(0);
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
      await saveVoiceMoment(previewPath, durationMs);
      setPreviewPath(null);
      await onSaved();
      closingRef.current = true;
      animateOut(() => {
        closingRef.current = false;
        setMounted(false);
        setPhase('idle');
        setDurationMs(0);
        setIsPlayingPreview(false);
        onClose();
      });
    } catch (error) {
      setPhase('preview');
      Alert.alert(
        'Could not save voice memo',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    }
  };

  if (!mounted) {
    return null;
  }

  const durationLabel = formatVoiceDurationMs(durationMs);
  const capLabel = formatVoiceDurationCap();

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeSheet}>
      <View style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, {opacity: backdropOpacity}]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close voice memo"
          style={styles.dismissTap}
          onPress={closeSheet}
        />

        <Animated.View
          style={[styles.sheet, {transform: [{translateY: sheetTranslateY}]}]}>
          <View style={styles.handle} />

          <Text variant="h4" className="border-0 pb-0">
            Voice memo
          </Text>
          <Text variant="muted" className="mt-1 text-sm">
            {phase === 'recording'
              ? `Recording… max ${capLabel}`
              : phase === 'preview'
                ? 'Preview your memo, then save or discard.'
                : `Record up to ${capLabel} and save to your day.`}
          </Text>

          <View style={styles.timerRow}>
            <Text className="text-3xl font-semibold tabular-nums">{durationLabel}</Text>
            {phase === 'recording' ? (
              <View style={styles.recordingBadge}>
                <Animated.View
                  style={[
                    styles.recordingDot,
                    {transform: [{scale: pulseAnim}]},
                  ]}
                />
                <Text className="text-sm font-medium">Recording</Text>
              </View>
            ) : null}
            {isVoiceDurationAtCap(durationMs) && phase !== 'idle' ? (
              <Text variant="muted" className="text-xs">
                Max length reached
              </Text>
            ) : null}
          </View>

          <View style={styles.controls}>
            {phase === 'idle' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start recording"
                onPress={() => void handleStartRecording()}
                style={[
                  styles.primaryCircle,
                  {backgroundColor: voiceTheme.badgeBg},
                ]}>
                <Mic size={28} color={voiceTheme.icon} strokeWidth={2.25} />
              </Pressable>
            ) : null}

            {phase === 'recording' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Stop recording"
                onPress={() => void handleStopRecording()}
                style={[
                  styles.primaryCircle,
                  {backgroundColor: voiceTheme.badgeBg},
                ]}>
                <Square size={24} color={voiceTheme.icon} strokeWidth={2.25} fill={voiceTheme.icon} />
              </Pressable>
            ) : null}

            {phase === 'preview' ? (
              <View style={styles.previewRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isPlayingPreview ? 'Pause preview' : 'Play preview'}
                  onPress={() => void handleTogglePreview()}
                  style={[
                    styles.secondaryCircle,
                    {backgroundColor: voiceTheme.badgeBg},
                  ]}>
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
                  <Text className="text-primary-foreground font-medium">Save moment</Text>
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

          {phase === 'preview' ? (
            <View style={styles.footerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Discard recording"
                onPress={handleDiscard}
                style={styles.discardButton}>
                <Trash2 size={16} color="#EF4444" strokeWidth={2.25} />
                <Text className="text-sm font-medium text-red-500">Discard</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={closeSheet}>
                <Text variant="muted" className="text-sm">
                  Cancel
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={closeSheet} style={styles.cancelOnly}>
              <Text variant="muted" className="text-sm">
                Cancel
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dismissTap: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    marginBottom: 16,
  },
  timerRow: {
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 20,
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
