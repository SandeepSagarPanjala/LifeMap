import {
  Activity,
  AudioLines,
  Camera,
  NotebookPen,
  Video,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CAPTURE_BUTTON_THEMES,
  CAPTURE_ICON_SIZE,
} from '@/components/map/map-capture-button-theme';
import type {
  MomentCountType,
  MomentCounts,
} from '@/lib/moments/moment-counts';
import { hasMomentCounts } from '@/lib/moments/moment-counts';

type MomentCountsRowLayout = 'inline' | 'stacked';

type MomentCountsRowProps = {
  counts: MomentCounts;
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
];

type MomentCountChipProps = {
  count: number;
  icon: typeof Camera;
  theme: (typeof CAPTURE_BUTTON_THEMES)['camera'];
  iconSize: number;
  compact: boolean;
  dense: boolean;
  layout: MomentCountsRowLayout;
  onPress?: () => void;
  accessibilityLabel: string;
};

function MomentCountChip({
  count,
  icon: Icon,
  theme,
  iconSize,
  compact,
  dense,
  layout,
  onPress,
  accessibilityLabel,
}: MomentCountChipProps) {
  const stacked = layout === 'stacked';
  const chip = stacked ? (
    <View style={[styles.chipStacked, dense ? styles.chipStackedDense : null]}>
      <View
        style={[
          styles.iconOrb,
          styles.iconOrbStacked,
          dense ? styles.iconOrbStackedDense : null,
          { backgroundColor: theme.badgeBg },
        ]}
      >
        <Icon
          size={dense ? iconSize - 4 : iconSize - 2}
          color={theme.icon}
          strokeWidth={2.25}
        />
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
          { backgroundColor: theme.badgeBg },
        ]}
      >
        <Icon size={iconSize} color={theme.icon} strokeWidth={2.25} />
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
}

export function MomentCountsRow({
  counts,
  iconSize = CAPTURE_ICON_SIZE - 2,
  compact = false,
  dense = false,
  layout = 'stacked',
  onPress,
  onPressType,
}: MomentCountsRowProps) {
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
            icon={definition.icon}
            theme={definition.theme}
            iconSize={iconSize}
            compact={compact}
            dense={dense}
            layout={layout}
            onPress={
              onPressType ? () => onPressType(definition.type) : undefined
            }
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
