import {useCallback, useEffect, useRef, useState, type ComponentRef} from 'react';
import {Alert, Keyboard, Pressable, StyleSheet, View} from 'react-native';
import {AudioLines, Pause, Play} from 'lucide-react-native';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import {BottomSheetTextInput} from '@gorhom/bottom-sheet';
import type {BottomSheetModal} from '@gorhom/bottom-sheet';

import {CAPTURE_BUTTON_THEMES} from '@/components/map/map-capture-button-theme';
import {VoicePlaybackMeter} from '@/components/voice/VoiceMeter';
import {Text} from '@/components/ui/text';
import {AppBottomSheet} from '@/components/ui/app-bottom-sheet';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {saveVoiceMoment} from '@/lib/moments/capture-voice';
import {formatVoiceDurationMs} from '@/lib/moments/format-voice-duration';
import {throttleVoiceUi} from '@/lib/moments/voice-waveform';
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
  const voiceTheme = CAPTURE_BUTTON_THEMES.voice;
  const sheetRef = useRef<BottomSheetModal>(null);
  const noteInputRef = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);

  const [noteText, setNoteText] = useState('');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<ReturnType<typeof createVoiceRecorderSession> | null>(null);
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

  const dismissKeyboard = useCallback(() => {
    noteInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

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
      {text: 'Keep editing', style: 'cancel'},
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
      Alert.alert('Could not play recording', getVoiceRecordingErrorMessage(error));
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
      Alert.alert(
        'Could not save voice memo',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setSaving(false);
    }
  };

  const durationMs = draft?.durationMs ?? 0;
  const timerMs =
    isPlayingPreview || playbackPositionMs > 0 ? playbackPositionMs : durationMs;
  const playbackProgress =
    durationMs > 0 ? Math.min(1, playbackPositionMs / durationMs) : 0;

  return (
    <View
      style={styles.host}
      pointerEvents={draft != null ? 'box-none' : 'none'}>
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
          keyboardBlurBehavior="none"
          enableBlurKeyboardOnGesture={false}
          dismissKeyboardOnClose
          enablePanDownToClose={false}>
          {draft != null ? (
            <View style={styles.body}>
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

              <View style={styles.controls}>
                {saving ? (
                  <Text variant="muted">Saving voice memo…</Text>
                ) : (
                  <View style={styles.previewRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        isPlayingPreview ? 'Pause preview' : 'Play preview'
                      }
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
                      <AudioLines
                        size={18}
                        color={colors.primaryForeground}
                        strokeWidth={2.25}
                      />
                      <Text className="text-primary-foreground font-medium">
                        Save moment
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <BottomSheetTextInput
                ref={noteInputRef}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Add a note about this recording (optional)"
                placeholderTextColor="#9CA3AF"
                style={styles.noteInput}
                multiline
                maxLength={280}
              />
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
  controls: {
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
    marginTop: 8,
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
  noteInput: {
    marginTop: 16,
    marginBottom: 8,
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
