import { useEffect, useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { Text } from '@/components/ui/text';

/** Compact glass segment bar (same chrome as activity field metrics). */
const BAR_HEIGHT = 36;
const H_PADDING = 5;
const ACTIVE_PILL_HEIGHT = 28;
const BAR_RADIUS = 12;
const PILL_RADIUS = 8;
const INDICATOR_SPRING = {
  damping: 17,
  stiffness: 190,
  mass: 0.8,
  reduceMotion: ReduceMotion.System,
};

export type InsightSegmentOption<Id extends string = string> = {
  id: Id;
  label: string;
  /** Optional fixed tab width; defaults from option count. */
  width?: number;
};

function defaultSegmentTabWidth(optionCount: number): number {
  if (optionCount <= 2) {
    return 100;
  }
  if (optionCount === 3) {
    return 80;
  }
  if (optionCount === 4) {
    return 72;
  }
  return 64;
}

function tabWidthsForOptions(
  options: readonly InsightSegmentOption[],
): number[] {
  const fallback = defaultSegmentTabWidth(options.length);
  return options.map(option => option.width ?? fallback);
}

/**
 * Animated glass pill selector — Photo / Video, Logs / field metrics, etc.
 */
export function InsightSegmentBar<Id extends string>({
  options,
  valueId,
  onChange,
  accent,
  muted,
}: {
  options: readonly InsightSegmentOption<Id>[];
  valueId: Id;
  onChange: (id: Id) => void;
  accent: string;
  muted: string;
}) {
  const colorScheme = useColorScheme();
  const activePillBg =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
  const widths = useMemo(() => tabWidthsForOptions(options), [options]);
  const selectedIndex = Math.max(
    0,
    options.findIndex(option => option.id === valueId),
  );
  const selectedTabWidth = widths[selectedIndex] ?? widths[0] ?? 72;
  const pillWidth = Math.max(24, selectedTabWidth - 14);
  const indicatorLeft = useMemo(() => {
    let x = 0;
    for (let i = 0; i < selectedIndex; i++) {
      x += widths[i] ?? 0;
    }
    return x + (selectedTabWidth - pillWidth) / 2;
  }, [pillWidth, selectedIndex, selectedTabWidth, widths]);

  const indicatorX = useSharedValue(indicatorLeft);
  const indicatorWidth = useSharedValue(pillWidth);
  const indicatorOpacity = useSharedValue(1);
  const indicatorScaleX = useSharedValue(1);
  const indicatorScaleY = useSharedValue(1);
  const parentScale = useSharedValue(1);

  useEffect(() => {
    indicatorX.value = withSpring(indicatorLeft, INDICATOR_SPRING);
    indicatorWidth.value = withSpring(pillWidth, INDICATOR_SPRING);
    indicatorOpacity.value = withSequence(
      withTiming(0.38, {
        duration: 80,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(0.38, {
        duration: 35,
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(1, {
        duration: 110,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
    indicatorScaleX.value = withSequence(
      withTiming(1.22, {
        duration: 120,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(1.22, {
        duration: 35,
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, INDICATOR_SPRING),
    );
    indicatorScaleY.value = withSequence(
      withTiming(1.18, {
        duration: 120,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(1.18, {
        duration: 35,
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, INDICATOR_SPRING),
    );
    parentScale.value = withSequence(
      withTiming(1.035, {
        duration: 105,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, INDICATOR_SPRING),
    );
  }, [
    indicatorLeft,
    indicatorOpacity,
    indicatorScaleX,
    indicatorScaleY,
    indicatorWidth,
    indicatorX,
    parentScale,
    pillWidth,
  ]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    width: indicatorWidth.value,
    transform: [
      { translateX: indicatorX.value },
      { scaleX: indicatorScaleX.value },
      { scaleY: indicatorScaleY.value },
    ],
  }));

  const parentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: parentScale.value }],
  }));

  if (options.length <= 1) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.shadowWrap, parentStyle]}>
        <AdaptiveGlassSurface style={styles.glass}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activePill,
              {
                backgroundColor: activePillBg,
                left: H_PADDING,
              },
              indicatorStyle,
            ]}
          />
          {options.map((option, index) => {
            const active = option.id === valueId;
            const width = widths[index] ?? defaultSegmentTabWidth(options.length);
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={option.label}
                onPress={() => onChange(option.id)}
                style={[styles.tab, { width }]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: active ? accent : muted,
                      fontWeight: active ? '800' : '600',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </AdaptiveGlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowWrap: {
    borderRadius: BAR_RADIUS,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  glass: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT,
    paddingHorizontal: H_PADDING,
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
  },
  activePill: {
    position: 'absolute',
    top: (BAR_HEIGHT - ACTIVE_PILL_HEIGHT) / 2,
    height: ACTIVE_PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
  },
  tab: {
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tabLabel: {
    fontSize: 12,
    letterSpacing: 0.15,
    textAlign: 'center',
  },
});
