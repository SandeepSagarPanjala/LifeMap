import {
  AudioLines,
  Camera,
  NotebookPen,
  Play,
  Sparkles,
  Video,
} from 'lucide-react-native';
import { memo, useMemo, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CAPTURE_BUTTON_THEMES } from '@/components/map/map-capture-button-theme';
import type { MomentRow } from '@/db/repositories/moments';
import { momentImageUri } from '@/lib/moments/moment-media-uri';
import {
  getMoodArtPresentation,
  resolveEmotionFromMoodLabel,
  resolveMoodVariantFromMoment,
} from '@/lib/moments/mood-art';
import { formatTripClockTime } from '@/lib/trip-format';

export const GALLERY_TILE_GAP = 4;
export const GALLERY_TILE_COLUMNS = 3;
/** Side margin around the grid — matches Photos-style inset. */
export const GALLERY_GRID_INSET = 14;
export const GALLERY_TILE_RADIUS = 12;

type GalleryMomentTileProps = {
  moment: MomentRow;
  size: number;
  placeLabel?: string | null;
  onPress: () => void;
};

function GalleryMomentTileComponent({
  moment,
  size,
  placeLabel = null,
  onPress,
}: GalleryMomentTileProps) {
  const timeLabel = useMemo(
    () => formatTripClockTime(moment.timestamp),
    [moment.timestamp],
  );

  const thumbUri =
    moment.thumbnailPath != null
      ? momentImageUri(moment.thumbnailPath)
      : null;

  const isMedia =
    (moment.type === 'photo' || moment.type === 'video') && thumbUri != null;

  const trimmedPlace = placeLabel?.trim() || null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        trimmedPlace
          ? `${moment.type} at ${timeLabel}, ${trimmedPlace}`
          : `${moment.type} at ${timeLabel}`
      }
      onPress={onPress}
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: GALLERY_TILE_RADIUS,
        },
      ]}
    >
      {isMedia ? (
        <Image
          source={{ uri: thumbUri }}
          style={styles.media}
          resizeMode="cover"
        />
      ) : (
        <TypeFallback moment={moment} />
      )}

      {moment.type === 'video' ? (
        <View style={styles.videoBadge}>
          <Play size={12} color="#fff" fill="#fff" />
        </View>
      ) : null}

      <View style={styles.timeBar}>
        <Text style={styles.timeText} numberOfLines={1}>
          {timeLabel}
        </Text>
        {trimmedPlace ? (
          <Text style={styles.placeText} numberOfLines={1}>
            {trimmedPlace}
          </Text>
        ) : (
          <View style={styles.placeLineTrack}>
            <View style={styles.placeLine} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function FallbackShell({
  backgroundColor,
  icon,
  label,
  labelColor,
}: {
  backgroundColor: string;
  icon: ReactNode;
  label?: string | null;
  labelColor?: string;
}) {
  const trimmed = label?.trim() || null;
  return (
    <View style={[styles.fallback, { backgroundColor }]}>
      {/* Icon + type label centered as one group above the time bar. */}
      <View style={styles.iconZone}>
        {icon}
        {trimmed != null ? (
          <Text
            style={[
              styles.typeLabel,
              labelColor != null ? { color: labelColor } : null,
            ]}
            numberOfLines={2}
          >
            {trimmed}
          </Text>
        ) : null}
      </View>
      <View style={styles.timeBarSpacer} />
    </View>
  );
}

function TypeFallback({ moment }: { moment: MomentRow }) {
  if (moment.type === 'activity') {
    return (
      <FallbackShell
        backgroundColor={CAPTURE_BUTTON_THEMES.activity.badgeBg}
        icon={
          <Text style={styles.activityEmoji} numberOfLines={1}>
            {moment.activityEmoji ?? '•'}
          </Text>
        }
        label={moment.activityLabel ?? 'Activity'}
        labelColor={CAPTURE_BUTTON_THEMES.activity.icon}
      />
    );
  }

  if (moment.type === 'note') {
    return (
      <FallbackShell
        backgroundColor={CAPTURE_BUTTON_THEMES.note.badgeBg}
        icon={
          <NotebookPen size={28} color={CAPTURE_BUTTON_THEMES.note.icon} />
        }
        label="Diary"
        labelColor={CAPTURE_BUTTON_THEMES.note.icon}
      />
    );
  }

  if (moment.type === 'voice') {
    return (
      <FallbackShell
        backgroundColor={CAPTURE_BUTTON_THEMES.voice.badgeBg}
        icon={
          <AudioLines size={32} color={CAPTURE_BUTTON_THEMES.voice.icon} />
        }
      />
    );
  }

  if (moment.type === 'mood') {
    const emotion = resolveEmotionFromMoodLabel(moment.moodLabel);
    const variant = resolveMoodVariantFromMoment(moment.moodVariant);
    const art = emotion
      ? getMoodArtPresentation(emotion.id, variant)
      : null;
    return (
      <FallbackShell
        backgroundColor={
          emotion?.tint ?? CAPTURE_BUTTON_THEMES.mood.badgeBg
        }
        icon={
          art ? (
            <Image
              source={art.imageSource}
              resizeMode="contain"
              style={styles.moodSticker}
            />
          ) : (
            <Sparkles size={28} color={CAPTURE_BUTTON_THEMES.mood.icon} />
          )
        }
        label={emotion?.label ?? moment.moodLabel ?? 'Mood'}
        labelColor={CAPTURE_BUTTON_THEMES.mood.icon}
      />
    );
  }

  return (
    <FallbackShell
      backgroundColor={CAPTURE_BUTTON_THEMES.camera.badgeBg}
      icon={
        moment.type === 'video' ? (
          <Video size={28} color={CAPTURE_BUTTON_THEMES.camera.icon} />
        ) : (
          <Camera size={28} color={CAPTURE_BUTTON_THEMES.camera.icon} />
        )
      }
    />
  );
}

export const GalleryMomentTile = memo(GalleryMomentTileComponent);

/** Matches time + place/line + vertical padding in `timeBar`. */
const TIME_BAR_HEIGHT = 36;

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    backgroundColor: '#E8E8ED',
  },
  media: {
    ...StyleSheet.absoluteFillObject,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 6,
  },
  iconZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  timeBarSpacer: {
    height: TIME_BAR_HEIGHT,
  },
  activityEmoji: {
    fontSize: 40,
    lineHeight: 46,
  },
  moodSticker: {
    width: 44,
    height: 44,
  },
  videoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: TIME_BAR_HEIGHT,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'center',
    gap: 2,
  },
  timeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  placeText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 10,
    fontWeight: '500',
  },
  placeLineTrack: {
    height: 12,
    justifyContent: 'center',
  },
  placeLine: {
    height: StyleSheet.hairlineWidth * 2,
    width: '72%',
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});
