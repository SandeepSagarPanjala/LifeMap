import {
  Activity,
  AudioLines,
  Camera,
  NotebookPen,
  Sparkles,
  Video,
} from 'lucide-react-native';
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import {
  CAPTURE_BUTTON_THEMES,
  CAPTURE_ICON_SIZE,
} from '@/components/map/map-capture-button-theme';
import type {
  MomentCountPreviews,
  MomentCountType,
  MomentCounts,
} from '@/lib/moments/moment-counts';
import { hasMomentCounts, countMomentCountChips } from '@/lib/moments/moment-counts';
import {
  getMoodArtPresentation,
  resolveEmotionFromMoodLabel,
  resolveMoodVariantFromMoment,
} from '@/lib/moments/mood-art';

/** Stay card fits ~6 stacked chips; beyond that the row scrolls. */
export const MOMENT_COUNTS_SCROLL_AFTER = 6;

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
  /** Lock map pan while the chip strip is scrolling. */
  onScrollActiveChange?: (active: boolean) => void;
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
  onScrollActiveChange,
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

  const chipCount = useMemo(
    () => countMomentCountChips(counts, previews),
    [counts, previews],
  );
  const scrollable = chipCount > MOMENT_COUNTS_SCROLL_AFTER;
  const scrollRef = useRef<ScrollView>(null);
  const timelineSignature = useMemo(() => {
    const timeline = previews?.chipTimeline;
    if (timeline != null && timeline.length > 0) {
      return timeline
        .map(entry =>
          entry.kind === 'activity'
            ? `a:${entry.activityId ?? ''}:${entry.emoji}:${entry.count}:${entry.latestMs}`
            : `t:${entry.type}:${entry.count}:${entry.latestMs}`,
        )
        .join('|');
    }
    return `counts:${counts.photo}:${counts.video}:${counts.voice}:${counts.note}:${counts.activity}:${counts.mood}`;
  }, [counts, previews]);
  // Stay hidden until scrollToEnd so we never paint oldest-first then jump.
  const [pinnedSignature, setPinnedSignature] = useState<string | null>(null);
  const scrollPinned = !scrollable || pinnedSignature === timelineSignature;

  const setScrollActive = useCallback(
    (active: boolean) => {
      onScrollActiveChange?.(active);
    },
    [onScrollActiveChange],
  );

  const scrollToNewest = useCallback(() => {
    if (!scrollable) {
      return;
    }
    // Oldest are on the left; pin to the end so newest stay visible.
    scrollRef.current?.scrollToEnd({ animated: false });
    setPinnedSignature(timelineSignature);
  }, [scrollable, timelineSignature]);

  useLayoutEffect(() => {
    if (!scrollable) {
      setPinnedSignature(null);
      return;
    }
    scrollToNewest();
  }, [scrollToNewest, scrollable, timelineSignature]);

  const definitionByType = useMemo(() => {
    const map = {} as Record<MomentCountType, (typeof CHIP_DEFINITIONS)[number]>;
    for (const definition of CHIP_DEFINITIONS) {
      map[definition.type] = definition;
    }
    return map;
  }, []);

  const chips = useMemo(() => {
    const timeline = previews?.chipTimeline;
    if (timeline != null && timeline.length > 0) {
      return timeline.map(entry => {
        if (entry.kind === 'activity') {
          const definition = definitionByType.activity;
          return (
            <MomentCountChip
              key={`activity-${entry.activityId ?? entry.emoji}-${entry.latestMs}`}
              count={entry.count}
              visual={{ kind: 'emoji', emoji: entry.emoji }}
              theme={definition.theme}
              iconSize={iconSize}
              compact={compact}
              dense={dense}
              layout={layout}
              onPress={typeHandlers ? typeHandlers.activity : undefined}
              accessibilityLabel={definition.accessibilityLabel}
            />
          );
        }
        const definition = definitionByType[entry.type];
        return (
          <MomentCountChip
            key={`${entry.type}-${entry.latestMs}`}
            count={entry.count}
            visual={resolveChipVisual(entry.type, definition.icon, previews)}
            theme={definition.theme}
            iconSize={iconSize}
            compact={compact}
            dense={dense}
            layout={layout}
            onPress={typeHandlers ? typeHandlers[entry.type] : undefined}
            accessibilityLabel={definition.accessibilityLabel}
          />
        );
      });
    }

    return CHIP_DEFINITIONS.flatMap(definition => {
      if (definition.type === 'activity') {
        const summaries = previews?.activitySummaries;
        if (summaries != null && summaries.length > 0) {
          return summaries.map(summary => (
            <MomentCountChip
              key={`activity-${summary.activityId ?? summary.emoji}`}
              count={summary.count}
              visual={{ kind: 'emoji', emoji: summary.emoji }}
              theme={definition.theme}
              iconSize={iconSize}
              compact={compact}
              dense={dense}
              layout={layout}
              onPress={typeHandlers ? typeHandlers.activity : undefined}
              accessibilityLabel={definition.accessibilityLabel}
            />
          ));
        }
      }

      const count = counts[definition.type];
      if (count <= 0) {
        return [];
      }

      return [
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
        />,
      ];
    });
  }, [
    compact,
    counts,
    definitionByType,
    dense,
    iconSize,
    layout,
    previews,
    typeHandlers,
  ]);

  if (!hasMomentCounts(counts)) {
    return null;
  }

  const rowStyle = [
    styles.row,
    layout === 'stacked'
      ? [styles.rowStacked, dense ? styles.rowStackedDense : null]
      : dense
        ? styles.rowInlineDense
        : null,
    scrollable ? styles.rowScrollable : null,
  ];

  const row = scrollable ? (
    <ScrollView
      ref={scrollRef}
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bounces={false}
      style={[
        styles.rowScroll,
        dense && layout === 'inline' ? styles.rowScrollDenseInline : null,
        scrollPinned ? null : styles.rowScrollPending,
      ]}
      contentContainerStyle={[
        styles.rowScrollContent,
        dense && layout === 'inline' ? styles.rowScrollContentDenseInline : null,
        layout === 'stacked'
          ? dense
            ? styles.rowStackedDense
            : styles.rowStackedGap
          : dense
            ? styles.rowInlineDense
            : null,
      ]}
      onContentSizeChange={scrollToNewest}
      onLayout={scrollToNewest}
      onScrollBeginDrag={() => setScrollActive(true)}
      onScrollEndDrag={() => setScrollActive(false)}
      onMomentumScrollEnd={() => setScrollActive(false)}
      onTouchStart={() => setScrollActive(true)}
      onTouchEnd={() => setScrollActive(false)}
      onTouchCancel={() => setScrollActive(false)}
    >
      {chips}
    </ScrollView>
  ) : (
    <View style={rowStyle}>{chips}</View>
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
  rowStackedGap: {
    gap: 10,
  },
  rowInlineDense: {
    gap: 6,
  },
  rowScrollable: {
    justifyContent: 'flex-start',
  },
  rowScroll: {
    alignSelf: 'stretch',
    maxWidth: '100%',
  },
  /** Map markers: keep one chip-row tall — unconstrained ScrollView can inflate. */
  rowScrollDenseInline: {
    height: 22,
    maxHeight: 22,
    flexGrow: 0,
    alignSelf: 'center',
  },
  rowScrollPending: {
    opacity: 0,
  },
  rowScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
  },
  rowScrollContentDenseInline: {
    flexGrow: 0,
    paddingVertical: 0,
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
