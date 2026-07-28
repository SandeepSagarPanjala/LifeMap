import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AudioLines,
  Camera,
  Check,
  ImageIcon,
  Pause,
  Play,
  Sparkles,
  X,
} from 'lucide-react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmotionTokenPickerSheet } from '@/components/capture/EmotionTokenPickerSheet';
import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { CAPTURE_BUTTON_THEMES } from '@/components/map/map-capture-button-theme';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { VoiceMemoSheet } from '@/components/map/VoiceMemoSheet';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  canSaveNoteDraft,
  isCaptureNoteDraftDirty,
  saveNoteMoment,
} from '@/lib/moments/capture-note';
import type { EmotionContextTokenId } from '@/lib/moments/emotion-context-tokens';
import { getEmotionContextToken } from '@/lib/moments/emotion-context-tokens';
import {
  formatEmotionMoodLabel,
  getEmotionToken,
  type EmotionTokenId,
} from '@/lib/moments/emotion-tokens';
import { formatVoiceDurationMs } from '@/lib/moments/format-voice-duration';
import { deleteMomentContentFile } from '@/lib/moments/moment-storage';
import {
  createVoiceRecorderSession,
  getVoiceRecordingErrorMessage,
} from '@/lib/moments/voice-recorder';
import {
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MAP_STACK_BUTTON_SIZE,
  MAX_NOTE_PHOTO_ATTACHMENTS,
} from '@/lib/app-constants';
import { type DraftNotePhoto } from '@/lib/moments/note-photo-attachments';
import {
  captureAndCompressNotePhoto,
  pickAndCompressNotePhotos,
} from '@/lib/moments/pick-note-photo';
import type { RootStackParamList } from '@/navigation/types';

/** Match MapMomentsGlassBar / LiquidGlassTabBar geometry. */
const TAB_SIZE = 44;
const ICON_SIZE = 20;
const H_PADDING = 4;

const KEYBOARD_TOOLBAR_GAP = 8;

type DiaryFocusField = 'title' | 'body';

export function CaptureNoteScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [voiceDurationMs, setVoiceDurationMs] = useState(0);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const voicePlayerRef = useRef(createVoiceRecorderSession());
  const openedAtRef = useRef(new Date());
  const titleInputRef = useRef<TextInput>(null);
  const bodyInputRef = useRef<TextInput>(null);
  const lastFocusedFieldRef = useRef<DiaryFocusField>('title');

  const [title, setTitle] = useState('');
  const [textBody, setTextBody] = useState('');
  const [selectedEmotionId, setSelectedEmotionId] =
    useState<EmotionTokenId | null>(null);
  const [selectedContextId, setSelectedContextId] =
    useState<EmotionContextTokenId | null>(null);
  const [emotionSheetOpen, setEmotionSheetOpen] = useState(false);
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);
  const [photos, setPhotos] = useState<DraftNotePhoto[]>([]);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [bottomDockHeight, setBottomDockHeight] = useState(0);

  const canSave = canSaveNoteDraft(title, textBody);
  const isDirty = isCaptureNoteDraftDirty({
    title,
    textBody,
    hasPhoto: photos.length > 0,
    hasVoice: voiceUri != null,
    hasEmotion: selectedEmotionId != null && selectedContextId != null,
  });

  const selectedEmotion =
    selectedEmotionId != null ? getEmotionToken(selectedEmotionId) : null;
  const selectedContext =
    selectedContextId != null
      ? getEmotionContextToken(selectedContextId)
      : null;

  const restoreDiaryFocus = useCallback(() => {
    if (lastFocusedFieldRef.current === 'body') {
      bodyInputRef.current?.focus();
      return;
    }
    titleInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => titleInputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const player = voicePlayerRef.current;
    return () => {
      void player.dispose();
    };
  }, []);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const clearVoice = async () => {
    await voicePlayerRef.current.stopPreview();
    setVoicePlaying(false);
    if (voiceUri) {
      await deleteMomentContentFile(voiceUri);
    }
    setVoiceUri(null);
    setVoiceDurationMs(0);
  };

  const toggleVoicePreview = async () => {
    if (!voiceUri) {
      return;
    }
    try {
      if (voicePlaying) {
        await voicePlayerRef.current.pausePreview();
        setVoicePlaying(false);
        return;
      }
      await voicePlayerRef.current.startPreview(voiceUri);
      setVoicePlaying(true);
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotPlayRecording,
        getVoiceRecordingErrorMessage(error),
      );
    }
  };

  const clearEmotion = () => {
    setSelectedEmotionId(null);
    setSelectedContextId(null);
  };

  const clearPhotos = async () => {
    await Promise.all(photos.map(photo => deleteMomentContentFile(photo.uri)));
    setPhotos([]);
  };

  const removePhoto = async (photoId: string) => {
    const photo = photos.find(item => item.id === photoId);
    if (!photo) {
      return;
    }
    await deleteMomentContentFile(photo.uri);
    setPhotos(current => current.filter(item => item.id !== photoId));
  };

  const handleBack = () => {
    if (!isDirty) {
      navigation.goBack();
      return;
    }

    Alert.alert('Discard this entry?', 'Your draft will be lost.', [
      { text: 'Keep writing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          void Promise.all([clearPhotos(), clearVoice()]).finally(() =>
            navigation.goBack(),
          );
        },
      },
    ]);
  };

  const attachPhotosFromLibrary = async () => {
    if (pickingPhoto) {
      return;
    }
    const remaining = MAX_NOTE_PHOTO_ATTACHMENTS - photos.length;
    if (remaining <= 0) {
      Alert.alert(
        'Photo limit reached',
        `You can attach up to ${MAX_NOTE_PHOTO_ATTACHMENTS} photos.`,
      );
      return;
    }
    setPickingPhoto(true);
    try {
      const picked = await pickAndCompressNotePhotos(remaining);
      if (picked.length === 0) {
        return;
      }
      setPhotos(current =>
        [
          ...current,
          ...picked.map(photo => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            uri: photo.uri,
            sourceBytes: photo.sourceBytes,
          })),
        ].slice(0, MAX_NOTE_PHOTO_ATTACHMENTS),
      );
    } finally {
      setPickingPhoto(false);
    }
  };

  const attachPhotoFromCamera = async () => {
    if (pickingPhoto) {
      return;
    }
    if (photos.length >= MAX_NOTE_PHOTO_ATTACHMENTS) {
      Alert.alert(
        'Photo limit reached',
        `You can attach up to ${MAX_NOTE_PHOTO_ATTACHMENTS} photos.`,
      );
      return;
    }
    setPickingPhoto(true);
    try {
      const picked = await captureAndCompressNotePhoto();
      if (!picked) {
        return;
      }
      setPhotos(current =>
        [
          ...current,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            uri: picked.uri,
            sourceBytes: picked.sourceBytes,
          },
        ].slice(0, MAX_NOTE_PHOTO_ATTACHMENTS),
      );
    } finally {
      setPickingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!canSave || saving) {
      return;
    }

    setSaving(true);
    try {
      await saveNoteMoment({
        openedAt: openedAtRef.current,
        finishedAt: new Date(),
        title,
        textBody,
        moodLabel:
          selectedEmotion && selectedContext
            ? formatEmotionMoodLabel(
                selectedEmotion.label,
                selectedContext.label,
              )
            : null,
        photoAttachments: photos.map(photo => ({
          uri: photo.uri,
          sourceBytes: photo.sourceBytes,
        })),
        voiceAttachmentUri: voiceUri,
        voiceDurationMs: voiceUri != null ? voiceDurationMs : null,
      });
      setPhotos([]);
      setVoiceUri(null);
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotSaveDiaryEntry,
        errorMessageOr(error),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModalProvider>
      <View style={styles.root}>
        <View style={styles.mainColumn}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              {
                // Extra room under the status bar — large title glyphs clip if
                // the field sits flush against the safe-area edge.
                paddingTop: insets.top + 16,
                paddingBottom: bottomDockHeight + 12,
              },
            ]}
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
            contentInsetAdjustmentBehavior="never"
          >
            <TextInput
              ref={titleInputRef}
              autoFocus
              placeholder="Title"
              placeholderTextColor="#C7C7CC"
              value={title}
              onChangeText={setTitle}
              onFocus={() => {
                lastFocusedFieldRef.current = 'title';
              }}
              style={styles.titleInput}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              returnKeyType="done"
              onSubmitEditing={() => {
                bodyInputRef.current?.focus();
              }}
            />
            <TextInput
              ref={bodyInputRef}
              placeholder="Start writing…"
              placeholderTextColor="#C7C7CC"
              value={textBody}
              onChangeText={setTextBody}
              onFocus={() => {
                lastFocusedFieldRef.current = 'body';
              }}
              multiline
              textAlignVertical="top"
              style={styles.bodyInput}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />
          </ScrollView>
        </View>

        <View
          onLayout={event =>
            setBottomDockHeight(event.nativeEvent.layout.height)
          }
          style={[
            styles.bottomDock,
            {
              bottom:
                keyboardHeight > 0
                  ? keyboardHeight + KEYBOARD_TOOLBAR_GAP
                  : Math.max(insets.bottom, KEYBOARD_TOOLBAR_GAP),
            },
          ]}
        >
          {photos.length > 0 ? (
            <View style={styles.photoPreviewDock}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoPreviewScroll}
              >
                {photos.map(photo => (
                  <View key={photo.id} style={styles.photoPreviewItem}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photoPreview}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                      onPress={() => void removePhoto(photo.id)}
                      style={styles.removePhotoButton}
                    >
                      <X size={14} color="#FFFFFF" strokeWidth={2.5} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {voiceUri ? (
            <View style={styles.voicePreviewDock}>
              <View style={styles.voicePreviewRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    voicePlaying
                      ? 'Pause voice attachment'
                      : 'Play voice attachment'
                  }
                  onPress={() => void toggleVoicePreview()}
                  style={[
                    styles.voicePreviewPlay,
                    { backgroundColor: CAPTURE_BUTTON_THEMES.voice.badgeBg },
                  ]}
                >
                  {voicePlaying ? (
                    <Pause
                      size={18}
                      color={CAPTURE_BUTTON_THEMES.voice.icon}
                      strokeWidth={2.25}
                    />
                  ) : (
                    <Play
                      size={18}
                      color={CAPTURE_BUTTON_THEMES.voice.icon}
                      strokeWidth={2.25}
                    />
                  )}
                </Pressable>
                <View style={styles.voicePreviewCopy}>
                  <Text style={styles.voicePreviewLabel}>Voice message</Text>
                  <Text style={styles.voicePreviewDuration}>
                    {formatVoiceDurationMs(voiceDurationMs)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove voice message"
                  onPress={() => void clearVoice()}
                  style={styles.voicePreviewRemove}
                >
                  <X size={16} color="#8E8E93" strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {selectedEmotion && selectedContext ? (
            <View style={styles.moodPreviewDock}>
              <View style={styles.selectedEmotionRow}>
                <View
                  style={[
                    styles.selectedEmotionSticker,
                    { backgroundColor: selectedEmotion.tint },
                  ]}
                >
                  <Text style={styles.selectedEmotionEmoji}>
                    {selectedEmotion.sticker}
                  </Text>
                </View>
                <View style={styles.selectedEmotionCopy}>
                  <Text style={styles.selectedEmotionLabel}>
                    {selectedEmotion.label}
                  </Text>
                  <View style={styles.selectedContextRow}>
                    <Text style={styles.selectedContextSticker}>
                      {selectedContext.sticker}
                    </Text>
                    <Text style={styles.selectedContextLabel}>
                      {selectedContext.label}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove mood"
                  onPress={clearEmotion}
                  style={styles.moodPreviewRemove}
                >
                  <X size={16} color="#8E8E93" strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.toolbarWrap}>
            <View style={styles.toolbarRow}>
              <MapGlassCircleButton
                accessibilityLabel="Save diary entry"
                disabled={!canSave || saving}
                onPress={() => {
                  void handleSave();
                }}
                style={styles.sideButton}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Check
                    size={20}
                    color={colors.primary}
                    strokeWidth={2.25}
                  />
                )}
              </MapGlassCircleButton>

              <View style={styles.shadowWrap}>
                <AdaptiveGlassSurface style={styles.pill}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Attach photo from library"
                    disabled={
                      pickingPhoto ||
                      photos.length >= MAX_NOTE_PHOTO_ATTACHMENTS
                    }
                    onPress={() => void attachPhotosFromLibrary()}
                    style={styles.tab}
                  >
                    {pickingPhoto ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <ImageIcon
                        size={ICON_SIZE}
                        color={colors.primary}
                        strokeWidth={2}
                      />
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Take photo"
                    disabled={
                      pickingPhoto ||
                      photos.length >= MAX_NOTE_PHOTO_ATTACHMENTS
                    }
                    onPress={() => void attachPhotoFromCamera()}
                    style={styles.tab}
                  >
                    <Camera
                      size={ICON_SIZE}
                      color={colors.primary}
                      strokeWidth={2}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Record voice memo"
                    onPress={() => {
                      Keyboard.dismiss();
                      setVoiceSheetOpen(true);
                    }}
                    style={styles.tab}
                  >
                    <AudioLines
                      size={ICON_SIZE}
                      color={colors.primary}
                      strokeWidth={2}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Pick emotion"
                    onPress={() => {
                      Keyboard.dismiss();
                      setEmotionSheetOpen(true);
                    }}
                    style={styles.tab}
                  >
                    {selectedEmotion && selectedContext ? (
                      <View
                        style={[
                          styles.toolbarEmotionSticker,
                          { backgroundColor: selectedEmotion.tint },
                        ]}
                      >
                        <Text style={styles.toolbarEmotionEmoji}>
                          {selectedEmotion.sticker}
                        </Text>
                      </View>
                    ) : (
                      <Sparkles
                        size={ICON_SIZE}
                        color={colors.primary}
                        strokeWidth={2}
                      />
                    )}
                  </Pressable>
                </AdaptiveGlassSurface>
              </View>

              <MapGlassCircleButton
                accessibilityLabel="Close"
                onPress={handleBack}
                style={styles.sideButton}
              >
                <X size={20} color={colors.primary} strokeWidth={2.25} />
              </MapGlassCircleButton>
            </View>
          </View>
        </View>

        <EmotionTokenPickerSheet
          visible={emotionSheetOpen}
          selectedEmotionId={selectedEmotionId}
          selectedContextId={selectedContextId}
          onSelect={selection => {
            setSelectedEmotionId(selection.emotion.id);
            setSelectedContextId(selection.context.id);
          }}
          onClose={() => setEmotionSheetOpen(false)}
          onWillClose={restoreDiaryFocus}
        />
        <VoiceMemoSheet
          visible={voiceSheetOpen}
          saveTarget="diary"
          onDiaryAttach={attachment => {
            void clearVoice().then(() => {
              setVoiceUri(attachment.uri);
              setVoiceDurationMs(attachment.durationMs);
            });
          }}
          onClose={() => setVoiceSheetOpen(false)}
          onWillClose={restoreDiaryFocus}
          onSaved={async () => {}}
        />
      </View>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  mainColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  scroll: {
    flex: 1,
  },
  bottomDock: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    flexGrow: 1,
  },
  titleInput: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600',
    color: '#1C1C1E',
    paddingTop: 6,
    paddingBottom: 8,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  bodyInput: {
    minHeight: 120,
    fontSize: 17,
    lineHeight: 26,
    color: '#1C1C1E',
    paddingTop: 4,
  },
  photoPreviewDock: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  photoPreviewScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  photoPreviewItem: {
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
  },
  moodPreviewDock: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  voicePreviewDock: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  voicePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F7F7FA',
  },
  voicePreviewPlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePreviewCopy: {
    flex: 1,
    gap: 2,
  },
  voicePreviewLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  voicePreviewDuration: {
    fontSize: 13,
    fontWeight: '500',
    color: '#636366',
  },
  voicePreviewRemove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodPreviewRemove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedEmotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F7F7FA',
  },
  selectedEmotionSticker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedEmotionEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  selectedEmotionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  selectedEmotionCopy: {
    flex: 1,
    gap: 4,
  },
  selectedContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedContextSticker: {
    fontSize: 14,
    lineHeight: 16,
  },
  selectedContextLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#636366',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarWrap: {
    alignItems: 'center',
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    height: MAP_MOMENTS_BAR_HEIGHT,
    paddingHorizontal: H_PADDING,
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  tab: {
    width: TAB_SIZE,
    height: MAP_MOMENTS_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarEmotionSticker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarEmotionEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  sideButton: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
  },
});
