import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {AudioLines, Camera, NotebookPen, Pause, Play, Trash2, X} from 'lucide-react-native';

import {SavedPlaceIcon} from '@/components/map/SavedPlaceIcon';
import {CAPTURE_BUTTON_THEMES} from '@/components/map/map-capture-button-theme';
import {MomentPreviewImage} from '@/components/moments/MomentPreviewImage';
import {Text} from '@/components/ui/text';
import type {MomentRow} from '@/db/repositories/moments';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {useMomentPreviewContexts} from '@/hooks/use-moment-preview-contexts';
import {useThemeColors} from '@/hooks/use-theme-colors';
import type {DistanceUnit} from '@/lib/location-geo';
import {
  type MomentPreviewContext,
} from '@/lib/moments/moment-preview-context';
import {formatVoiceDurationMs} from '@/lib/moments/format-voice-duration';
import {resolveExistingMomentContentPath} from '@/lib/moments/moment-media-uri';
import {
  createVoiceRecorderSession,
  getVoiceRecordingErrorMessage,
} from '@/lib/moments/voice-recorder';
import {matchSavedPlaceForStay} from '@/lib/saved-places';
import type {DayTimelineEntry} from '@/lib/trip-detection';
import {formatTripClockTime} from '@/lib/trip-format';

const SHEET_OFFSCREEN = 520;

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

function MomentTypeIcon({moment}: {moment: MomentRow}) {
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
      <Icon size={18} color={theme.icon} strokeWidth={2.25} />
    </View>
  );
}

function VoicePreviewRow({
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Pause voice memo' : 'Play voice memo'}
      onPress={onToggle}
      style={styles.voiceRow}>
      <View style={[styles.playCircle, {backgroundColor: theme.badgeBg}]}>
        {isPlaying ? (
          <Pause size={20} color={theme.icon} strokeWidth={2.25} />
        ) : (
          <Play size={20} color={theme.icon} strokeWidth={2.25} />
        )}
      </View>
      <Text className="text-sm font-medium">
        {isPlaying ? 'Playing…' : 'Voice memo'}
        {duration ? ` · ${duration}` : ''}
      </Text>
    </Pressable>
  );
}

function MomentPreviewContextRow({
  context,
  savedPlaces,
  timelineEntries,
}: {
  context: MomentPreviewContext;
  savedPlaces: readonly SavedPlaceRow[];
  timelineEntries: DayTimelineEntry[];
}) {
  const stayEntry =
    context.entryKind === 'stay'
      ? timelineEntries.find(
          entry => entry.id === context.entryId && entry.kind === 'stay',
        )
      : null;
  const savedPlace =
    stayEntry?.kind === 'stay'
      ? matchSavedPlaceForStay(stayEntry, savedPlaces)
      : null;

  return (
    <View style={styles.contextRow}>
      <Text variant="muted" className="text-[10px] uppercase tracking-wide">
        {context.kindLabel}
      </Text>
      {savedPlace ? (
        <View style={styles.contextPlaceRow}>
          <SavedPlaceIcon kind={savedPlace.kind} size={14} />
          <Text className="text-sm font-semibold" numberOfLines={1}>
            {context.placeLabel}
          </Text>
        </View>
      ) : context.placeLabel ? (
        <Text className="text-sm font-semibold" numberOfLines={1}>
          {context.placeLabel}
        </Text>
      ) : null}
      <Text variant="muted" className="text-xs">
        {context.timeLabel} · {context.statsLabel}
      </Text>
    </View>
  );
}

function MomentPreviewCard({
  moment,
  context,
  savedPlaces,
  timelineEntries,
  isPlayingVoice,
  onToggleVoice,
  onDelete,
  deleting,
}: {
  moment: MomentRow;
  context?: MomentPreviewContext;
  savedPlaces: readonly SavedPlaceRow[];
  timelineEntries: DayTimelineEntry[];
  isPlayingVoice: boolean;
  onToggleVoice: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const moodLabel = moment.moodLabel?.trim();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MomentTypeIcon moment={moment} />
        <Text variant="muted" className="flex-1 text-sm">
          {formatTripClockTime(moment.timestamp)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${momentDeleteNoun(moment.type)}`}
          disabled={deleting}
          hitSlop={8}
          onPress={onDelete}
          style={[styles.deleteButton, deleting ? styles.deleteButtonDisabled : null]}>
          <Trash2 size={18} color="#FF3B30" strokeWidth={2.25} />
        </Pressable>
      </View>

      {context ? (
        <MomentPreviewContextRow
          context={context}
          savedPlaces={savedPlaces}
          timelineEntries={timelineEntries}
        />
      ) : null}

      {moment.type === 'photo' && moment.contentPath ? (
        <MomentPreviewImage contentPath={moment.contentPath} style={styles.photo} />
      ) : null}

      {moment.type === 'voice' ? (
        <VoicePreviewRow
          moment={moment}
          isPlaying={isPlayingVoice}
          onToggle={onToggleVoice}
        />
      ) : null}

      {moment.type === 'note' ? (
        <View style={styles.noteBody}>
          {moment.title?.trim() ? (
            <Text className="text-base font-semibold">{moment.title.trim()}</Text>
          ) : null}
          {moment.textBody?.trim() ? (
            <Text className="text-sm leading-5">{moment.textBody.trim()}</Text>
          ) : null}
          {moodLabel ? (
            <Text variant="muted" className="text-xs">
              Mood · {moodLabel}
            </Text>
          ) : null}
          {moment.contentPath ? (
            <MomentPreviewImage contentPath={moment.contentPath} style={styles.notePhoto} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function MomentsPreviewSheet({
  visible,
  title,
  moments,
  timelineEntries,
  savedPlaces,
  distanceUnit,
  previewEntry = null,
  onClose,
  onDeleteMoment,
}: MomentsPreviewSheetProps) {
  const colors = useThemeColors();
  const momentContexts = useMomentPreviewContexts(
    moments,
    timelineEntries,
    savedPlaces,
    distanceUnit,
  );
  const resolvedTitle = useMemo(() => {
    if (previewEntry?.kind === 'stay') {
      const firstContext = moments[0]
        ? momentContexts.get(moments[0].id)
        : undefined;
      const place = firstContext?.placeLabel?.trim();
      if (place) {
        return `${place} moments`;
      }
      return 'Visit moments';
    }

    if (moments.length === 1) {
      const context = momentContexts.get(moments[0]!.id);
      if (context?.placeLabel?.trim()) {
        return `${context.placeLabel.trim()} moments`;
      }
      if (context?.entryKind === 'stay') {
        return 'Visit moments';
      }
      if (context?.entryKind === 'travel') {
        return 'Drive moments';
      }
    }

    return title;
  }, [momentContexts, moments, previewEntry, title]);
  const [mounted, setMounted] = useState(visible);
  const [playingVoiceId, setPlayingVoiceId] = useState<number | null>(null);
  const [deletingMomentId, setDeletingMomentId] = useState<number | null>(null);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_OFFSCREEN)).current;
  const closingRef = useRef(false);
  const playerRef = useRef(createVoiceRecorderSession());

  const stopVoice = useCallback(async () => {
    try {
      await playerRef.current.stopPreview();
    } catch {
      // Not playing.
    }
    setPlayingVoiceId(null);
  }, []);

  useLayoutEffect(() => {
    if (visible) {
      closingRef.current = false;
      setMounted(true);
    }
  }, [visible]);

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
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    void stopVoice().finally(() => {
      animateOut(() => {
        closingRef.current = false;
        setMounted(false);
        onClose();
      });
    });
  }, [animateOut, onClose, stopVoice]);

  useEffect(() => {
    if (!visible && mounted && !closingRef.current) {
      closingRef.current = true;
      void stopVoice().finally(() => {
        animateOut(() => {
          closingRef.current = false;
          setMounted(false);
        });
      });
    }
  }, [animateOut, mounted, stopVoice, visible]);

  useEffect(() => {
    if (mounted && visible) {
      animateIn();
    }
  }, [animateIn, mounted, visible]);

  useEffect(() => {
    return () => {
      void stopVoice();
      playerRef.current.dispose();
    };
  }, [stopVoice]);

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

  useEffect(() => {
    if (visible && mounted && moments.length === 0) {
      closeSheet();
    }
  }, [closeSheet, mounted, moments.length, visible]);

  if (!mounted) {
    return null;
  }

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={closeSheet}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, {opacity: backdropOpacity}]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {backgroundColor: colors.background, transform: [{translateY: sheetTranslateY}]},
          ]}>
          <View style={styles.header}>
            <Text className="text-lg font-semibold">{resolvedTitle}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close moments preview"
              onPress={closeSheet}
              hitSlop={8}
              style={styles.closeButton}>
              <X size={20} color={colors.mutedForeground} strokeWidth={2.25} />
            </Pressable>
          </View>

          {moments.length === 0 ? (
            <View style={styles.empty}>
              <Text variant="muted">No moments to preview.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              {moments.map(moment => (
                <MomentPreviewCard
                  key={moment.id}
                  moment={moment}
                  context={momentContexts.get(moment.id)}
                  savedPlaces={savedPlaces}
                  timelineEntries={timelineEntries}
                  isPlayingVoice={playingVoiceId === moment.id}
                  onToggleVoice={() => void toggleVoice(moment)}
                  onDelete={() => confirmDeleteMoment(moment)}
                  deleting={deletingMomentId === moment.id}
                />
              ))}
            </ScrollView>
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
  sheet: {
    maxHeight: '72%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  empty: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contextRow: {
    gap: 2,
    paddingBottom: 2,
  },
  contextPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.45,
  },
  typeOrb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBody: {
    gap: 8,
  },
  notePhoto: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
  },
});
