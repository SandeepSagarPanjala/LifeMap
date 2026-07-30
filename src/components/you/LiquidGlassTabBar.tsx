import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { X } from 'lucide-react-native';
import {
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { useEffect } from 'react';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';

/** Match MapMomentsGlassBar tab geometry. */
const TAB_SIZE = 44;
const ICON_SIZE = 22;
const H_PADDING = 4;
/** Instagram-style active chip behind the focused tab icon. */
const ACTIVE_PILL_SIZE = 36;
const INDICATOR_SPRING = {
  damping: 17,
  stiffness: 190,
  mass: 0.8,
  reduceMotion: ReduceMotion.System,
};

export function LiquidGlassTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const accent = colors.primary;
  const activePillBg =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
  const indicatorX = useSharedValue(state.index * TAB_SIZE);
  const indicatorOpacity = useSharedValue(1);
  const indicatorScaleX = useSharedValue(1);
  const indicatorScaleY = useSharedValue(1);
  const parentScale = useSharedValue(1);

  useEffect(() => {
    indicatorX.value = withSpring(state.index * TAB_SIZE, INDICATOR_SPRING);
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
    indicatorOpacity,
    indicatorScaleX,
    indicatorScaleY,
    indicatorX,
    parentScale,
    state.index,
  ]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [
      { translateX: indicatorX.value },
      { scaleX: indicatorScaleX.value },
      { scaleY: indicatorScaleY.value },
    ],
  }));

  const parentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: parentScale.value }],
  }));

  const onClose = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
      return;
    }
    navigation.goBack();
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) },
      ]}
    >
      <View style={styles.row}>
        <Animated.View style={[styles.shadowWrap, parentStyle]}>
          <AdaptiveGlassSurface style={styles.pill}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activePill,
                { backgroundColor: activePillBg },
                indicatorStyle,
              ]}
            />
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const isFocused = state.index === index;
              const label = options.tabBarAccessibilityLabel ?? route.name;
              const color = isFocused ? accent : colors.mutedForeground;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              };

              const onLongPress = () => {
                navigation.emit({ type: 'tabLongPress', target: route.key });
              };

              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={label}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={styles.tab}
                >
                  {options.tabBarIcon?.({
                    focused: isFocused,
                    color,
                    size: ICON_SIZE,
                  })}
                </Pressable>
              );
            })}
          </AdaptiveGlassSurface>
        </Animated.View>

        <MapGlassCircleButton
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.closeButton}
        >
          <X size={20} color={accent} strokeWidth={2.25} />
        </MapGlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MAP_MOMENTS_SIDE_BTN_GAP,
  },
  shadowWrap: {
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
    }),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: MAP_MOMENTS_BAR_HEIGHT,
    paddingHorizontal: H_PADDING,
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  tab: {
    width: TAB_SIZE,
    height: MAP_MOMENTS_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    position: 'absolute',
    left: H_PADDING + (TAB_SIZE - ACTIVE_PILL_SIZE) / 2,
    top: (MAP_MOMENTS_BAR_HEIGHT - ACTIVE_PILL_SIZE) / 2,
    width: ACTIVE_PILL_SIZE,
    height: ACTIVE_PILL_SIZE,
    borderRadius: ACTIVE_PILL_SIZE / 2,
  },
  closeButton: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
  },
});
