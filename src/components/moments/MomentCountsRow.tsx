import {Activity, AudioLines, Camera, NotebookPen, Video} from 'lucide-react-native';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {
  CAPTURE_BUTTON_THEMES,
  CAPTURE_ICON_SIZE,
} from '@/components/map/map-capture-button-theme';
import type {MomentCountType, MomentCounts} from '@/lib/moments/moment-counts';
import {hasMomentCounts} from '@/lib/moments/moment-counts';

type MomentCountsRowLayout = 'inline' | 'stacked';

type MomentCountsRowProps = {
  counts: MomentCounts;
  iconSize?: number;
  compact?: boolean;
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
  layout,
  onPress,
  accessibilityLabel,
}: MomentCountChipProps) {
  const stacked = layout === 'stacked';
  const chip = stacked ? (
    <View style={styles.chipStacked}>
      <View style={[styles.iconOrb, styles.iconOrbStacked, {backgroundColor: theme.badgeBg}]}>
        <Icon size={iconSize - 2} color={theme.icon} strokeWidth={2.25} />
      </View>
      <Text style={styles.countStacked}>{count}</Text>
    </View>
  ) : (
    <View style={[styles.chip, compact ? styles.chipCompact : null]}>
      <View style={[styles.iconOrb, {backgroundColor: theme.badgeBg}]}>
        <Icon size={iconSize} color={theme.icon} strokeWidth={2.25} />
      </View>
      <Text style={[styles.count, compact ? styles.countCompact : null]}>{count}</Text>
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
      style={({pressed}) => [pressed ? styles.pressed : null]}>
      {chip}
    </Pressable>
  );
}

export function MomentCountsRow({
  counts,
  iconSize = CAPTURE_ICON_SIZE - 2,
  compact = false,
  layout = 'inline',
  onPress,
  onPressType,
}: MomentCountsRowProps) {
  if (!hasMomentCounts(counts)) {
    return null;
  }

  const row = (
    <View style={[styles.row, layout === 'stacked' ? styles.rowStacked : null]}>
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
            layout={layout}
            onPress={onPressType ? () => onPressType(definition.type) : undefined}
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
      style={({pressed}) => [pressed ? styles.pressed : null]}>
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
    flexWrap: 'wrap',
    gap: 10,
    rowGap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipCompact: {
    gap: 4,
  },
  chipStacked: {
    alignItems: 'center',
    gap: 3,
    minWidth: 30,
  },
  iconOrb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOrbStacked: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
  countStacked: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
