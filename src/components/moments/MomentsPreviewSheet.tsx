import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { APP_COPY } from '@/lib/app-copy';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  Activity,
  AudioLines,
  Camera,
  NotebookPen,
  Pause,
  Play,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentVideoPlayer } from '@/components/capture/MomentVideoPlayer';
import { ResizeMode } from 'react-native-video';
import { CAPTURE_BUTTON_THEMES } from '@/components/map/map-capture-button-theme';
import { MomentPreviewImage } from '@/components/moments/MomentPreviewImage';
import { Text } from '@/components/ui/text';
import type { MomentRow } from '@/db/repositories/moments';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  getActivityMediaUris,
  parseActivityValuesJson,
} from '@/lib/activities/activity-definition';
import type {
  ActivityFieldDefinition,
  ActivityFieldValue,
} from '@/lib/activities/activity-definition';
import { getActivityById } from '@/db/repositories/activities';
import type { MomentPreviewContext } from '@/lib/moments/moment-preview-context';
import {
  momentImageUri,
  momentVideoUri,
  resolveExistingMomentContentPath,
} from '@/lib/moments/moment-media-uri';
import {
  formatMomentVoiceDuration,
  momentHasVoiceAttachment,
  resolveMomentVoiceContentPath,
} from '@/lib/moments/moment-voice';
import { parseMomentTagsJson } from '@/lib/moments/moment-tags';
import { notePhotoAttachmentPaths } from '@/lib/moments/note-photo-attachments';
import {
  getMoodArtPresentation,
  resolveEmotionFromMoodLabel,
  resolveMoodVariantFromMoment,
} from '@/lib/moments/mood-art';
import {
  createVoiceRecorderSession,
  getVoiceRecordingErrorMessage,
} from '@/lib/moments/voice-recorder';
import { formatTripClockTime } from '@/lib/trip-format';

export type MomentPreviewViewerProps = {
  moments: MomentRow[];
  initialIndex?: number;
  previewEntryContext?: MomentPreviewContext | null;
  previewSavedPlace?: SavedPlaceRow | null;
  /** Per-moment place labels (gallery / trip-resolved). */
  placeLabelsByMomentId?: ReadonlyMap<number, string> | null;
  suspendAudio?: boolean;
  onClose: () => void;
  onDeleteMoment: (momentId: number) => Promise<void>;
  onActiveIndexChange?: (index: number) => void;
  /** When set, shift active index (and scroll) by `delta` — used after prepending days. */
  prependShift?: { id: number; delta: number } | null;
};

type MomentsPreviewSheetProps = MomentPreviewViewerProps & {
  visible: boolean;
};

function momentDeleteNoun(type: MomentRow['type']): string {
  switch (type) {
    case 'photo':
      return 'photo';
    case 'voice':
      return 'voice memo';
    case 'note':
      return 'note';
    case 'activity':
      return 'activity';
    case 'mood':
      return 'mood';
    default:
      return 'moment';
  }
}

function voiceDurationLabel(moment: MomentRow): string | null {
  return formatMomentVoiceDuration(moment);
}

function VoiceAttachmentRow({
  label,
  durationLabel,
  isPlaying,
  onToggle,
  compact = false,
}: {
  label: string;
  durationLabel: string | null;
  isPlaying: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const theme = CAPTURE_BUTTON_THEMES.voice;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Pause voice memo' : 'Play voice memo'}
      onPress={onToggle}
      style={[
        styles.voiceAttachmentRow,
        compact ? styles.voiceAttachmentRowCompact : null,
      ]}
    >
      <View
        style={[
          styles.voiceAttachmentPlay,
          compact ? styles.voiceAttachmentPlayCompact : null,
          { backgroundColor: theme.badgeBg },
        ]}
      >
        {isPlaying ? (
          <Pause
            size={compact ? 16 : 18}
            color={theme.icon}
            strokeWidth={2.25}
          />
        ) : (
          <Play
            size={compact ? 16 : 18}
            color={theme.icon}
            strokeWidth={2.25}
          />
        )}
      </View>
      <View style={styles.voiceAttachmentCopy}>
        <Text
          style={[
            styles.voiceAttachmentLabel,
            compact ? styles.voiceAttachmentLabelCompact : null,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {durationLabel ? (
          <Text style={styles.voiceAttachmentDuration}>{durationLabel}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function MoodAttachmentRow({ moment }: { moment: MomentRow }) {
  const moodLabel = moment.moodLabel?.trim() || null;
  const emotion = useMemo(
    () => resolveEmotionFromMoodLabel(moodLabel),
    [moodLabel],
  );
  const variant = useMemo(
    () => resolveMoodVariantFromMoment(moment.moodVariant),
    [moment.moodVariant],
  );
  const art =
    emotion != null ? getMoodArtPresentation(emotion.id, variant) : null;
  const label = emotion?.label ?? moodLabel ?? 'Mood';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Mood ${label}`}
      style={[styles.voiceAttachmentRow, styles.voiceAttachmentRowCompact]}
    >
      {art != null && emotion != null ? (
        <View
          style={[styles.moodAttachmentArt, { backgroundColor: emotion.tint }]}
        >
          <Image
            source={art.imageSource}
            resizeMode="contain"
            style={styles.moodAttachmentImage}
          />
        </View>
      ) : (
        <View
          style={[
            styles.moodAttachmentArt,
            { backgroundColor: CAPTURE_BUTTON_THEMES.mood.badgeBg },
          ]}
        >
          <Sparkles
            size={16}
            color={CAPTURE_BUTTON_THEMES.mood.icon}
            strokeWidth={2.25}
          />
        </View>
      )}
      <View style={styles.voiceAttachmentCopy}>
        <Text
          style={[
            styles.voiceAttachmentLabel,
            styles.voiceAttachmentLabelCompact,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function MomentTypeIcon({
  moment,
  size = 18,
}: {
  moment: MomentRow;
  size?: number;
}) {
  const theme =
    moment.type === 'voice'
      ? CAPTURE_BUTTON_THEMES.voice
      : moment.type === 'note'
      ? CAPTURE_BUTTON_THEMES.note
      : moment.type === 'activity'
      ? CAPTURE_BUTTON_THEMES.activity
      : moment.type === 'mood'
      ? CAPTURE_BUTTON_THEMES.mood
      : moment.type === 'video'
      ? CAPTURE_BUTTON_THEMES.camera
      : CAPTURE_BUTTON_THEMES.camera;
  const Icon =
    moment.type === 'voice'
      ? AudioLines
      : moment.type === 'note'
      ? NotebookPen
      : moment.type === 'activity'
      ? Activity
      : moment.type === 'video'
      ? Video
      : Camera;

  if (moment.type === 'mood') {
    return (
      <View style={[styles.typeOrb, { backgroundColor: theme.badgeBg }]}>
        <Sparkles size={size} color={theme.icon} strokeWidth={2.25} />
      </View>
    );
  }

  return (
    <View style={[styles.typeOrb, { backgroundColor: theme.badgeBg }]}>
      <Icon size={size} color={theme.icon} strokeWidth={2.25} />
    </View>
  );
}

function MomentInfoHeader({
  moment,
  previewEntryContext,
  placeLabelsByMomentId,
  previewSavedPlace: _previewSavedPlace,
}: {
  moment: MomentRow;
  previewEntryContext?: MomentPreviewContext | null;
  placeLabelsByMomentId?: ReadonlyMap<number, string> | null;
  previewSavedPlace?: SavedPlaceRow | null;
}) {
  const colors = useThemeColors();
  const storedPlaceLabel = moment.placeLabel?.trim() || null;
  const resolvedPlaceLabel =
    placeLabelsByMomentId?.get(moment.id)?.trim() || null;
  const contextPlaceLabel = previewEntryContext?.placeLabel?.trim() || null;
  const placeLabel =
    storedPlaceLabel ?? resolvedPlaceLabel ?? contextPlaceLabel;
  const caption =
    (moment.type === 'photo' || moment.type === 'video') &&
    moment.caption?.trim()
      ? moment.caption.trim()
      : null;
  const tags =
    moment.type === 'photo' || moment.type === 'video'
      ? parseMomentTagsJson(moment.tagsJson)
      : [];

  return (
    <View style={styles.infoHeader}>
      <View
        style={[
          styles.metaPill,
          {
            backgroundColor: colors.primary,
          },
        ]}
      >
        <MomentTypeIcon moment={moment} size={14} />
        <Text style={[styles.metaTime, { color: colors.primaryForeground }]}>
          {formatTripClockTime(moment.timestamp)}
        </Text>
        {placeLabel ? (
          <>
            <View
              style={[
                styles.metaDot,
                { backgroundColor: colors.primaryForeground },
              ]}
            />
            <Text
              style={[styles.metaPlace, { color: colors.primaryForeground }]}
              numberOfLines={1}
            >
              {placeLabel}
            </Text>
          </>
        ) : null}
      </View>

      {caption ? (
        <Text style={styles.infoCaption} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}

      {tags.length > 0 ? (
        <View style={styles.infoTags}>
          {tags.map(tag => (
            <View key={tag} style={styles.infoTagChip}>
              <Text style={styles.infoTagLabel} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function VoiceMomentPage({
  moment,
  isPlaying,
  onToggle,
}: {
  moment: MomentRow;
  isPlaying: boolean;
  onToggle: () => void;
}) {
  const theme = CAPTURE_BUTTON_THEMES.voice;
  const duration = voiceDurationLabel(moment);

  return (
    <View style={styles.voicePage}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause voice memo' : 'Play voice memo'}
        onPress={onToggle}
        style={styles.voicePlayButton}
      >
        <View
          style={[styles.voicePlayCircle, { backgroundColor: theme.badgeBg }]}
        >
          {isPlaying ? (
            <Pause size={36} color={theme.icon} strokeWidth={2.25} />
          ) : (
            <Play size={36} color={theme.icon} strokeWidth={2.25} />
          )}
        </View>
        <Text style={styles.voiceLabel}>
          {isPlaying ? 'Playing…' : 'Voice memo'}
        </Text>
        {duration ? <Text style={styles.voiceDuration}>{duration}</Text> : null}
        {moment.textBody?.trim() ? (
          <Text style={styles.voiceNote} numberOfLines={4}>
            {moment.textBody.trim()}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

function formatActivityFieldDisplay(value: ActivityFieldValue): string | null {
  switch (value.type) {
    case 'money':
      return `$${value.amount.toFixed(2)}`;
    case 'number':
      return String(value.value);
    case 'text': {
      const trimmed = value.value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    case 'list':
      // List fields render as one line per item — see ActivityMomentPage.
      return null;
    case 'choice':
      return value.value;
    case 'duration': {
      const mins = Math.round(value.seconds / 60);
      if (!Number.isFinite(mins) || mins <= 0) {
        return null;
      }
      return mins === 1 ? '1 min' : `${mins} min`;
    }
    case 'toggle':
      return value.value ? 'Yes' : 'No';
    case 'photo':
    case 'scan':
      return null;
    default:
      return null;
  }
}

function listItemsFromValue(value: ActivityFieldValue): string[] | null {
  if (value.type !== 'list') {
    return null;
  }
  const items = value.items.map(item => item.trim()).filter(Boolean);
  return items.length > 0 ? items : null;
}

/** Cap visible list height so many receipt lines scroll without crowding the page. */
const ACTIVITY_DETAIL_LIST_VISIBLE_ROWS = 6;
const ACTIVITY_DETAIL_LIST_ROW_ESTIMATE = 28;

function fallbackFieldLabel(value: ActivityFieldValue): string {
  switch (value.type) {
    case 'money':
      return 'Amount';
    case 'number':
      return 'Number';
    case 'text':
      return 'Note';
    case 'list':
      return 'Items';
    case 'choice':
      return 'Choice';
    case 'duration':
      return 'Duration';
    case 'toggle':
      return 'Toggle';
    case 'photo':
      return 'Photo';
    case 'scan':
      return 'Bill';
    default:
      return 'Field';
  }
}

const ACTIVITY_THUMB_SIZE = 88;
const ACTIVITY_THUMB_GAP = 10;

function ActivityMomentPage({ moment }: { moment: MomentRow }) {
  const theme = CAPTURE_BUTTON_THEMES.activity;
  const insets = useSafeAreaInsets();
  const emoji = moment.activityEmoji?.trim() || '✨';
  const label = moment.activityLabel?.trim() || 'Activity';
  const values = parseActivityValuesJson(moment.activityValuesJson);
  const [fieldDefs, setFieldDefs] = useState<ActivityFieldDefinition[]>([]);
  const [previewMedia, setPreviewMedia] = useState<{
    uri: string;
    tags: string[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    setFieldDefs([]);
    if (moment.activityId == null) {
      return;
    }
    void getActivityById(moment.activityId).then(row => {
      if (!active || row == null) {
        return;
      }
      setFieldDefs(row.fields ?? []);
    });
    return () => {
      active = false;
    };
  }, [moment.activityId]);

  const labelByFieldId = useMemo(() => {
    const map = new Map<string, string>();
    for (const field of fieldDefs) {
      map.set(field.id, field.label);
    }
    return map;
  }, [fieldDefs]);

  const mediaItems = useMemo(() => {
    const items: Array<{
      fieldId: string;
      label: string;
      uri: string;
      tags: string[];
    }> = [];
    for (const [fieldId, value] of Object.entries(values) as Array<
      [string, ActivityFieldValue]
    >) {
      if (value.type !== 'photo' && value.type !== 'scan') {
        continue;
      }
      const baseLabel =
        labelByFieldId.get(fieldId) ?? fallbackFieldLabel(value);
      const uris = getActivityMediaUris(value);
      const tags = value.tags ?? [];
      uris.forEach((uri, index) => {
        items.push({
          fieldId: `${fieldId}:${index}`,
          label: index === 0 ? baseLabel : `${baseLabel} ${index + 1}`,
          uri,
          tags: index === 0 ? tags : [],
        });
      });
    }
    return items;
  }, [labelByFieldId, values]);

  const detailRows = useMemo(() => {
    const rows: Array<{
      fieldId: string;
      label: string;
      text?: string;
      items?: string[];
    }> = [];
    const orderedIds =
      fieldDefs.length > 0
        ? fieldDefs.map(field => field.id)
        : Object.keys(values);

    const pushRow = (fieldId: string, value: ActivityFieldValue) => {
      const items = listItemsFromValue(value);
      if (items != null) {
        rows.push({
          fieldId,
          label: labelByFieldId.get(fieldId) ?? fallbackFieldLabel(value),
          items,
        });
        return;
      }
      const text = formatActivityFieldDisplay(value);
      if (text == null) {
        return;
      }
      rows.push({
        fieldId,
        label: labelByFieldId.get(fieldId) ?? fallbackFieldLabel(value),
        text,
      });
    };

    for (const fieldId of orderedIds) {
      const value = values[fieldId];
      if (value == null) {
        continue;
      }
      pushRow(fieldId, value);
    }

    // Include any leftover values not in the current definition order.
    for (const [fieldId, value] of Object.entries(values) as Array<
      [string, ActivityFieldValue]
    >) {
      if (rows.some(row => row.fieldId === fieldId)) {
        continue;
      }
      pushRow(fieldId, value);
    }

    return rows;
  }, [fieldDefs, labelByFieldId, values]);

  const hasDetails = mediaItems.length > 0 || detailRows.length > 0;

  return (
    <View style={styles.activityPage}>
      <ScrollView
        contentContainerStyle={styles.activityScrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View
          style={[
            styles.activitySticker,
            hasDetails ? styles.activityStickerCompact : null,
            { backgroundColor: theme.badgeBg },
          ]}
        >
          <Text
            style={[
              styles.activityEmoji,
              hasDetails ? styles.activityEmojiCompact : null,
            ]}
          >
            {emoji}
          </Text>
        </View>
        <Text style={styles.activityLabel}>{label}</Text>

        {mediaItems.length > 0 ? (
          <View style={styles.activityThumbRow}>
            {mediaItems.map(item => (
              <Pressable
                key={item.fieldId}
                accessibilityRole="button"
                accessibilityLabel={`View ${item.label}`}
                onPress={() =>
                  setPreviewMedia({
                    uri: item.uri,
                    tags: item.tags,
                  })
                }
                style={styles.activityThumbWrap}
              >
                <MomentPreviewImage
                  contentPath={item.uri}
                  style={styles.activityThumb}
                  resizeMode="cover"
                />
                <Text style={styles.activityThumbLabel} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {detailRows.length > 0 ? (
          <View style={styles.activityDetails}>
            {detailRows.map(row => (
              <View key={row.fieldId} style={styles.activityDetailRow}>
                <Text style={styles.activityDetailLabel}>{row.label}</Text>
                {row.items != null ? (
                  row.items.length > ACTIVITY_DETAIL_LIST_VISIBLE_ROWS ? (
                    <ScrollView
                      style={styles.activityDetailListScroll}
                      contentContainerStyle={styles.activityDetailListContent}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    >
                      {row.items.map((item, index) => (
                        <Text
                          key={`${row.fieldId}-${index}`}
                          style={styles.activityDetailValue}
                        >
                          {item}
                        </Text>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.activityDetailListContent}>
                      {row.items.map((item, index) => (
                        <Text
                          key={`${row.fieldId}-${index}`}
                          style={styles.activityDetailValue}
                        >
                          {item}
                        </Text>
                      ))}
                    </View>
                  )
                ) : (
                  <Text style={styles.activityDetailValue}>{row.text}</Text>
                )}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={previewMedia != null}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setPreviewMedia(null)}
      >
        <View style={styles.activityFullPreviewRoot}>
          {previewMedia != null ? (
            <Image
              source={{ uri: momentImageUri(previewMedia.uri) }}
              style={styles.activityFullPreviewImage}
              resizeMode="cover"
            />
          ) : null}
          {previewMedia != null && previewMedia.tags.length > 0 ? (
            <View
              pointerEvents="none"
              style={[
                styles.activityFullPreviewTags,
                { paddingTop: insets.top + 10 },
              ]}
            >
              <View style={styles.activityFullPreviewTagRow}>
                {previewMedia.tags.map(tag => (
                  <View key={tag} style={styles.activityFullPreviewTag}>
                    <Text
                      style={styles.activityFullPreviewTagLabel}
                      numberOfLines={1}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            onPress={() => setPreviewMedia(null)}
            style={[
              styles.activityFullPreviewClose,
              { bottom: insets.bottom + 20 },
            ]}
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.25} />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function noteVoiceDurationLabel(moment: MomentRow): string | null {
  if (!moment.voiceAttachmentPath) {
    return null;
  }
  return formatMomentVoiceDuration(moment);
}

const NOTE_PREVIEW_HORIZONTAL_PADDING = 24;
const NOTE_PHOTO_GAP = 8;

function NotePhotoTile({
  path,
  width,
  height,
}: {
  path: string;
  width: number;
  height: number;
}) {
  return (
    <MomentPreviewImage
      contentPath={path}
      style={[styles.notePhoto, { width, height }]}
      resizeMode="cover"
    />
  );
}

function NotePhotoGrid({ paths }: { paths: string[] }) {
  const { width: windowWidth } = useWindowDimensions();
  const gridWidth = windowWidth - NOTE_PREVIEW_HORIZONTAL_PADDING * 2;
  const halfWidth = (gridWidth - NOTE_PHOTO_GAP) / 2;
  const tileHeight = halfWidth;

  if (paths.length === 0) {
    return null;
  }

  if (paths.length === 1) {
    return (
      <NotePhotoTile
        path={paths[0]!}
        width={gridWidth}
        height={gridWidth * 0.72}
      />
    );
  }

  const rows: Array<Array<{ path: string; span: 'half' | 'full' }>> = [];

  if (paths.length === 2) {
    rows.push([
      { path: paths[0]!, span: 'half' },
      { path: paths[1]!, span: 'half' },
    ]);
  } else if (paths.length === 3) {
    rows.push([
      { path: paths[0]!, span: 'half' },
      { path: paths[1]!, span: 'half' },
    ]);
    rows.push([{ path: paths[2]!, span: 'full' }]);
  } else if (paths.length === 4) {
    rows.push([
      { path: paths[0]!, span: 'half' },
      { path: paths[1]!, span: 'half' },
    ]);
    rows.push([
      { path: paths[2]!, span: 'half' },
      { path: paths[3]!, span: 'half' },
    ]);
  } else {
    rows.push([
      { path: paths[0]!, span: 'half' },
      { path: paths[1]!, span: 'half' },
    ]);
    rows.push([
      { path: paths[2]!, span: 'half' },
      { path: paths[3]!, span: 'half' },
    ]);
    rows.push([{ path: paths[4]!, span: 'full' }]);
  }

  return (
    <View style={styles.notePhotoGrid}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.notePhotoRow}>
          {row.map(item =>
            item.span === 'full' ? (
              <NotePhotoTile
                key={item.path}
                path={item.path}
                width={gridWidth}
                height={tileHeight}
              />
            ) : (
              <NotePhotoTile
                key={item.path}
                path={item.path}
                width={halfWidth}
                height={tileHeight}
              />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function NoteMomentPage({
  moment,
  isPlayingVoice,
  onToggleVoice,
  contentInsetTop,
}: {
  moment: MomentRow;
  isPlayingVoice: boolean;
  onToggleVoice: () => void;
  contentInsetTop: number;
}) {
  const moodLabel = moment.moodLabel?.trim();
  const emotionToken = useMemo(
    () => resolveEmotionFromMoodLabel(moodLabel),
    [moodLabel],
  );
  const moodVariant = useMemo(
    () => resolveMoodVariantFromMoment(moment.moodVariant),
    [moment.moodVariant],
  );
  const moodArt = emotionToken
    ? getMoodArtPresentation(emotionToken.id, moodVariant)
    : null;
  const moodReason = moment.moodReason?.trim() || null;
  const voiceDuration = noteVoiceDurationLabel(moment);
  const voiceTheme = CAPTURE_BUTTON_THEMES.voice;
  const photoPaths = useMemo(() => notePhotoAttachmentPaths(moment), [moment]);

  return (
    <ScrollView
      style={styles.noteScroll}
      contentContainerStyle={[
        styles.noteScrollContent,
        { paddingTop: contentInsetTop },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {moment.title?.trim() ? (
        <Text style={styles.noteTitle}>{moment.title.trim()}</Text>
      ) : null}
      {moment.textBody?.trim() ? (
        <Text style={styles.noteBody}>{moment.textBody.trim()}</Text>
      ) : null}
      {emotionToken && moodArt ? (
        <View
          style={[styles.noteMoodBlock, { backgroundColor: emotionToken.tint }]}
        >
          <View style={styles.noteMoodArt}>
            <Image
              source={moodArt.imageSource}
              resizeMode="contain"
              style={styles.noteMoodImage}
            />
          </View>
          <View style={styles.noteEmotionCopy}>
            <Text style={styles.noteMoodBlockLabel}>{emotionToken.label}</Text>
            {moodReason ? (
              <Text style={styles.noteMoodReason}>{moodReason}</Text>
            ) : null}
          </View>
        </View>
      ) : moodLabel ? (
        <Text style={styles.noteMood}>{moodLabel}</Text>
      ) : null}
      {moment.voiceAttachmentPath ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isPlayingVoice ? 'Pause voice message' : 'Play voice message'
          }
          onPress={onToggleVoice}
          style={styles.noteVoiceRow}
        >
          <View
            style={[
              styles.noteVoicePlay,
              { backgroundColor: voiceTheme.badgeBg },
            ]}
          >
            {isPlayingVoice ? (
              <Pause size={18} color={voiceTheme.icon} strokeWidth={2.25} />
            ) : (
              <Play size={18} color={voiceTheme.icon} strokeWidth={2.25} />
            )}
          </View>
          <View style={styles.noteVoiceCopy}>
            <Text style={styles.noteVoiceLabel}>Voice message</Text>
            {voiceDuration ? (
              <Text style={styles.noteVoiceDuration}>{voiceDuration}</Text>
            ) : null}
          </View>
        </Pressable>
      ) : null}
      {photoPaths.length > 0 ? <NotePhotoGrid paths={photoPaths} /> : null}
    </ScrollView>
  );
}

function MoodMomentPage({
  moment,
  isPlayingVoice,
  onToggleVoice,
  contentInsetTop,
}: {
  moment: MomentRow;
  isPlayingVoice: boolean;
  onToggleVoice: () => void;
  contentInsetTop: number;
}) {
  const moodLabel = moment.moodLabel?.trim();
  const emotionToken = useMemo(
    () => resolveEmotionFromMoodLabel(moodLabel),
    [moodLabel],
  );
  const moodVariant = useMemo(
    () => resolveMoodVariantFromMoment(moment.moodVariant),
    [moment.moodVariant],
  );
  const moodArt = emotionToken
    ? getMoodArtPresentation(emotionToken.id, moodVariant)
    : null;
  const moodReason = moment.moodReason?.trim() || null;
  const voiceTranscript = moment.voiceTranscript?.trim() || null;
  const voiceDuration = formatMomentVoiceDuration(moment);
  const voiceTheme = CAPTURE_BUTTON_THEMES.voice;
  const reasonText = moodReason || voiceTranscript;

  return (
    <ScrollView
      style={styles.noteScroll}
      contentContainerStyle={[
        styles.noteScrollContent,
        { paddingTop: contentInsetTop },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {emotionToken && moodArt ? (
        <View
          style={[styles.noteMoodBlock, { backgroundColor: emotionToken.tint }]}
        >
          <View style={styles.noteMoodArt}>
            <Image
              source={moodArt.imageSource}
              resizeMode="contain"
              style={styles.noteMoodImage}
            />
          </View>
          <View style={styles.noteEmotionCopy}>
            <Text style={styles.noteMoodBlockLabel}>{emotionToken.label}</Text>
            {moment.voiceAttachmentPath ? null : reasonText ? (
              <Text style={styles.noteMoodReason}>{reasonText}</Text>
            ) : (
              <Text style={styles.noteMoodReasonMuted}>
                {APP_COPY.mood.noReasonGiven}
              </Text>
            )}
          </View>
        </View>
      ) : moodLabel ? (
        <>
          <Text style={styles.noteMood}>{moodLabel}</Text>
          {moment.voiceAttachmentPath || reasonText ? null : (
            <Text style={styles.noteMoodReasonStandaloneMuted}>
              {APP_COPY.mood.noReasonGiven}
            </Text>
          )}
        </>
      ) : null}

      {moment.voiceAttachmentPath ? (
        <View style={styles.moodVoiceBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isPlayingVoice ? 'Pause voice reason' : 'Play voice reason'
            }
            onPress={onToggleVoice}
            style={styles.noteVoiceRow}
          >
            <View
              style={[
                styles.noteVoicePlay,
                { backgroundColor: voiceTheme.badgeBg },
              ]}
            >
              {isPlayingVoice ? (
                <Pause size={18} color={voiceTheme.icon} strokeWidth={2.25} />
              ) : (
                <Play size={18} color={voiceTheme.icon} strokeWidth={2.25} />
              )}
            </View>
            <View style={styles.noteVoiceCopy}>
              <Text style={styles.noteVoiceLabel}>Voice reason</Text>
              {voiceDuration ? (
                <Text style={styles.noteVoiceDuration}>{voiceDuration}</Text>
              ) : null}
            </View>
          </Pressable>
          {voiceTranscript ? (
            <Text style={styles.noteMoodReason}>{voiceTranscript}</Text>
          ) : null}
        </View>
      ) : moodReason ? (
        <Text style={styles.noteMoodReasonStandalone}>{moodReason}</Text>
      ) : null}
    </ScrollView>
  );
}

function VideoMomentPage({
  moment,
  isActive,
}: {
  moment: MomentRow;
  isActive: boolean;
}) {
  if (!moment.contentPath) {
    return null;
  }

  return (
    <MomentVideoPlayer
      uri={momentVideoUri(moment.contentPath)}
      style={styles.photoPage}
      resizeMode={ResizeMode.COVER}
      paused={!isActive}
      repeat
    />
  );
}

const MomentPagerPage = memo(function MomentPagerPage({
  moment,
  pageWidth,
  isActive,
  isPlayingVoice,
  onToggleVoice,
  onToggleChrome,
  noteContentInsetTop,
}: {
  moment: MomentRow;
  pageWidth: number;
  isActive: boolean;
  isPlayingVoice: boolean;
  onToggleVoice: (moment: MomentRow) => void;
  onToggleChrome: () => void;
  noteContentInsetTop: number;
}) {
  const handleToggleVoice = useCallback(() => {
    onToggleVoice(moment);
  }, [moment, onToggleVoice]);

  return (
    <View style={[styles.page, { width: pageWidth }]}>
      {moment.type === 'photo' && moment.contentPath ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle photo controls"
          onPress={onToggleChrome}
          style={styles.photoPage}
        >
          <MomentPreviewImage
            contentPath={moment.contentPath}
            style={styles.photoPage}
            resizeMode="cover"
          />
        </Pressable>
      ) : null}

      {moment.type === 'video' && moment.contentPath ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle video controls"
          onPress={onToggleChrome}
          style={styles.photoPage}
        >
          <VideoMomentPage moment={moment} isActive={isActive} />
        </Pressable>
      ) : null}

      {moment.type === 'voice' ? (
        <VoiceMomentPage
          moment={moment}
          isPlaying={isPlayingVoice}
          onToggle={handleToggleVoice}
        />
      ) : null}

      {moment.type === 'note' ? (
        <NoteMomentPage
          moment={moment}
          isPlayingVoice={isPlayingVoice}
          onToggleVoice={handleToggleVoice}
          contentInsetTop={noteContentInsetTop}
        />
      ) : null}

      {moment.type === 'mood' ? (
        <MoodMomentPage
          moment={moment}
          isPlayingVoice={isPlayingVoice}
          onToggleVoice={handleToggleVoice}
          contentInsetTop={noteContentInsetTop}
        />
      ) : null}

      {moment.type === 'activity' ? (
        <ActivityMomentPage moment={moment} />
      ) : null}
    </View>
  );
});

/** Windowed pager: a few dots left/right of the active one (not one per moment). */
function PaginationDots({
  count,
  activeIndex,
  accentColor,
}: {
  count: number;
  activeIndex: number;
  accentColor: string;
}) {
  if (count <= 1) {
    return null;
  }

  const SIDE = 2;
  const windowSize = Math.min(count, SIDE * 2 + 1);
  let start = Math.max(0, activeIndex - SIDE);
  let end = start + windowSize - 1;
  if (end > count - 1) {
    end = count - 1;
    start = Math.max(0, end - windowSize + 1);
  }

  const indices: number[] = [];
  for (let i = start; i <= end; i += 1) {
    indices.push(i);
  }

  return (
    <View
      style={styles.dotsRow}
      accessibilityLabel={`Moment ${activeIndex + 1} of ${count}`}
    >
      {start > 0 ? <View style={[styles.dot, styles.dotEdge]} /> : null}
      {indices.map(index => {
        const active = index === activeIndex;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              active ? styles.dotActive : null,
              active ? { backgroundColor: accentColor } : null,
            ]}
          />
        );
      })}
      {end < count - 1 ? <View style={[styles.dot, styles.dotEdge]} /> : null}
    </View>
  );
}

export function MomentPreviewViewer({
  moments,
  initialIndex = 0,
  previewEntryContext = null,
  previewSavedPlace = null,
  placeLabelsByMomentId = null,
  suspendAudio = false,
  onClose,
  onDeleteMoment,
  onActiveIndexChange,
  prependShift = null,
}: MomentPreviewViewerProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const pageWidth = Dimensions.get('window').width;

  const [activeIndex, setActiveIndex] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<number | null>(null);
  const [deletingMomentId, setDeletingMomentId] = useState<number | null>(null);
  const [noteContentInsetTop, setNoteContentInsetTop] = useState(112);
  const [chromeVisible, setChromeVisible] = useState(true);
  const pagerRef = useRef<FlatList<MomentRow>>(null);
  const playerRef = useRef<ReturnType<
    typeof createVoiceRecorderSession
  > | null>(null);
  const autoPlayGenerationRef = useRef(0);
  const lastAutoPlayedKeyRef = useRef<string | null>(null);
  const aliveRef = useRef(true);
  const syncedInitialIndexRef = useRef<number | null>(null);
  const lastPrependShiftIdRef = useRef<number | null>(null);
  const activeIndexRef = useRef(0);

  const activeMoment = moments[activeIndex] ?? null;

  const stopVoice = useCallback(async () => {
    autoPlayGenerationRef.current += 1;
    try {
      await playerRef.current?.stopPreview();
    } catch {
      // Not playing.
    }
    if (aliveRef.current) {
      setPlayingVoiceId(null);
    }
  }, []);

  const playVoice = useCallback(
    async (moment: MomentRow, generation?: number) => {
      if (!momentHasVoiceAttachment(moment)) {
        return;
      }
      const voicePath = resolveMomentVoiceContentPath(moment);
      if (!voicePath) {
        return;
      }
      const existingPath = await resolveExistingMomentContentPath(voicePath);
      if (!existingPath || !aliveRef.current) {
        return;
      }
      if (generation != null && generation !== autoPlayGenerationRef.current) {
        return;
      }

      try {
        await playerRef.current?.stopPreview();
        if (
          !aliveRef.current ||
          (generation != null && generation !== autoPlayGenerationRef.current)
        ) {
          return;
        }
        await playerRef.current?.startPreview(existingPath);
        if (
          !aliveRef.current ||
          (generation != null && generation !== autoPlayGenerationRef.current)
        ) {
          await playerRef.current?.stopPreview();
          return;
        }
        setPlayingVoiceId(moment.id);
      } catch (error) {
        if (!aliveRef.current) {
          return;
        }
        setPlayingVoiceId(null);
        Alert.alert(
          APP_COPY.alerts.couldNotPlayVoiceMemo,
          getVoiceRecordingErrorMessage(error),
        );
      }
    },
    [],
  );

  useEffect(() => {
    aliveRef.current = true;
    const session = createVoiceRecorderSession({
      onPlaybackProgress: (positionMs, totalMs) => {
        if (!aliveRef.current) {
          return;
        }
        if (totalMs > 0 && positionMs >= totalMs - 80) {
          setPlayingVoiceId(null);
        }
      },
      onPlaybackEnded: () => {
        if (!aliveRef.current) {
          return;
        }
        setPlayingVoiceId(null);
      },
    });
    playerRef.current = session;
    return () => {
      aliveRef.current = false;
      autoPlayGenerationRef.current += 1;
      void (async () => {
        try {
          await session.stopPreview();
        } catch {
          // Not playing.
        }
        session.dispose();
        if (playerRef.current === session) {
          playerRef.current = null;
        }
      })();
    };
  }, []);

  const closeViewer = useCallback(() => {
    void (async () => {
      await stopVoice();
      if (aliveRef.current) {
        onClose();
      }
    })();
  }, [onClose, stopVoice]);

  useEffect(() => {
    if (suspendAudio) {
      void stopVoice();
    }
  }, [stopVoice, suspendAudio]);

  useEffect(() => {
    // Only re-sync when initialIndex changes — not when moments.length grows
    // from cross-day prefetch (that would jump the pager).
    if (syncedInitialIndexRef.current === initialIndex) {
      return;
    }
    syncedInitialIndexRef.current = initialIndex;
    lastAutoPlayedKeyRef.current = null;
    const index = Math.max(
      0,
      Math.min(initialIndex, Math.max(0, moments.length - 1)),
    );
    activeIndexRef.current = index;
    setActiveIndex(index);
    pagerRef.current?.scrollToOffset({
      offset: index * pageWidth,
      animated: false,
    });
  }, [initialIndex, moments.length, pageWidth]);

  // Apply prepend scroll correction before paint so FlatList never flashes
  // older-day index 0 (which used to re-trigger edge prefetch and skip days).
  useLayoutEffect(() => {
    if (!prependShift || prependShift.delta <= 0) {
      return;
    }
    if (lastPrependShiftIdRef.current === prependShift.id) {
      return;
    }
    lastPrependShiftIdRef.current = prependShift.id;
    const next = activeIndexRef.current + prependShift.delta;
    activeIndexRef.current = next;
    setActiveIndex(next);
    pagerRef.current?.scrollToOffset({
      offset: next * pageWidth,
      animated: false,
    });
  }, [prependShift, pageWidth]);

  useEffect(() => {
    if (activeIndex >= moments.length) {
      const nextIndex = Math.max(0, moments.length - 1);
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
      pagerRef.current?.scrollToOffset({
        offset: nextIndex * pageWidth,
        animated: false,
      });
    }
  }, [activeIndex, moments.length, pageWidth]);

  useEffect(() => {
    if (moments.length === 0) {
      closeViewer();
    }
  }, [closeViewer, moments.length]);

  useEffect(() => {
    if (suspendAudio) {
      lastAutoPlayedKeyRef.current = null;
      return;
    }
    const moment = moments[activeIndex];
    const autoPlayKey = moment ? `${activeIndex}:${moment.id}` : null;
    if (!moment || !momentHasVoiceAttachment(moment)) {
      lastAutoPlayedKeyRef.current = null;
      void stopVoice();
      return;
    }
    if (lastAutoPlayedKeyRef.current === autoPlayKey) {
      return;
    }
    lastAutoPlayedKeyRef.current = autoPlayKey;
    const generation = ++autoPlayGenerationRef.current;
    void playVoice(moment, generation);
  }, [activeIndex, moments, playVoice, stopVoice, suspendAudio]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      const clamped = Math.max(0, Math.min(index, moments.length - 1));
      if (clamped === activeIndexRef.current) {
        return;
      }
      void stopVoice();
      activeIndexRef.current = clamped;
      setActiveIndex(clamped);
      // Only notify on user-driven settles — not programmatic prepend shifts
      // (those used to re-fire edge prefetch and skip 2–3 days).
      onActiveIndexChange?.(clamped);
    },
    [moments.length, onActiveIndexChange, pageWidth, stopVoice],
  );

  const handleScrollBeginDrag = useCallback(() => {
    void stopVoice();
  }, [stopVoice]);

  const toggleVoice = useCallback(
    async (moment: MomentRow) => {
      if (playingVoiceId === moment.id) {
        try {
          await playerRef.current?.pausePreview();
          if (!aliveRef.current) {
            return;
          }
          setPlayingVoiceId(null);
        } catch (error) {
          if (!aliveRef.current) {
            return;
          }
          Alert.alert(
            APP_COPY.alerts.couldNotPauseVoiceMemo,
            getVoiceRecordingErrorMessage(error),
          );
        }
        return;
      }

      autoPlayGenerationRef.current += 1;
      await playVoice(moment);
    },
    [playVoice, playingVoiceId],
  );

  const confirmDeleteMoment = useCallback(
    (moment: MomentRow) => {
      const noun = momentDeleteNoun(moment.type);
      Alert.alert(`Delete this ${noun}?`, 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (deletingMomentId != null) {
                return;
              }
              setDeletingMomentId(moment.id);
              if (playingVoiceId === moment.id) {
                await stopVoice();
              }
              try {
                await onDeleteMoment(moment.id);
              } catch {
                Alert.alert(
                  APP_COPY.common.couldNotDeleteMoment,
                  APP_COPY.common.deleteMomentTryAgain,
                );
              } finally {
                setDeletingMomentId(null);
              }
            })();
          },
        },
      ]);
    },
    [deletingMomentId, onDeleteMoment, playingVoiceId, stopVoice],
  );

  const handleToggleVoice = useCallback(
    (moment: MomentRow) => {
      void toggleVoice(moment);
    },
    [toggleVoice],
  );

  const handleToggleChrome = useCallback(() => {
    setChromeVisible(current => !current);
  }, []);

  const renderPage = useCallback(
    ({ item, index }: { item: MomentRow; index: number }) => (
      <MomentPagerPage
        moment={item}
        pageWidth={pageWidth}
        isActive={index === activeIndex}
        isPlayingVoice={playingVoiceId === item.id}
        onToggleVoice={handleToggleVoice}
        onToggleChrome={handleToggleChrome}
        noteContentInsetTop={noteContentInsetTop}
      />
    ),
    [
      activeIndex,
      handleToggleChrome,
      handleToggleVoice,
      noteContentInsetTop,
      pageWidth,
      playingVoiceId,
    ],
  );

  const keyExtractor = useCallback((item: MomentRow) => String(item.id), []);

  const getItemLayout = useCallback(
    (_: ArrayLike<MomentRow> | null | undefined, index: number) => ({
      length: pageWidth,
      offset: pageWidth * index,
      index,
    }),
    [pageWidth],
  );

  const activePhotoVoice =
    activeMoment?.type === 'photo' && activeMoment.voiceAttachmentPath
      ? activeMoment
      : null;
  const activeMediaMood =
    (activeMoment?.type === 'photo' || activeMoment?.type === 'video') &&
    activeMoment.moodLabel?.trim()
      ? activeMoment
      : null;

  return (
    <View style={styles.root}>
      <FlatList
        ref={pagerRef}
        style={styles.pager}
        data={moments}
        horizontal
        pagingEnabled
        bounces={moments.length > 1}
        showsHorizontalScrollIndicator={false}
        keyExtractor={keyExtractor}
        renderItem={renderPage}
        onScrollBeginDrag={handleScrollBeginDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={getItemLayout}
      />

      {chromeVisible ? (
        <View
          pointerEvents="box-none"
          onLayout={event => {
            setNoteContentInsetTop(event.nativeEvent.layout.height + 12);
          }}
          style={[styles.topChrome, { paddingTop: insets.top + 8 }]}
        >
          <View style={styles.topChromeRow}>
            {activeMoment ? (
              <MomentInfoHeader
                moment={activeMoment}
                previewEntryContext={previewEntryContext}
                placeLabelsByMomentId={placeLabelsByMomentId}
                previewSavedPlace={previewSavedPlace}
              />
            ) : null}

            {activeMoment ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${momentDeleteNoun(
                  activeMoment.type,
                )}`}
                disabled={deletingMomentId === activeMoment.id}
                hitSlop={8}
                onPress={() => confirmDeleteMoment(activeMoment)}
                style={[
                  styles.topDeleteButton,
                  { backgroundColor: 'rgba(0,0,0,0.45)' },
                  deletingMomentId === activeMoment.id ? styles.disabled : null,
                ]}
              >
                <Trash2 size={18} color="#FF453A" strokeWidth={2.25} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {chromeVisible ? (
        <View
          pointerEvents="box-none"
          style={[styles.bottomChrome, { paddingBottom: insets.bottom + 16 }]}
        >
          {activeMediaMood || activePhotoVoice ? (
            <View style={styles.bottomAttachmentsDock}>
              {activeMediaMood ? (
                <MoodAttachmentRow moment={activeMediaMood} />
              ) : null}
              {activePhotoVoice ? (
                <VoiceAttachmentRow
                  compact
                  label="Voice memo"
                  durationLabel={formatMomentVoiceDuration(activePhotoVoice)}
                  isPlaying={playingVoiceId === activePhotoVoice.id}
                  onToggle={() => void toggleVoice(activePhotoVoice)}
                />
              ) : null}
            </View>
          ) : null}
          <View style={styles.bottomRow}>
            <View style={[styles.bottomRowSide, styles.bottomRowSideLeft]}>
              <View style={styles.bottomRowBalance} />
            </View>
            <PaginationDots
              count={moments.length}
              activeIndex={activeIndex}
              accentColor={colors.primary}
            />
            <View style={[styles.bottomRowSide, styles.bottomRowSideRight]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close moments"
                onPress={closeViewer}
                hitSlop={8}
                style={[
                  styles.chromeIconButton,
                  { backgroundColor: 'rgba(0,0,0,0.45)' },
                ]}
              >
                <X size={20} color="#FFFFFF" strokeWidth={2.25} />
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function MomentsPreviewSheet({
  visible,
  ...viewerProps
}: MomentsPreviewSheetProps) {
  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={viewerProps.onClose}
    >
      <MomentPreviewViewer {...viewerProps} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    backgroundColor: '#000000',
  },
  photoPage: {
    ...StyleSheet.absoluteFillObject,
  },
  topChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingLeft: 16,
    paddingRight: 12,
  },
  topChromeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  topDeleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    flexShrink: 0,
  },
  bottomChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    gap: 10,
  },
  bottomVoiceDock: {
    alignSelf: 'stretch',
    paddingHorizontal: 4,
  },
  bottomAttachmentsDock: {
    alignSelf: 'stretch',
    paddingHorizontal: 4,
    gap: 8,
  },
  moodAttachmentArt: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  moodAttachmentImage: {
    width: 30,
    height: 30,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  bottomRowSide: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  bottomRowSideLeft: {
    alignItems: 'flex-start',
  },
  bottomRowSideRight: {
    alignItems: 'flex-end',
  },
  bottomRowBalance: {
    width: 40,
    height: 40,
  },
  chromeIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  infoHeader: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  metaPill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  metaTime: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.55,
  },
  metaPlace: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  infoCaption: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  infoTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  infoTagChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  infoTagLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  dotEdge: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  typeOrb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  activityPage: {
    flex: 1,
    paddingHorizontal: 24,
  },
  activityScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 14,
  },
  activitySticker: {
    width: 120,
    height: 120,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityStickerCompact: {
    width: 88,
    height: 88,
    borderRadius: 22,
  },
  activityEmoji: {
    fontSize: 56,
    lineHeight: 62,
    textAlign: 'center',
  },
  activityEmojiCompact: {
    fontSize: 42,
    lineHeight: 48,
  },
  activityLabel: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  activityThumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: ACTIVITY_THUMB_GAP,
    marginTop: 4,
  },
  activityThumbWrap: {
    width: ACTIVITY_THUMB_SIZE,
    alignItems: 'center',
    gap: 6,
  },
  activityThumb: {
    width: ACTIVITY_THUMB_SIZE,
    height: ACTIVITY_THUMB_SIZE,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  activityThumbLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: ACTIVITY_THUMB_SIZE,
  },
  activityDetails: {
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 4,
    paddingHorizontal: 8,
  },
  activityDetailRow: {
    gap: 2,
  },
  activityDetailLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  activityDetailValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  activityDetailListScroll: {
    maxHeight:
      ACTIVITY_DETAIL_LIST_VISIBLE_ROWS * ACTIVITY_DETAIL_LIST_ROW_ESTIMATE,
  },
  activityDetailListContent: {
    gap: 6,
  },
  activityFullPreviewRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  activityFullPreviewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  activityFullPreviewTags: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  activityFullPreviewTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  activityFullPreviewTag: {
    maxWidth: '100%',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  activityFullPreviewTagLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  activityFullPreviewClose: {
    position: 'absolute',
    right: 20,
    zIndex: 2,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  activityMoney: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  voicePlayButton: {
    alignItems: 'center',
    gap: 14,
  },
  voicePlayCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  voiceDuration: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    fontWeight: '500',
  },
  voiceNote: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  voiceAttachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  voiceAttachmentRowCompact: {
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  voiceAttachmentPlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceAttachmentPlayCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  voiceAttachmentCopy: {
    flex: 1,
    gap: 2,
  },
  voiceAttachmentLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  voiceAttachmentLabelCompact: {
    fontSize: 13,
  },
  voiceAttachmentDuration: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  noteScroll: {
    flex: 1,
  },
  noteScrollContent: {
    paddingHorizontal: NOTE_PREVIEW_HORIZONTAL_PADDING,
    paddingBottom: 80,
    gap: 12,
    width: '100%',
  },
  noteTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  noteBody: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 16,
    lineHeight: 24,
  },
  noteVoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  noteVoicePlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteVoiceCopy: {
    flex: 1,
    gap: 2,
  },
  noteVoiceLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  noteVoiceDuration: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '500',
  },
  noteMood: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    fontWeight: '600',
  },
  noteMoodBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
    borderRadius: 18,
    padding: 12,
  },
  noteMoodArt: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  noteMoodBlockLabel: {
    color: '#1C1C1E',
    fontSize: 16,
    fontWeight: '700',
  },
  noteMoodReason: {
    color: '#3A3A3C',
    fontSize: 14,
    lineHeight: 19,
  },
  noteMoodReasonMuted: {
    color: '#8E8E93',
    fontSize: 14,
    lineHeight: 19,
  },
  noteMoodReasonStandalone: {
    color: '#E5E5EA',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 12,
  },
  noteMoodReasonStandaloneMuted: {
    color: '#8E8E93',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 12,
  },
  moodVoiceBlock: {
    marginTop: 14,
    gap: 10,
  },
  noteEmotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  noteEmotionSticker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteMoodImage: {
    width: 52,
    height: 52,
  },
  noteEmotionCopy: {
    flex: 1,
    gap: 4,
  },
  noteContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteContextSticker: {
    fontSize: 14,
    lineHeight: 16,
  },
  noteContextLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    fontWeight: '500',
  },
  notePhotoGrid: {
    width: '100%',
    gap: NOTE_PHOTO_GAP,
  },
  notePhotoRow: {
    flexDirection: 'row',
    gap: NOTE_PHOTO_GAP,
  },
  notePhoto: {
    borderRadius: 12,
    backgroundColor: '#111111',
  },
  disabled: {
    opacity: 0.45,
  },
});
