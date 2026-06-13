import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {AudioLines, Camera, NotebookPen, Pause, Play, Trash2, X} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {SavedPlaceIcon} from '@/components/map/SavedPlaceIcon';
import {CAPTURE_BUTTON_THEMES} from '@/components/map/map-capture-button-theme';
import {MomentPreviewImage} from '@/components/moments/MomentPreviewImage';
import {Text} from '@/components/ui/text';
import type {MomentRow} from '@/db/repositories/moments';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {useMomentPreviewContexts} from '@/hooks/use-moment-preview-contexts';
import type {DistanceUnit} from '@/lib/location-geo';
import {formatVoiceDurationMs} from '@/lib/moments/format-voice-duration';
import {resolveExistingMomentContentPath} from '@/lib/moments/moment-media-uri';
import type {MomentPreviewContext} from '@/lib/moments/moment-preview-context';
import {
  createVoiceRecorderSession,
  getVoiceRecordingErrorMessage,
} from '@/lib/moments/voice-recorder';
import {matchSavedPlaceForStay} from '@/lib/saved-places';
import type {DayTimelineEntry} from '@/lib/trip-detection';
import {formatTripClockTime} from '@/lib/trip-format';

type MomentsPreviewSheetProps = {
  visible: boolean;
  title: string;
  moments: MomentRow[];
  timelineEntries: DayTimelineEntry[];
  savedPlaces: readonly SavedPlaceRow[];
  distanceUnit: DistanceUnit;
  previewEntry?: DayTimelineEntry | null;
  onClose: () => void;
  onDeleteMoment: (momentId: number) => Promise<void>;
};

function momentDeleteNoun(type: MomentRow['type']): string {
  switch (type) {
    case 'photo':
      return 'photo';
    case 'voice':
      return 'voice memo';
    case 'note':
      return 'note';
    default:
      return 'moment';
  }
}

function voiceDurationLabel(moment: MomentRow): string | null {
  const seconds = moment.caption ? Number(moment.caption) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return formatVoiceDurationMs(seconds * 1000);
}

function MomentTypeIcon({moment, size = 18}: {moment: MomentRow; size?: number}) {
  const theme =
    moment.type === 'voice'
      ? CAPTURE_BUTTON_THEMES.voice
      : moment.type === 'note'
        ? CAPTURE_BUTTON_THEMES.note
        : CAPTURE_BUTTON_THEMES.camera;
  const Icon =
    moment.type === 'voice'
      ? AudioLines
      : moment.type === 'note'
        ? NotebookPen
        : Camera;

  return (
    <View style={[styles.typeOrb, {backgroundColor: theme.badgeBg}]}>
      <Icon size={size} color={theme.icon} strokeWidth={2.25} />
    </View>
  );
}

function MomentInfoHeader({
  moment,
  context,
  savedPlaces,
  timelineEntries,
}: {
  moment: MomentRow;
  context?: MomentPreviewContext;
  savedPlaces: readonly SavedPlaceRow[];
  timelineEntries: DayTimelineEntry[];
}) {
  const stayEntry =
    context?.entryKind === 'stay'
      ? timelineEntries.find(
          entry => entry.id === context.entryId && entry.kind === 'stay',
        )
      : null;
  const savedPlace =
    stayEntry?.kind === 'stay'
      ? matchSavedPlaceForStay(stayEntry, savedPlaces)
      : null;

  return (
    <View style={styles.infoHeader}>
      <View style={styles.infoTopRow}>
        <MomentTypeIcon moment={moment} size={16} />
        <Text style={styles.infoTime}>{formatTripClockTime(moment.timestamp)}</Text>
      </View>

      {context ? (
        <View style={styles.infoContext}>
          <View style={styles.infoPlaceLine}>
            <Text style={styles.infoKind}>{context.kindLabel}</Text>
            {savedPlace ? (
              <View style={styles.infoPlaceRow}>
                <SavedPlaceIcon kind={savedPlace.kind} size={14} />
                <Text style={styles.infoPlace} numberOfLines={1}>
                  {context.placeLabel}
                </Text>
              </View>
            ) : context.placeLabel ? (
              <Text style={styles.infoPlace} numberOfLines={1}>
                {context.placeLabel}
              </Text>
            ) : null}
          </View>
          <Text style={styles.infoStats}>
            {context.timeLabel} · {context.statsLabel}
          </Text>
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
        style={styles.voicePlayButton}>
        <View style={[styles.voicePlayCircle, {backgroundColor: theme.badgeBg}]}>
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
      </Pressable>
    </View>
  );
}

function NoteMomentPage({moment}: {moment: MomentRow}) {
  const moodLabel = moment.moodLabel?.trim();

  return (
    <ScrollView
      style={styles.noteScroll}
      contentContainerStyle={styles.noteScrollContent}
      showsVerticalScrollIndicator={false}>
      {moment.title?.trim() ? (
        <Text style={styles.noteTitle}>{moment.title.trim()}</Text>
      ) : null}
      {moment.textBody?.trim() ? (
        <Text style={styles.noteBody}>{moment.textBody.trim()}</Text>
      ) : null}
      {moodLabel ? <Text style={styles.noteMood}>Mood · {moodLabel}</Text> : null}
      {moment.contentPath ? (
        <MomentPreviewImage
          contentPath={moment.contentPath}
          style={styles.notePhoto}
          resizeMode="contain"
        />
      ) : null}
    </ScrollView>
  );
}

function MomentPagerPage({
  moment,
  pageWidth,
  isPlayingVoice,
  onToggleVoice,
}: {
  moment: MomentRow;
  pageWidth: number;
  isPlayingVoice: boolean;
  onToggleVoice: () => void;
}) {
  return (
    <View style={[styles.page, {width: pageWidth}]}>
      {moment.type === 'photo' && moment.contentPath ? (
        <MomentPreviewImage
          contentPath={moment.contentPath}
          style={styles.photoPage}
          resizeMode="contain"
        />
      ) : null}

      {moment.type === 'voice' ? (
        <VoiceMomentPage
          moment={moment}
          isPlaying={isPlayingVoice}
          onToggle={onToggleVoice}
        />
      ) : null}

      {moment.type === 'note' ? <NoteMomentPage moment={moment} /> : null}
    </View>
  );
}

function PaginationDots({count, activeIndex}: {count: number; activeIndex: number}) {
  if (count <= 1) {
    return null;
  }

  return (
    <View style={styles.dotsRow}>
      {Array.from({length: count}, (_, index) => (
        <View
          key={index}
          style={[styles.dot, index === activeIndex ? styles.dotActive : null]}
        />
      ))}
    </View>
  );
}

export function MomentsPreviewSheet({
  visible,
  moments,
  timelineEntries,
  savedPlaces,
  distanceUnit,
  onClose,
  onDeleteMoment,
}: MomentsPreviewSheetProps) {
  const insets = useSafeAreaInsets();
  const pageWidth = Dimensions.get('window').width;
  const momentContexts = useMomentPreviewContexts(
    moments,
    timelineEntries,
    savedPlaces,
    distanceUnit,
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<number | null>(null);
  const [deletingMomentId, setDeletingMomentId] = useState<number | null>(null);
  const pagerRef = useRef<FlatList<MomentRow>>(null);
  const playerRef = useRef(createVoiceRecorderSession());

  const activeMoment = moments[activeIndex] ?? null;

  const stopVoice = useCallback(async () => {
    try {
      await playerRef.current.stopPreview();
    } catch {
      // Not playing.
    }
    setPlayingVoiceId(null);
  }, []);

  const closeViewer = useCallback(() => {
    void stopVoice().finally(onClose);
  }, [onClose, stopVoice]);

  useEffect(() => {
    if (visible) {
      setActiveIndex(0);
      pagerRef.current?.scrollToOffset({offset: 0, animated: false});
    }
  }, [visible]);

  useEffect(() => {
    if (activeIndex >= moments.length) {
      const nextIndex = Math.max(0, moments.length - 1);
      setActiveIndex(nextIndex);
      pagerRef.current?.scrollToOffset({
        offset: nextIndex * pageWidth,
        animated: false,
      });
    }
  }, [activeIndex, moments.length, pageWidth]);

  useEffect(() => {
    if (visible && moments.length === 0) {
      closeViewer();
    }
  }, [closeViewer, moments.length, visible]);

  useEffect(() => {
    return () => {
      void stopVoice();
      playerRef.current.dispose();
    };
  }, [stopVoice]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      const clamped = Math.max(0, Math.min(index, moments.length - 1));
      if (clamped === activeIndex) {
        return;
      }
      setActiveIndex(clamped);
      const nextMoment = moments[clamped];
      if (
        playingVoiceId != null &&
        (nextMoment == null || nextMoment.id !== playingVoiceId)
      ) {
        void stopVoice();
      }
    },
    [activeIndex, moments, pageWidth, playingVoiceId, stopVoice],
  );

  const toggleVoice = useCallback(
    async (moment: MomentRow) => {
      if (!moment.contentPath) {
        return;
      }
      const existingPath = await resolveExistingMomentContentPath(moment.contentPath);
      if (!existingPath) {
        Alert.alert(
          'Voice memo unavailable',
          'The recording file is missing. Capture this moment again.',
        );
        return;
      }

      if (playingVoiceId === moment.id) {
        try {
          await playerRef.current.pausePreview();
          setPlayingVoiceId(null);
        } catch (error) {
          Alert.alert('Could not pause voice memo', getVoiceRecordingErrorMessage(error));
        }
        return;
      }

      try {
        await playerRef.current.stopPreview();
        await playerRef.current.startPreview(existingPath);
        setPlayingVoiceId(moment.id);
      } catch (error) {
        setPlayingVoiceId(null);
        Alert.alert('Could not play voice memo', getVoiceRecordingErrorMessage(error));
      }
    },
    [playingVoiceId],
  );

  const confirmDeleteMoment = useCallback(
    (moment: MomentRow) => {
      const noun = momentDeleteNoun(moment.type);
      Alert.alert(
        `Delete this ${noun}?`,
        'This cannot be undone.',
        [
          {text: 'Cancel', style: 'cancel'},
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
                  Alert.alert('Could not delete moment', 'Something went wrong. Try again.');
                } finally {
                  setDeletingMomentId(null);
                }
              })();
            },
          },
        ],
      );
    },
    [deletingMomentId, onDeleteMoment, playingVoiceId, stopVoice],
  );

  const renderPage = useCallback(
    ({item}: {item: MomentRow}) => (
      <MomentPagerPage
        moment={item}
        pageWidth={pageWidth}
        isPlayingVoice={playingVoiceId === item.id}
        onToggleVoice={() => void toggleVoice(item)}
      />
    ),
    [pageWidth, playingVoiceId, toggleVoice],
  );

  const keyExtractor = useCallback((item: MomentRow) => String(item.id), []);

  const headerContext = useMemo(
    () =>
      activeMoment != null ? momentContexts.get(activeMoment.id) : undefined,
    [activeMoment, momentContexts],
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={closeViewer}>
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
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={(_, index) => ({
            length: pageWidth,
            offset: pageWidth * index,
            index,
          })}
        />

        <View
          pointerEvents="box-none"
          style={[styles.topChrome, {paddingTop: insets.top + 8}]}>
          <View style={styles.topChromeRow}>
            {activeMoment ? (
              <MomentInfoHeader
                moment={activeMoment}
                context={headerContext}
                savedPlaces={savedPlaces}
                timelineEntries={timelineEntries}
              />
            ) : null}

            {activeMoment ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${momentDeleteNoun(activeMoment.type)}`}
                disabled={deletingMomentId === activeMoment.id}
                hitSlop={8}
                onPress={() => confirmDeleteMoment(activeMoment)}
                style={[
                  styles.topDeleteButton,
                  deletingMomentId === activeMoment.id ? styles.disabled : null,
                ]}>
                <Trash2 size={20} color="#FF453A" strokeWidth={2.25} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View
          pointerEvents="box-none"
          style={[styles.bottomChrome, {paddingBottom: insets.bottom + 16}]}>
          <View style={styles.bottomRow}>
            <View style={[styles.bottomRowSide, styles.bottomRowSideLeft]}>
              <View style={styles.bottomRowBalance} />
            </View>
            <PaginationDots count={moments.length} activeIndex={activeIndex} />
            <View style={[styles.bottomRowSide, styles.bottomRowSideRight]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close moments"
                onPress={closeViewer}
                hitSlop={8}
                style={styles.chromeIconButton}>
                <X size={22} color="#FFFFFF" strokeWidth={2.25} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
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
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  photoPage: {
    width: '100%',
    height: '100%',
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
    gap: 4,
  },
  infoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoTime: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoContext: {
    gap: 2,
  },
  infoPlaceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoKind: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  infoPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoPlace: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoStats: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '500',
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
  noteScroll: {
    flex: 1,
  },
  noteScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 120,
    paddingBottom: 80,
    gap: 12,
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
  noteMood: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  notePhoto: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    backgroundColor: '#111111',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  disabled: {
    opacity: 0.45,
  },
});
