import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { MAP_STACK_BUTTON_SIZE } from '@/lib/app-constants';

type MapGlassCircleButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  /** Absolute positioning / extras from the parent. */
  style?: StyleProp<ViewStyle>;
  /** Soft blue wash when the control is "on" (e.g. history panel open). */
  active?: boolean;
  /** Soft tint wash for close / warning controls. */
  tint?: 'none' | 'danger' | 'warning';
  children: ReactNode;
};

/**
 * Circular map control that uses the same frosted `GlassSurface` as the
 * moments bar — keeps every floating map button visually consistent.
 */
export function MapGlassCircleButton({
  accessibilityLabel,
  onPress,
  disabled = false,
  size = MAP_STACK_BUTTON_SIZE,
  style,
  active = false,
  tint = 'none',
  children,
}: MapGlassCircleButtonProps) {
  const washStyle =
    tint === 'danger'
      ? styles.dangerWash
      : tint === 'warning'
        ? styles.warningWash
        : active
          ? styles.activeWash
          : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={[styles.wrap, { width: size, height: size }, style]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.shadow,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <GlassSurface
            style={[
              styles.surface,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
            ]}
          >
            {washStyle ? (
              <View pointerEvents="none" style={washStyle} />
            ) : null}
            <View style={styles.content}>{children}</View>
          </GlassSurface>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
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
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,122,255,0.18)',
  },
  dangerWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(224,53,43,0.16)',
  },
  warningWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,149,0,0.18)',
  },
});
