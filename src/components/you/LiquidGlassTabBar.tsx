import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { useThemeColors } from '@/hooks/use-theme-colors';

const TAB_SIZE = 54;
const BAR_HEIGHT = 54;
const H_PADDING = 6;
const HIGHLIGHT_HEIGHT = BAR_HEIGHT - 12;
const HIGHLIGHT_WIDTH = 46;
const ICON_SIZE = 23;

const SPRING = { damping: 18, stiffness: 220, mass: 0.7 } as const;

export function LiquidGlassTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';

  const translateX = useSharedValue(state.index * TAB_SIZE);

  useEffect(() => {
    translateX.value = withSpring(state.index * TAB_SIZE, SPRING);
  }, [state.index, translateX]);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <View style={styles.shadowWrap}>
        <GlassSurface style={styles.pill}>
          <Animated.View
            pointerEvents="none"
            style={[styles.highlightWrap, highlightStyle]}
          >
            <View
              style={[
                styles.highlight,
                {
                  backgroundColor: dark
                    ? 'rgba(255,255,255,0.14)'
                    : 'rgba(255,255,255,0.5)',
                },
              ]}
            />
          </Animated.View>

          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const label = options.tabBarAccessibilityLabel ?? route.name;
            const showDot =
              options.tabBarBadge !== undefined && options.tabBarBadge !== null;
            const iconColor = dark ? '#F5F5F7' : '#1C1C1E';
            const color = isFocused ? iconColor : colors.mutedForeground;

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
                <View style={styles.iconWrap}>
                  {options.tabBarIcon?.({
                    focused: isFocused,
                    color,
                    size: ICON_SIZE,
                  })}
                  {showDot ? <View style={styles.dot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </GlassSurface>
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
  shadowWrap: {
    borderRadius: BAR_HEIGHT / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
    }),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT,
    paddingHorizontal: H_PADDING,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  highlightWrap: {
    position: 'absolute',
    left: H_PADDING,
    top: (BAR_HEIGHT - HIGHLIGHT_HEIGHT) / 2,
    width: TAB_SIZE,
    height: HIGHLIGHT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    width: HIGHLIGHT_WIDTH,
    height: HIGHLIGHT_HEIGHT,
    borderRadius: HIGHLIGHT_HEIGHT / 2,
  },
  tab: {
    width: TAB_SIZE,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: -3,
    right: -5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
});
