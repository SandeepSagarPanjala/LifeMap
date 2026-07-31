import type { LucideIcon } from 'lucide-react-native';
import { Footprints, Moon } from 'lucide-react-native';
import { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  MAP_STACK_BUTTON_GAP,
  MAP_STACK_BUTTON_LEFT,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import {
  formatSleepChipLabel,
  formatStepsChipLabel,
} from '@/lib/healthkit/display';

export const MAP_HEALTH_CHIP_HEIGHT = 36;
export const MAP_HEALTH_CHIP_ICON_SIZE = 16;

type MapHealthMetricChipProps = {
  bottom: number;
  kind: 'sleep' | 'steps';
  /** Null / missing → "No data". */
  value: number | null;
  onPress?: () => void;
};

function MetricChip({
  bottom,
  icon: Icon,
  label,
  accessibilityLabel,
  onPress,
}: {
  bottom: number;
  icon: LucideIcon;
  label: string;
  accessibilityLabel: string;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  const muted = label === 'No data';
  const interactive = onPress != null;

  const content = (
    <View style={styles.shadow}>
      <AdaptiveGlassSurface style={styles.surface}>
        <View style={styles.content}>
          <Icon
            size={MAP_HEALTH_CHIP_ICON_SIZE}
            color={muted ? colors.mutedForeground : colors.primary}
            strokeWidth={2.25}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              {
                color: muted ? colors.mutedForeground : colors.primary,
              },
            ]}
          >
            {label}
          </Text>
        </View>
      </AdaptiveGlassSurface>
    </View>
  );

  return (
    <View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={[styles.wrap, { bottom, left: MAP_STACK_BUTTON_LEFT }]}
    >
      {interactive ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
        >
          {content}
        </Pressable>
      ) : (
        <View accessibilityRole="text" accessibilityLabel={accessibilityLabel}>
          {content}
        </View>
      )}
    </View>
  );
}

export const MapHealthMetricChip = memo(function MapHealthMetricChip({
  bottom,
  kind,
  value,
  onPress,
}: MapHealthMetricChipProps) {
  if (kind === 'sleep') {
    const label = formatSleepChipLabel(value);
    return (
      <MetricChip
        bottom={bottom}
        icon={Moon}
        label={label}
        accessibilityLabel={
          label === 'No data' ? 'Sleep, no data' : `Sleep ${label}`
        }
        onPress={onPress}
      />
    );
  }

  const label = formatStepsChipLabel(value);
  return (
    <MetricChip
      bottom={bottom}
      icon={Footprints}
      label={label}
      accessibilityLabel={
        label === 'No data' ? 'Steps, no data' : label
      }
      onPress={onPress}
    />
  );
});

/** Bottom offset for a chip stacked above History (index 0 = History). */
export function mapHealthChipBottom(
  historyBottom: number,
  indexAboveHistory: number,
): number {
  return (
    historyBottom +
    MAP_STACK_BUTTON_SIZE +
    MAP_STACK_BUTTON_GAP +
    indexAboveHistory * (MAP_HEALTH_CHIP_HEIGHT + MAP_STACK_BUTTON_GAP)
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    height: MAP_HEALTH_CHIP_HEIGHT,
    maxWidth: 168,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  shadow: {
    borderRadius: MAP_HEALTH_CHIP_HEIGHT / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },
  surface: {
    height: MAP_HEALTH_CHIP_HEIGHT,
    borderRadius: MAP_HEALTH_CHIP_HEIGHT / 2,
    overflow: 'hidden',
    paddingHorizontal: 12,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
});
