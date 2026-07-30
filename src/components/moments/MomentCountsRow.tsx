import {
  Activity,
  AudioLines,
  Camera,
  NotebookPen,
  Sparkles,
  Video,
} from 'lucide-react-native';
import { memo, useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

import {
  CAPTURE_BUTTON_THEMES,
  CAPTURE_ICON_SIZE,
} from '@/components/map/map-capture-button-theme';
import type {
  MomentCountPreviews,
  MomentCountType,
  MomentCounts,
} from '@/lib/moments/moment-counts';
import { hasMomentCounts } from '@/lib/moments/moment-counts';
import {
  getMoodArtPresentation,
  resolveEmotionFromMoodLabel,
  resolveMoodVariantFromMoment,
} from '@/lib/moments/mood-art';

type MomentCountsRowLayout = 'inline' | 'stacked';

type MomentCountsRowProps = {
  counts: MomentCounts;
  /** Latest rich chip content for photo/video/activity/mood. */
  previews?: MomentCountPreviews | null;
  iconSize?: number;
  compact?: boolean;
  /** Tighter stacked chips for small map cluster bubbles. */
  dense?: boolean;
  layout?: MomentCountsRowLayout;
  onPress?: () => void;
  onPressType?: (type: MomentCountType) => void;
};

type ChipDefinition = {
  type: MomentCountType;
  icon: typeof Camera;
  theme: (typeof CAPTURE_BUTTON_THEMES)['camera'];
  accessibilityLabel: string;
};

const CHIP_DEFINITIONS: ChipDefinition[] = [
  {
    type: 'photo',
    icon: Camera,
    theme: CAPTURE_BUTTON_THEMES.camera,
    accessibilityLabel: 'Preview photo moments',
  },
  {
    type: 'video',
    icon: Video,
    theme: CAPTURE_BUTTON_THEMES.camera,
    accessibilityLabel: 'Preview video moments',
  },
  {
    type: 'voice',
    icon: AudioLines,
    theme: CAPTURE_BUTTON_THEMES.voice,
    accessibilityLabel: 'Preview voice moments',
  },
  {
    type: 'note',
    icon: NotebookPen,
    theme: CAPTURE_BUTTON_THEMES.note,
    accessibilityLabel: 'Preview diary moments',
  },
  {
    type: 'activity',
    icon: Activity,
    theme: CAPTURE_BUTTON_THEMES.activity,
    accessibilityLabel: 'Preview activity moments',
  },
  {
    type: 'mood',
    icon: Sparkles,
    theme: CAPTURE_BUTTON_THEMES.mood,
    accessibilityLabel: 'Preview mood moments',
  },
];

type ChipVisual =
  | { kind: 'icon'; icon: typeof Camera }
  | { kind: 'image'; uri: string }
  | { kind: 'emoji'; emoji: string }
  | { kind: 'mood'; source: ImageSourcePropType; tint: string };

function resolveChipVisual(
  type: MomentCountType,
  fallbackIcon: typeof Camera,
  previews: MomentCountPreviews | null | undefined,
): ChipVisual {
  if (previews == null) {
    return { kind: 'icon', icon: fallbackIcon };
  }
  if (type === 'photo' && previews.photoThumbUri) {
    return { kind: 'image', uri: previews.photoThumbUri };
  }
  if (type === 'video' && previews.videoThumbUri) {
    return { kind: 'image', uri: previews.videoThumbUri };
  }
  if (type === 'activity' && previews.activityEmoji) {
    return { kind: 'emoji', emoji: previews.activityEmoji };
  }
  if (type === 'mood' && previews.moodLabel) {
    const emotion = resolveEmotionFromMoodLabel(previews.moodLabel);
    if (emotion != null) {
      const variant = resolveMoodVariantFromMoment(previews.moodVariant);
      const art = getMoodArtPresentation(emotion.id, variant);
      return {
        kind: 'mood',
        source: art.imageSource,
        tint: emotion.tint,
      };
    }
  }
  return { kind: 'icon', icon: fallbackIcon };
}

type MomentCountChipProps = {
  count: number;
  visual: ChipVisual;
  theme: (typeof CAPTURE_BUTTON_THEMES)['camera'];
  iconSize: number;
  compact: boolean;
  dense: boolean;
  layout: MomentCountsRowLayout;
  onPress?: () => void;
  accessibilityLabel: string;
};

const MomentCountChip = memo(function MomentCountChip({
  count,
  visual,
  theme,
  iconSize,
  compact,
  dense,
  layout,
  onPress,
  accessibilityLabel,
}: MomentCountChipProps) {
  const stacked = layout === 'stacked';
  const orbSize = dense
    ? stacked
      ? 22
      : 18
    : stacked
      ? 26
      : 28;
  const glyphSize = dense ? iconSize - (stacked ? 4 : 0) : stacked ? iconSize - 2 : iconSize;

  const orbContent =
    visual.kind === 'image' ? (
      <Image
        source={{ uri: visual.uri }}
        style={[styles.previewImage, { width: orbSize, height: orbSize }]}
        resizeMode="cover"
      />
    ) : visual.kind === 'emoji' ? (
      <Text
        style={[
          styles.previewEmoji,
          { fontSize: dense ? glyphSize + 1 : glyphSize + 2 },
        ]}
        allowFontScaling={false}
      >
        {visual.emoji}
      </Text>
    ) : visual.kind === 'mood' ? (
      <Image
        source={visual.source}
        style={[
          styles.moodSticker,
          {
            width: orbSize - (dense ? 4 : 6),
            height: orbSize - (dense ? 4 : 6),
          },
        ]}
        resizeMode="contain"
      />
    ) : (
      <visual.icon
        size={glyphSize}
        color={theme.icon}
        strokeWidth={2.25}
      />
    );

  const orbBackground =
    visual.kind === 'image'
      ? '#E8E8ED'
      : visual.kind === 'mood'
        ? visual.tint
        : theme.badgeBg;

  const chip = stacked ? (
    <View style={[styles.chipStacked, dense ? styles.chipStackedDense : null]}>
      <View
        style={[
          styles.iconOrb,
          styles.iconOrbStacked,
          dense ? styles.iconOrbStackedDense : null,
          visual.kind === 'image' ? styles.iconOrbClipped : null,
          { backgroundColor: orbBackground },
        ]}
      >
        {orbContent}
      </View>
      <Text
        style={[styles.countStacked, dense ? styles.countStackedDense : null]}
      >
        {count}
      </Text>
    </View>
  ) : (
    <View
      style={[
        styles.chip,
        compact ? styles.chipCompact : null,
        dense ? styles.chipInlineDense : null,
      ]}
    >
      <View
        style={[
          styles.iconOrb,
          dense ? styles.iconOrbInlineDense : null,
          visual.kind === 'image' ? styles.iconOrbClipped : null,
          { backgroundColor: orbBackground },
        ]}
      >
        {orbContent}
      </View>
      <Text
        style={[
          styles.count,
          compact ? styles.countCompact : null,
          dense ? styles.countInlineDense : null,
        ]}
      >
        {count}
      </Text>
    </View>
  );

  if (!onPress) {
    return chip;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.pressed : null]}
    >
      {chip}
    </Pressable>
  );
});

function MomentCountsRowComponent({
  counts,
  previews = null,
  iconSize = CAPTURE_ICON_SIZE - 2,
  compact = false,
  dense = false,
  layout = 'stacked',
  onPress,
  onPressType,
}: MomentCountsRowProps) {
  // Stable per-type handlers so memoized chips don't re-render on every parent
  // render just because a fresh inline closure was created.
  const typeHandlers = useMemo(() => {
    if (!onPressType) {
      return null;
    }
    const handlers = {} as Record<MomentCountType, () => void>;
    for (const definition of CHIP_DEFINITIONS) {
      handlers[definition.type] = () => onPressType(definition.type);
    }
    return handlers;
  }, [onPressType]);

  if (!hasMomentCounts(counts)) {
    return null;
  }

  const row = (
    <View
      style={[
        styles.row,
        layout === 'stacked'
          ? [styles.rowStacked, dense ? styles.rowStackedDense : null]
          : dense
            ? styles.rowInlineDense
            : null,
      ]}
    >
      {CHIP_DEFINITIONS.map(definition => {
        const count = counts[definition.type];
        if (count <= 0) {
          return null;
        }

        return (
          <MomentCountChip
            key={definition.type}
            count={count}
            visual={resolveChipVisual(
              definition.type,
              definition.icon,
              previews,
            )}
            theme={definition.theme}
            iconSize={iconSize}
            compact={compact}
            dense={dense}
            layout={layout}
            onPress={typeHandlers ? typeHandlers[definition.type] : undefined}
            accessibilityLabel={definition.accessibilityLabel}
          />
        );
      })}
    </View>
  );

  if (onPressType) {
    return row;
  }

  if (!onPress) {
    return row;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Preview moments"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.pressed : null]}
    >
      {row}
    </Pressable>
  );
}

export const MomentCountsRow = memo(MomentCountsRowComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowStacked: {
    justifyContent: 'center',
    flexWrap: 'nowrap',
    gap: 10,
  },
  rowStackedDense: {
    gap: 6,
  },
  rowInlineDense: {
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipCompact: {
    gap: 4,
  },
  chipInlineDense: {
    gap: 3,
  },
  chipStacked: {
    alignItems: 'center',
    gap: 3,
    minWidth: 30,
  },
  chipStackedDense: {
    gap: 2,
  },
  iconOrb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOrbClipped: {
    overflow: 'hidden',
  },
  iconOrbInlineDense: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  iconOrbStacked: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  iconOrbStackedDense: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  previewImage: {
    borderRadius: 999,
  },
  previewEmoji: {
    textAlign: 'center',
    lineHeight: undefined,
  },
  moodSticker: {
    // sized inline
  },
  count: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    minWidth: 12,
  },
  countCompact: {
    fontSize: 13,
  },
  countInlineDense: {
    fontSize: 11,
    minWidth: 10,
  },
  countStacked: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  countStackedDense: {
    fontSize: 10,
  },
  pressed: {
    opacity: 0.72,
  },
});
