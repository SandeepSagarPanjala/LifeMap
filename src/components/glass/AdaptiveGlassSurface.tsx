import type { ReactNode } from 'react';
import {
  Platform,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';

import { GlassSurface } from '@/components/glass/GlassSurface';

type AdaptiveGlassSurfaceProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** iOS 26+ Liquid Glass effect. Ignored on fallback. */
  effect?: 'clear' | 'regular' | 'none';
  /** Touch glint on press (iOS 26+ only). */
  interactive?: boolean;
  /** Optional tint for Liquid Glass. Ignored on fallback. */
  tintColor?: ColorValue;
};

/**
 * Prefer Apple Liquid Glass on iOS 26+.
 * Falls back to JS `GlassSurface` when unsupported.
 *
 * Important: never mount this under a parent that fades from opacity ~0
 * (`AppScreenTransition` used to do that and broke map glass on cold start).
 */
export function AdaptiveGlassSurface({
  children,
  style,
  effect = 'regular',
  interactive = false,
  tintColor,
}: AdaptiveGlassSurfaceProps) {
  if (Platform.OS === 'ios' && isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        effect={effect}
        interactive={interactive}
        tintColor={tintColor}
        style={style}
      >
        {children}
      </LiquidGlassView>
    );
  }

  return <GlassSurface style={style}>{children}</GlassSurface>;
}
