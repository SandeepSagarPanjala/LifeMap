import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { AudioLines, Pause, Play, X } from 'lucide-react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { VoicePlaybackMeter } from '@/components/voice/VoiceMeter';
import { Text } from '@/components/ui/text';
import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import { saveVoiceMoment } from '@/lib/moments/capture-voice';
import { formatVoiceDurationMs } from '@/lib/moments/format-voice-duration';
import { throttleVoiceUi } from '@/lib/moments/voice-waveform';
import {
  createVoiceRecorderSession,
  getVoiceRecordingErrorMessage,
} from '@/lib/moments/voice-recorder';

export type VoiceMemoPreviewDraft = {
  path: string;
  durationMs: number;
};

type VoiceMemoPreviewSheetProps = {
  draft: VoiceMemoPreviewDraft | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

/** Gorhom overlay for voice preview + optional note after recording. */
export function VoiceMemoPreviewSheet({
  draft,
  onClose,
  onSaved,
}: VoiceMemoPreviewSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const noteInputRef = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);

  const [noteText, setNoteText] = useState('');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<ReturnType<
    typeof createVoiceRecorderSession
  > | null>(null);
  const draftRef = useRef(draft);
  const paintPlaybackRef = useRef<(ms: number) => void>(() => {});

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (draft == null) {
      setNoteText('');
      setIsPlayingPreview(false);
      setPlaybackPositionMs(0);
      setSaving(false);
      void recorderRef.current?.stopPreview();
      return;
    }
    setNoteText('');
    setIsPlayingPreview(false);
    setPlaybackPositionMs(0);
    setSaving(false);
  }, [draft]);

  useEffect(() => {
    paintPlaybackRef.current = throttleVoiceUi((ms: number) => {
      setPlaybackPositionMs(ms);
    }, 150);
  }, []);

  useEffect(() => {
    const session = createVoiceRecorderSession({
      onPlaybackProgress: (positionMs, totalMs) => {
        paintPlaybackRef.current(positionMs);
        if (totalMs > 0 && positionMs >= totalMs - 80) {
          setIsPlayingPreview(false);
        }
      },
      onPlaybackEnded: () => {
        setIsPlayingPreview(false);
        if (draftRef.current != null) {
          setPlaybackPositionMs(draftRef.current.durationMs);
        }
      },
    });
    recorderRef.current = session;
    return () => {
      session.dispose();
    };
  }, []);

  const restoreSheetHeight = useCallback(() => {
    // Dynamic-sizing sheets keep the keyboard-expanded height unless we nudge
    // Gorhom to remeasure after the keyboard is gone.
    requestAnimationFrame(() => {
      setTimeout(() => {
        sheetRef.current?.snapToIndex(0);
      }, Platform.OS === 'ios' ? 40 : 0);
    });
  }, []);

  const dismissKeyboard = useCallback(() => {
    noteInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  useEffect(() => {
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const hideSub = Keyboard.addListener(hideEvent, () => {
      restoreSheetHeight();
    });
    return () => {
      hideSub.remove();
    };
  }, [restoreSheetHeight]);

  const discardDraft = useCallback(async () => {
    const path = draftRef.current?.path;
    await recorderRef.current?.stopPreview();
    if (path != null) {
      await recorderRef.current?.discardRecording(path);
    }
    setIsPlayingPreview(false);
    setPlaybackPositionMs(0);
    setNoteText('');
  }, []);

  const requestClose = useCallback(() => {
    dismissKeyboard();
    sheetRef.current?.dismiss();
  }, [dismissKeyboard]);

  const handleDismissed = useCallback(() => {
    dismissKeyboard();
    void discardDraft();
    onClose();
  }, [discardDraft, dismissKeyboard, onClose]);

  const promptDiscardOnClose = useCallback(() => {
    Alert.alert('Discard voice memo?', 'This recording will be deleted.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          requestClose();
        },
      },
    ]);
  }, [requestClose]);

  const handleBackdropPress = useCallback(() => {
    if (draftRef.current == null) {
      return false;
    }
    promptDiscardOnClose();
    return true;
  }, [promptDiscardOnClose]);

  const handleTogglePreview = async () => {
    const current = draftRef.current;
    if (current == null || recorderRef.current == null) {
      return;
    }
    try {
      if (isPlayingPreview) {
        await recorderRef.current.pausePreview();
        setIsPlayingPreview(false);
        return;
      }
      if (playbackPositionMs >= current.durationMs - 80) {
        setPlaybackPositionMs(0);
      }
      await recorderRef.current.startPreview(current.path);
      setIsPlayingPreview(true);
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotPlayRecording,
        getVoiceRecordingErrorMessage(error),
      );
    }
  };

  const handleSave = async () => {
    const current = draftRef.current;
    if (current == null || saving || recorderRef.current == null) {
      return;
    }
    setSaving(true);
    try {
      await recorderRef.current.stopPreview();
      await saveVoiceMoment(current.path, current.durationMs, noteText);
      draftRef.current = null;
      await onSaved();
      requestClose();
    } catch (error) {
      Alert.alert(APP_COPY.alerts.couldNotSaveVoiceMemo, errorMessageOr(error));
    } finally {
      setSaving(false);
    }
  };

  const durationMs = draft?.durationMs ?? 0;
  const timerMs =
    isPlayingPreview || playbackPositionMs > 0
      ? playbackPositionMs
      : durationMs;
  const playbackProgress =
    durationMs > 0 ? Math.min(1, playbackPositionMs / durationMs) : 0;

  const barBottomPad = Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP);

  return (
    <View
      style={styles.host}
      pointerEvents={draft != null ? 'box-none' : 'none'}
    >
      <BottomSheetModalProvider>
        <AppBottomSheet
          name="voice-memo-preview"
          visible={draft != null}
          bottomSheetRef={sheetRef}
          onClose={handleDismissed}
          onClosing={dismissKeyboard}
          onBackdropPress={handleBackdropPress}
          instantPresent
          stackBehavior="push"
          releaseTouchesWhileClosing
          enableDynamicSizing
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          enableBlurKeyboardOnGesture={false}
          dismissKeyboardOnClose
          enablePanDownToClose={false}
        >
          {draft != null ? (
            <View style={[styles.body, { paddingBottom: barBottomPad }]}>
              <Text variant="h4" className="border-0 pb-0">
                Voice memo
              </Text>
              <Text variant="muted" className="mt-1 text-sm">
                Preview your memo, then save it.
              </Text>

              <View style={styles.timerRow}>
                <Text className="text-3xl font-semibold tabular-nums">
                  {formatVoiceDurationMs(timerMs)}
                </Text>
              </View>

              <VoicePlaybackMeter
                progress={playbackProgress}
                isPlaying={isPlayingPreview}
                accentColor="#FF9500"
              />

              <BottomSheetTextInput
                ref={noteInputRef}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Add a note about this recording (optional)"
                placeholderTextColor="#9CA3AF"
                style={styles.noteInput}
                multiline
                maxLength={280}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={() => {
                  dismissKeyboard();
                  restoreSheetHeight();
                }}
              />

              <View style={styles.barRow}>
                <MapGlassCircleButton
                  accessibilityLabel={
                    isPlayingPreview ? 'Pause preview' : 'Play preview'
                  }
                  onPress={() => {
                    void handleTogglePreview();
                  }}
                  disabled={saving}
                  style={styles.sideButton}
                >
                  {isPlayingPreview ? (
                    <Pause size={20} color={colors.primary} strokeWidth={2.25} />
                  ) : (
                    <Play size={20} color={colors.primary} strokeWidth={2.25} />
                  )}
                </MapGlassCircleButton>

                <View style={styles.shadowWrap}>
                  <AdaptiveGlassSurface style={styles.pill}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Save voice memo"
                      disabled={saving}
                      onPress={() => {
                        void handleSave();
                      }}
                      style={[
                        styles.savePressable,
                        saving ? styles.saveDisabled : null,
                      ]}
                    >
                      {saving ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <>
                          <AudioLines
                            size={16}
                            color={colors.primary}
                            strokeWidth={2.25}
                          />
                          <Text
                            style={[
                              styles.saveLabel,
                              { color: colors.primary },
                            ]}
                          >
                            Save
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </AdaptiveGlassSurface>
                </View>

                <MapGlassCircleButton
                  accessibilityLabel="Close"
                  onPress={requestClose}
                  disabled={saving}
                  style={styles.sideButton}
                >
                  <X size={20} color={colors.primary} strokeWidth={2.25} />
                </MapGlassCircleButton>
              </View>
            </View>
          ) : null}
        </AppBottomSheet>
      </BottomSheetModalProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
  },
  body: {
    gap: 0,
  },
  timerRow: {
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 12,
  },
  noteInput: {
    marginTop: 16,
    marginBottom: 16,
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
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: MAP_MOMENTS_SIDE_BTN_GAP,
  },
  shadowWrap: {
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
    }),
  },
  pill: {
    height: MAP_MOMENTS_BAR_HEIGHT,
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  savePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: MAP_MOMENTS_BAR_HEIGHT,
    paddingHorizontal: 18,
    minWidth: 96,
  },
  saveDisabled: {
    opacity: 0.4,
  },
  saveLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  sideButton: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
  },
});
