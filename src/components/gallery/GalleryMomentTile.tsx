import {
  AudioLines,
  Camera,
  NotebookPen,
  Play,
  Video,
} from 'lucide-react-native';
import { memo, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CAPTURE_BUTTON_THEMES } from '@/components/map/map-capture-button-theme';
import type { MomentRow } from '@/db/repositories/moments';
import { momentImageUri } from '@/lib/moments/moment-media-uri';
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
        ) : null}
      </View>
    </Pressable>
  );
}

function TypeFallback({ moment }: { moment: MomentRow }) {
  if (moment.type === 'activity') {
    return (
      <View
        style={[
          styles.fallback,
          { backgroundColor: CAPTURE_BUTTON_THEMES.activity.badgeBg },
        ]}
      >
        <Text style={styles.activityEmoji} numberOfLines={1}>
          {moment.activityEmoji ?? '•'}
        </Text>
        <Text style={styles.activityLabel} numberOfLines={2}>
          {moment.activityLabel ?? 'Activity'}
        </Text>
      </View>
    );
  }

  if (moment.type === 'note') {
    return (
      <View
        style={[
          styles.fallback,
          { backgroundColor: CAPTURE_BUTTON_THEMES.note.badgeBg },
        ]}
      >
        <NotebookPen size={28} color={CAPTURE_BUTTON_THEMES.note.icon} />
      </View>
    );
  }

  if (moment.type === 'voice') {
    return (
      <View
        style={[
          styles.fallback,
          { backgroundColor: CAPTURE_BUTTON_THEMES.voice.badgeBg },
        ]}
      >
        <AudioLines size={32} color={CAPTURE_BUTTON_THEMES.voice.icon} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { backgroundColor: CAPTURE_BUTTON_THEMES.camera.badgeBg },
      ]}
    >
      {moment.type === 'video' ? (
        <Video size={28} color={CAPTURE_BUTTON_THEMES.camera.icon} />
      ) : (
        <Camera size={28} color={CAPTURE_BUTTON_THEMES.camera.icon} />
      )}
    </View>
  );
}

export const GalleryMomentTile = memo(GalleryMomentTileComponent);

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    backgroundColor: '#E8E8ED',
  },
  media: {
    ...StyleSheet.absoluteFillObject,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 4,
  },
  activityEmoji: {
    fontSize: 40,
    lineHeight: 46,
  },
  activityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: CAPTURE_BUTTON_THEMES.activity.icon,
    textAlign: 'center',
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
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.38)',
    gap: 1,
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
});
