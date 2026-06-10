import {Camera, AudioLines, NotebookPen} from 'lucide-react-native';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {
  CAPTURE_BUTTON_THEMES,
  CAPTURE_ICON_SIZE,
} from '@/components/map/map-capture-button-theme';
import type {MomentCounts} from '@/lib/moments/moment-counts';
import {hasMomentCounts} from '@/lib/moments/moment-counts';

type MomentCountsRowProps = {
  counts: MomentCounts;
  iconSize?: number;
  compact?: boolean;
  onPress?: () => void;
};

type MomentCountChipProps = {
  count: number;
  icon: typeof Camera;
  theme: (typeof CAPTURE_BUTTON_THEMES)['camera'];
  iconSize: number;
  compact: boolean;
};

function MomentCountChip({
  count,
  icon: Icon,
  theme,
  iconSize,
  compact,
}: MomentCountChipProps) {
  return (
    <View style={[styles.chip, compact ? styles.chipCompact : null]}>
      <View style={[styles.iconOrb, {backgroundColor: theme.badgeBg}]}>
        <Icon size={iconSize} color={theme.icon} strokeWidth={2.25} />
      </View>
      <Text style={[styles.count, compact ? styles.countCompact : null]}>{count}</Text>
    </View>
  );
}

export function MomentCountsRow({
  counts,
  iconSize = CAPTURE_ICON_SIZE - 2,
  compact = false,
  onPress,
}: MomentCountsRowProps) {
  if (!hasMomentCounts(counts)) {
    return null;
  }

  const row = (
    <View style={styles.row}>
      {counts.photo > 0 ? (
        <MomentCountChip
          count={counts.photo}
          icon={Camera}
          theme={CAPTURE_BUTTON_THEMES.camera}
          iconSize={iconSize}
          compact={compact}
        />
      ) : null}
      {counts.voice > 0 ? (
        <MomentCountChip
          count={counts.voice}
          icon={AudioLines}
          theme={CAPTURE_BUTTON_THEMES.voice}
          iconSize={iconSize}
          compact={compact}
        />
      ) : null}
      {counts.note > 0 ? (
        <MomentCountChip
          count={counts.note}
          icon={NotebookPen}
          theme={CAPTURE_BUTTON_THEMES.note}
          iconSize={iconSize}
          compact={compact}
        />
      ) : null}
    </View>
  );

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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipCompact: {
    gap: 4,
  },
  iconOrb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
  pressed: {
    opacity: 0.72,
  },
});
