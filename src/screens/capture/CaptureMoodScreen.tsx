import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AudioLines, Check, Pause, Play, Square, Type, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmotionTokenPickerPage } from '@/components/capture/EmotionTokenPickerSheet';
import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import {
  VoiceLiveMeter,
  VoicePlaybackMeter,
} from '@/components/voice/VoiceMeter';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { loadProfile } from '@/db/repositories/profile';
import { useDayMoments } from '@/hooks/use-day-moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MOOD_VOICE_MAX_DURATION_MS,
} from '@/lib/app-constants';
import { getTodayDateKey } from '@/lib/day-utils';
import { saveMoodMoment } from '@/lib/moments/capture-mood';
import {
  getEmotionToken,
  type EmotionSelection,
  type EmotionTokenId,
} from '@/lib/moments/emotion-tokens';
import {
  formatVoiceDurationCap,
  formatVoiceDurationMs,
} from '@/lib/moments/format-voice-duration';
import {
  getMoodArtPresentation,
  getMoodArtVariantsForGender,
  MAX_MOOD_REASON_LENGTH,
  MOOD_ART_VARIANT_SETTING_KEY,
  resolveMoodArtVariant,
  type MoodArtVariant,
} from '@/lib/moments/mood-art';
import {
  createVoiceRecorderSession,
  getVoiceRecordingErrorMessage,
  type VoiceRecorderSession,
} from '@/lib/moments/voice-recorder';
import {
  normalizeVoiceMetering,
  throttleVoiceUi,
  type ThrottledVoiceUiFn,
} from '@/lib/moments/voice-waveform';
import type { ProfileGender } from '@/lib/profile/types';
import { transcribeAudioFile } from '@/lib/speech/transcribe-audio';
import type { RootStackParamList } from '@/navigation/types';
import { useSheetCaptureClose } from '@/screens/sheets/use-sheet-capture-close';

type ReasonMode = 'none' | 'text' | 'voice';

const VOICE_RECORD_RED = '#FF3B30';

export function CaptureMoodScreen() {
  const colors = useThemeColors();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <CaptureMoodPanel />
    </View>
  );
}

function CaptureMoodPanel() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const closeScreen = useSheetCaptureClose();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { refreshDayMoments } = useDayMoments(getTodayDateKey());

  const [selectedEmotionId, setSelectedEmotionId] =
    useState<EmotionTokenId | null>(null);
  const [moodVariant, setMoodVariant] = useState<MoodArtVariant>('cat');
  const [profileGender, setProfileGender] = useState<ProfileGender | null>(null);
  const [mode, setMode] = useState<ReasonMode>('none');
  const [reasonText, setReasonText] = useState('');
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [voiceDurationMs, setVoiceDurationMs] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const recorderRef = useRef<VoiceRecorderSession | null>(null);
  const levelRef = useRef(0);
  const reasonInputRef = useRef<TextInput>(null);
  const voiceDurationMsRef = useRef(0);
  const paintPlaybackRef = useRef<ThrottledVoiceUiFn<(ms: number) => void>>(
    throttleVoiceUi(() => {}, 150),
  );

  const allowedVariants = getMoodArtVariantsForGender(profileGender);
  const selectedEmotion =
    selectedEmotionId != null ? getEmotionToken(selectedEmotionId) : null;
  const selectedArt =
    selectedEmotionId != null
      ? getMoodArtPresentation(selectedEmotionId, moodVariant)
      : null;
  const hasVoicePreview =
    mode === 'voice' && !recording && voiceUri != null && voiceDurationMs > 0;
  const playbackProgress =
    voiceDurationMs > 0
      ? Math.min(1, playbackPositionMs / voiceDurationMs)
      : 0;

  useEffect(() => {
    paintPlaybackRef.current = throttleVoiceUi((ms: number) => {
      setPlaybackPositionMs(ms);
    }, 150);
    return () => {
      paintPlaybackRef.current.cancel();
    };
  }, []);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadProfile(),
      getSetting(MOOD_ART_VARIANT_SETTING_KEY),
    ])
      .then(([profile, savedVariant]) => {
        if (cancelled) {
          return;
        }
        setProfileGender(profile.gender);
        setMoodVariant(resolveMoodArtVariant(profile.gender, savedVariant));
      })
      .catch(() => {
        if (!cancelled) {
          setMoodVariant('cat');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const disposeRecorder = useCallback(async () => {
    paintPlaybackRef.current.cancel();
    setIsPlayingPreview(false);
    setPlaybackPositionMs(0);
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder == null) {
      return;
    }
    try {
      await recorder.stopPreview();
    } catch {
      // Best effort.
    }
    try {
      await recorder.discardRecording();
    } catch {
      // Best effort while leaving the composer.
    }
    recorder.dispose();
  }, []);

  useEffect(
    () => () => {
      disposeRecorder().catch(() => undefined);
    },
    [disposeRecorder],
  );

  const resetReason = useCallback(async () => {
    Keyboard.dismiss();
    setMode('none');
    setReasonText('');
    setRecording(false);
    setRecordingMs(0);
    setVoiceUri(null);
    setVoiceDurationMs(0);
    voiceDurationMsRef.current = 0;
    setIsPlayingPreview(false);
    setPlaybackPositionMs(0);
    levelRef.current = 0;
    await disposeRecorder();
  }, [disposeRecorder]);

  const handleSelect = useCallback((selection: EmotionSelection) => {
    setSearchFocused(false);
    setSelectedEmotionId(selection.emotion.id);
    setMoodVariant(selection.variant);
    setSetting(MOOD_ART_VARIANT_SETTING_KEY, selection.variant).catch(
      () => undefined,
    );
  }, []);

  const handleVariantChange = useCallback((variant: MoodArtVariant) => {
    setMoodVariant(variant);
    setSetting(MOOD_ART_VARIANT_SETTING_KEY, variant).catch(() => undefined);
  }, []);

  const startRecording = useCallback(async () => {
    await disposeRecorder();
    setVoiceUri(null);
    setVoiceDurationMs(0);
    voiceDurationMsRef.current = 0;
    setRecordingMs(0);
    setIsPlayingPreview(false);
    setPlaybackPositionMs(0);
    levelRef.current = 0;

    const session = createVoiceRecorderSession({
      maxDurationMs: MOOD_VOICE_MAX_DURATION_MS,
      onDurationMs: setRecordingMs,
      onMetering: db => {
        levelRef.current = normalizeVoiceMetering(db);
      },
      onPlaybackProgress: (positionMs, totalMs) => {
        if (totalMs > 0) {
          voiceDurationMsRef.current = totalMs;
        }
        paintPlaybackRef.current(positionMs);
      },
      onPlaybackEnded: () => {
        paintPlaybackRef.current.cancel();
        setIsPlayingPreview(false);
        setPlaybackPositionMs(voiceDurationMsRef.current);
      },
      onMaxDurationReached: () => {
        session
          .stopRecording()
          .then(result => {
            setVoiceUri(result.filePath);
            setVoiceDurationMs(result.durationMs);
            voiceDurationMsRef.current = result.durationMs;
            setRecordingMs(result.durationMs);
            setRecording(false);
            setPlaybackPositionMs(0);
          })
          .catch(error => {
            setRecording(false);
            Alert.alert(
              APP_COPY.alerts.couldNotSaveMood,
              getVoiceRecordingErrorMessage(error),
            );
          });
      },
    });
    recorderRef.current = session;
    try {
      await session.startRecording();
      setRecording(true);
      setMode('voice');
    } catch (error) {
      recorderRef.current = null;
      session.dispose();
      Alert.alert(
        APP_COPY.alerts.couldNotSaveMood,
        getVoiceRecordingErrorMessage(error),
      );
    }
  }, [disposeRecorder]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (recorder == null) {
      return null;
    }
    try {
      const result = await recorder.stopRecording();
      setVoiceUri(result.filePath);
      setVoiceDurationMs(result.durationMs);
      voiceDurationMsRef.current = result.durationMs;
      setRecordingMs(result.durationMs);
      setRecording(false);
      setIsPlayingPreview(false);
      setPlaybackPositionMs(0);
      return result;
    } catch (error) {
      setRecording(false);
      Alert.alert(
        APP_COPY.alerts.couldNotSaveMood,
        getVoiceRecordingErrorMessage(error),
      );
      return null;
    }
  }, []);

  const togglePreview = useCallback(async () => {
    const recorder = recorderRef.current;
    const path = voiceUri;
    if (recorder == null || path == null) {
      return;
    }
    try {
      if (isPlayingPreview) {
        await recorder.pausePreview();
        setIsPlayingPreview(false);
        return;
      }
      if (playbackPositionMs >= voiceDurationMs - 80) {
        setPlaybackPositionMs(0);
      }
      await recorder.startPreview(path);
      setIsPlayingPreview(true);
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotPlayRecording,
        getVoiceRecordingErrorMessage(error),
      );
    }
  }, [isPlayingPreview, playbackPositionMs, voiceDurationMs, voiceUri]);

  const chooseText = useCallback(() => {
    Promise.resolve()
      .then(async () => {
        if (recording) {
          await stopRecording();
        }
        await disposeRecorder();
        setVoiceUri(null);
        setVoiceDurationMs(0);
        voiceDurationMsRef.current = 0;
        setMode('text');
        requestAnimationFrame(() => reasonInputRef.current?.focus());
      })
      .catch(() => undefined);
  }, [disposeRecorder, recording, stopRecording]);

  const chooseVoice = useCallback(() => {
    if (recording) {
      return;
    }
    Keyboard.dismiss();
    setReasonText('');
    setMode('voice');
    startRecording().catch(() => undefined);
  }, [recording, startRecording]);

  const handleLog = useCallback(() => {
    if (selectedEmotion == null || saving) {
      return;
    }
    setSaving(true);
    Promise.resolve()
      .then(async () => {
        if (mode === 'voice') {
          let uri = voiceUri;
          let durationMs = voiceDurationMs;
          if (recording) {
            const stopped = await stopRecording();
            if (stopped == null) {
              setSaving(false);
              return;
            }
            uri = stopped.filePath;
            durationMs = stopped.durationMs;
          }
          if (uri == null || durationMs < 500) {
            setSaving(false);
            Alert.alert(
              APP_COPY.alerts.couldNotSaveMood,
              APP_COPY.mood.voiceTooShort,
            );
            return;
          }
          try {
            await recorderRef.current?.stopPreview();
          } catch {
            // Preview may already be idle.
          }
          const transcript = await transcribeAudioFile(uri);
          await saveMoodMoment({
            moodLabel: selectedEmotion.label,
            moodVariant,
            voice: { uri, durationMs, transcript },
          });
        } else {
          await saveMoodMoment({
            moodLabel: selectedEmotion.label,
            moodVariant,
            moodReason: mode === 'text' ? reasonText : null,
          });
        }
        await refreshDayMoments();
        closeScreen();
      })
      .catch(error => {
        setSaving(false);
        Alert.alert(APP_COPY.alerts.couldNotSaveMood, errorMessageOr(error));
      });
  }, [
    closeScreen,
    mode,
    moodVariant,
    reasonText,
    recording,
    refreshDayMoments,
    saving,
    selectedEmotion,
    stopRecording,
    voiceDurationMs,
    voiceUri,
  ]);

  const dockPad =
    keyboardHeight > 0
      ? keyboardHeight + 8
      : Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP);

  return (
    <View style={styles.panel}>
      {selectedEmotion == null ? (
        <View
          style={[
            styles.pickerDock,
            searchFocused ? styles.pickerDockExpanded : null,
            searchFocused ? { paddingTop: Math.max(insets.top, 14) } : null,
          ]}
        >
          <EmotionTokenPickerPage
            selectedEmotionId={selectedEmotionId}
            selectedVariant={moodVariant}
            allowedVariants={allowedVariants}
            onSelect={handleSelect}
            onVariantChange={handleVariantChange}
            onClose={closeScreen}
            onInsights={() => navigation.navigate('MoodInsights')}
            onSearchFocus={() => setSearchFocused(true)}
            onSearchBlur={() => setSearchFocused(false)}
          />
        </View>
      ) : (
        <>
          <View
            style={[
              styles.reasonPage,
              {
                paddingBottom: dockPad + MAP_MOMENTS_BAR_HEIGHT + 12,
                paddingTop: Math.max(insets.top, 14),
                justifyContent: 'flex-end',
              },
            ]}
          >
            <GlassPressable
              accessibilityLabel="Change mood"
              onPress={() => {
                resetReason()
                  .then(() => setSelectedEmotionId(null))
                  .catch(() => undefined);
              }}
              style={styles.moodCardShadow}
            >
              <AdaptiveGlassSurface style={styles.moodCard}>
                <View
                  style={[
                    styles.art,
                    { backgroundColor: selectedEmotion.tint },
                  ]}
                >
                  <Image
                    source={selectedArt!.imageSource}
                    resizeMode="contain"
                    style={styles.artImage}
                  />
                </View>
                <View style={styles.moodCopy}>
                  <Text variant="h3" className="border-0 pb-0">
                    {selectedEmotion.label}
                  </Text>
                  <Text variant="muted" className="mt-1 text-sm">
                    Tap the mood to change it
                  </Text>
                </View>
              </AdaptiveGlassSurface>
            </GlassPressable>

            <View style={styles.reasonBody}>
              {mode === 'none' ? (
                <Text variant="muted" className="text-center">
                  Add an optional text or voice reason, then log your mood.
                </Text>
              ) : null}

              {mode === 'text' ? (
                <TextInput
                  ref={reasonInputRef}
                  value={reasonText}
                  onChangeText={value =>
                    setReasonText(value.slice(0, MAX_MOOD_REASON_LENGTH))
                  }
                  placeholder={APP_COPY.diary.moodReasonPlaceholder}
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  textAlignVertical="top"
                  maxLength={MAX_MOOD_REASON_LENGTH}
                  style={[
                    styles.reasonInput,
                    {
                      color: colors.foreground,
                      borderColor: colors.border,
                    },
                  ]}
                />
              ) : null}

              {mode === 'voice' ? (
                <View style={styles.voiceBlock}>
                  <View style={styles.timerRow}>
                    <Text
                      style={[styles.timer, { color: colors.foreground }]}
                    >
                      {formatVoiceDurationMs(
                        recording
                          ? recordingMs
                          : isPlayingPreview || playbackPositionMs > 0
                            ? playbackPositionMs
                            : voiceDurationMs,
                      )}
                    </Text>
                    <Text variant="muted" className="text-xs">
                      {recording
                        ? `${formatVoiceDurationCap(MOOD_VOICE_MAX_DURATION_MS)} max`
                        : 'Voice reason ready'}
                    </Text>
                  </View>
                  <View style={styles.meterSlot}>
                    {recording ? (
                      <VoiceLiveMeter
                        levelRef={levelRef}
                        accentColor={VOICE_RECORD_RED}
                      />
                    ) : null}
                    {hasVoicePreview ? (
                      <VoicePlaybackMeter
                        progress={playbackProgress}
                        isPlaying={isPlayingPreview}
                        accentColor={VOICE_RECORD_RED}
                      />
                    ) : null}
                  </View>
                  {recording ? (
                    <MapGlassCircleButton
                      accessibilityLabel="Stop recording"
                      onPress={() => {
                        stopRecording().catch(() => undefined);
                      }}
                      size={58}
                    >
                      <Square
                        size={18}
                        color={VOICE_RECORD_RED}
                        fill={VOICE_RECORD_RED}
                      />
                    </MapGlassCircleButton>
                  ) : null}
                  {hasVoicePreview ? (
                    <MapGlassCircleButton
                      accessibilityLabel={
                        isPlayingPreview ? 'Pause preview' : 'Play preview'
                      }
                      onPress={() => {
                        togglePreview().catch(() => undefined);
                      }}
                      size={58}
                    >
                      {isPlayingPreview ? (
                        <Pause
                          size={22}
                          color={colors.primary}
                          strokeWidth={2.25}
                        />
                      ) : (
                        <Play
                          size={22}
                          color={colors.primary}
                          strokeWidth={2.25}
                        />
                      )}
                    </MapGlassCircleButton>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View
            pointerEvents="box-none"
            style={[styles.barWrap, { paddingBottom: dockPad }]}
          >
            <View style={styles.barRow}>
              <MapGlassCircleButton
                accessibilityLabel={APP_COPY.mood.typeReason}
                onPress={chooseText}
              >
                <Type size={20} color={colors.primary} strokeWidth={2.25} />
              </MapGlassCircleButton>

              <MapGlassCircleButton
                accessibilityLabel={APP_COPY.mood.voiceReason}
                onPress={chooseVoice}
              >
                <AudioLines
                  size={20}
                  color={colors.primary}
                  strokeWidth={2.25}
                />
              </MapGlassCircleButton>

              <GlassPressable
                accessibilityLabel={APP_COPY.mood.log}
                disabled={saving}
                onPress={handleLog}
                style={styles.logShadow}
              >
                <AdaptiveGlassSurface style={styles.logPill}>
                  <View style={styles.logPressable}>
                    {saving ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <>
                        <Check
                          size={19}
                          color={colors.primary}
                          strokeWidth={2.5}
                        />
                        <Text
                          style={[styles.logLabel, { color: colors.primary }]}
                        >
                          {APP_COPY.mood.log}
                        </Text>
                      </>
                    )}
                  </View>
                </AdaptiveGlassSurface>
              </GlassPressable>

              <MapGlassCircleButton
                accessibilityLabel={APP_COPY.common.close}
                onPress={closeScreen}
              >
                <X size={20} color={colors.primary} strokeWidth={2.25} />
              </MapGlassCircleButton>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  panel: {
    flex: 1,
    minHeight: 0,
  },
  pickerDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },
  pickerDockExpanded: {
    height: '100%',
  },
  reasonPage: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 16,
  },
  moodCardShadow: {
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.13,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
  },
  moodCard: {
    minHeight: 96,
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  art: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artImage: {
    width: 60,
    height: 60,
  },
  moodCopy: {
    flex: 1,
    minWidth: 0,
  },
  reasonBody: {
    gap: 12,
    paddingBottom: 4,
  },
  reasonInput: {
    minHeight: 110,
    maxHeight: 180,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    lineHeight: 24,
  },
  voiceBlock: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  timerRow: {
    alignItems: 'center',
    gap: 4,
  },
  timer: {
    fontSize: 28,
    // Text's default `text-base` line height (24) clips 28pt digits.
    lineHeight: 36,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  meterSlot: {
    minHeight: 36,
    width: '100%',
    justifyContent: 'center',
  },
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MAP_MOMENTS_SIDE_BTN_GAP,
  },
  logShadow: {
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
    }),
  },
  logPill: {
    height: MAP_MOMENTS_BAR_HEIGHT,
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  logPressable: {
    height: MAP_MOMENTS_BAR_HEIGHT,
    minWidth: 112,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  logLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
