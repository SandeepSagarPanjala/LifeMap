import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { X } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/GlassSurface';
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

export function LiquidGlassTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const accent = colors.primary;

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
        <View style={styles.shadowWrap}>
          <GlassSurface style={styles.pill}>
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
          </GlassSurface>
        </View>

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
  closeButton: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
  },
});
