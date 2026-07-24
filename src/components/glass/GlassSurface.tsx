import { memo, useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  useColorScheme,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type GlassSurfaceProps = {
  children?: ReactNode;
  /** Applied to the outer container. Must include shape (height, borderRadius,
   *  flexDirection, padding, and `overflow: 'hidden'` so the sheen is clipped). */
  style?: StyleProp<ViewStyle>;
};

// Module-level counter so every instance gets a unique (SVG-safe) gradient id.
let uid = 0;

/**
 * A lightweight, fully JS/GPU-composited "glass" surface that approximates Apple's
 * Liquid Glass look without any native module.
 *
 * Why not a real backdrop blur / UIVisualEffectView? Both Apple's Liquid Glass
 * (`@callstack/liquid-glass`) and `UIVisualEffectView`-based blurs cannot sample the
 * live `MKMapView` (react-native-maps) Metal surface, so over the map they either
 * render flat or require a navigation "prime" hack. This surface avoids all of that:
 * it's a translucent fill + a specular top-edge highlight + a soft vertical sheen,
 * which reads as frosted glass over any content and costs almost nothing to render.
 *
 * Layers (bottom -> top):
 *   1. translucent base fill + hairline border (set here)
 *   2. vertical specular sheen (bright at top, fading out) via a single SVG gradient
 *   3. children (icons, highlights, etc.)
 */
export const GlassSurface = memo(function GlassSurface({
  children,
  style,
}: GlassSurfaceProps) {
  const dark = useColorScheme() === 'dark';
  const gradientId = useMemo(() => `glass-sheen-${(uid += 1)}`, []);

  const topStop = dark ? 0.22 : 0.72;
  const midStop = dark ? 0.08 : 0.28;

  return (
    <View style={[styles.base, dark ? styles.baseDark : styles.baseLight, style]}>
      <Svg
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={topStop} />
            <Stop offset="0.55" stopColor="#FFF8F0" stopOpacity={midStop} />
            <Stop offset="1" stopColor="#FFF8F0" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  baseLight: {
    // Frosty cream — denser than clear glass so icons stay readable over the map.
    backgroundColor: 'rgba(255,248,240,0.78)',
    borderColor: 'rgba(255,255,255,0.82)',
  },
  baseDark: {
    backgroundColor: 'rgba(38,36,34,0.72)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
});
