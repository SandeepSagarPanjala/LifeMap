import {useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {format} from 'date-fns';
import {Check, ChevronLeft, ImageIcon, SmilePlus, X} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {MoodPickerSheet} from '@/components/capture/MoodPickerSheet';
import {CAPTURE_BUTTON_THEMES} from '@/components/map/map-capture-button-theme';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  canSaveNoteDraft,
  isCaptureNoteDraftDirty,
  saveNoteMoment,
} from '@/lib/moments/capture-note';
import {moodLabelForScore} from '@/lib/moments/mood';
import {deleteMomentContentFile} from '@/lib/moments/moment-storage';
import {pickAndCompressNotePhoto} from '@/lib/moments/pick-note-photo';
import type {RootStackParamList} from '@/navigation/types';

export function CaptureNoteScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const noteTheme = CAPTURE_BUTTON_THEMES.note;
  const openedAtRef = useRef(new Date());

  const [title, setTitle] = useState('');
  const [textBody, setTextBody] = useState('');
  const [moodScore, setMoodScore] = useState(0.5);
  const [moodTouched, setMoodTouched] = useState(false);
  const [moodSheetOpen, setMoodSheetOpen] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoSourceBytes, setPhotoSourceBytes] = useState<number | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const openedAtLabel = format(openedAtRef.current, 'h:mm a');
  const canSave = canSaveNoteDraft(title, textBody);
  const isDirty = isCaptureNoteDraftDirty({
    title,
    textBody,
    hasPhoto: photoUri != null,
    moodTouched,
  });

  const clearPhoto = async () => {
    if (photoUri) {
      await deleteMomentContentFile(photoUri);
    }
    setPhotoUri(null);
    setPhotoSourceBytes(null);
  };

  const handleBack = () => {
    if (!isDirty) {
      navigation.goBack();
      return;
    }

    Alert.alert('Discard this note?', 'Your draft will be lost.', [
      {text: 'Keep writing', style: 'cancel'},
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          void clearPhoto().finally(() => navigation.goBack());
        },
      },
    ]);
  };

  const handleAttachPhoto = async () => {
    if (pickingPhoto) {
      return;
    }
    setPickingPhoto(true);
    try {
      const picked = await pickAndCompressNotePhoto();
      if (!picked) {
        return;
      }
      if (photoUri) {
        await deleteMomentContentFile(photoUri);
      }
      setPhotoUri(picked.uri);
      setPhotoSourceBytes(picked.sourceBytes);
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
        moodScore: moodTouched ? moodScore : null,
        moodLabel: moodTouched ? moodLabelForScore(moodScore) : null,
        attachmentUri: photoUri,
        sourceBytes: photoSourceBytes,
      });
      setPhotoUri(null);
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Could not save note',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={handleBack}
            style={styles.topBarButton}>
            <ChevronLeft size={22} color={colors.primary} strokeWidth={2.25} />
          </Pressable>
          <Text variant="h4" className="border-0 pb-0">
            New note
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save note"
            disabled={!canSave || saving}
            onPress={() => void handleSave()}
            style={[
              styles.saveIconButton,
              {
                backgroundColor: canSave ? colors.primary : '#E5E7EB',
                opacity: saving ? 0.7 : 1,
              },
            ]}>
            {saving ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Check size={20} color={colors.primaryForeground} strokeWidth={2.5} />
            )}
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <TextInput
            placeholder="Title"
            placeholderTextColor="#8E8E93"
            value={title}
            onChangeText={setTitle}
            style={styles.titleInput}
            returnKeyType="next"
          />
          <TextInput
            placeholder="What's on your mind?"
            placeholderTextColor="#8E8E93"
            value={textBody}
            onChangeText={setTextBody}
            multiline
            textAlignVertical="top"
            style={styles.bodyInput}
          />

          {photoUri ? (
            <View style={styles.photoPreviewWrap}>
              <Image source={{uri: photoUri}} style={styles.photoPreview} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                onPress={() => void clearPhoto()}
                style={styles.removePhotoButton}>
                <X size={16} color="#FFFFFF" strokeWidth={2.5} />
              </Pressable>
            </View>
          ) : null}

          <Text variant="muted" className="mt-2 text-sm">
            Started at {openedAtLabel}
          </Text>
          {moodTouched ? (
            <Text variant="muted" className="mt-1 text-sm">
              Mood: {moodLabelForScore(moodScore)}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Attach photo from library"
            disabled={pickingPhoto}
            onPress={() => void handleAttachPhoto()}
            style={[styles.toolbarButton, {backgroundColor: noteTheme.badgeBg}]}>
            {pickingPhoto ? (
              <ActivityIndicator color={noteTheme.icon} size="small" />
            ) : (
              <ImageIcon size={20} color={noteTheme.icon} strokeWidth={2.25} />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Set mood"
            onPress={() => setMoodSheetOpen(true)}
            style={[styles.toolbarButton, {backgroundColor: noteTheme.badgeBg}]}>
            <SmilePlus size={20} color={noteTheme.icon} strokeWidth={2.25} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <MoodPickerSheet
        visible={moodSheetOpen}
        score={moodScore}
        onChange={nextScore => {
          setMoodScore(nextScore);
          setMoodTouched(true);
        }}
        onClose={() => setMoodSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  topBarButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    flexGrow: 1,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 8,
  },
  bodyInput: {
    minHeight: 180,
    fontSize: 17,
    lineHeight: 24,
    color: '#111827',
    paddingTop: 8,
  },
  photoPreviewWrap: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  toolbarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
