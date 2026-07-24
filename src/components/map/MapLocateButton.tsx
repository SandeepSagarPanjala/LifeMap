import { useCallback, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { MAP_STACK_BUTTON_RIGHT, MAP_STACK_BUTTON_SIZE } from '@/lib/app-constants';

/** Same blue as the system map user-location puck. */
const MAP_USER_LOCATION_BLUE = '#007AFF';
const MAP_TRIPS_OVERVIEW_RED = '#FF3B30';

type MapLocateButtonProps = {
  bottom: number;
  /** When true, show blue/red split puck (fit-trips available). */
  split?: boolean;
  onPressLocate: () => void;
  onPressFitTrips?: () => void;
};

type Half = 'locate' | 'fit';

/**
 * Locate control. Default: glass circle with blue puck (recenter).
 * Split (count > 1): glass button; blue/red only on the center puck
 * (top-left blue / bottom-right red).
 */
export function MapLocateButton({
  bottom,
  split = false,
  onPressLocate,
  onPressFitTrips,
}: MapLocateButtonProps) {
  const [size, setSize] = useState(MAP_STACK_BUTTON_SIZE);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const next = Math.round(event.nativeEvent.layout.width);
      if (next > 0 && next !== size) {
        setSize(next);
      }
    },
    [size],
  );

  const halfFromTouch = useCallback(
    (locationX: number, locationY: number): Half => {
      // Diagonal from bottom-left → top-right: x + y = size.
      // Top-left (locate): x + y < size. Bottom-right (fit trips): else.
      return locationX + locationY < size ? 'locate' : 'fit';
    },
    [size],
  );

  const r = size / 2;
  // Center puck geometry (in button coords).
  const puckOuterR = 11.5;
  const puckCoreR = 7;
  const puckBluePath = useMemo(() => {
    // Top-left triangle of the full button, clipped to the puck core later.
    return `M 0 0 L ${size} 0 L 0 ${size} Z`;
  }, [size]);
  const puckRedPath = useMemo(() => {
    return `M ${size} 0 L ${size} ${size} L 0 ${size} Z`;
  }, [size]);

  if (!split) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go to current location"
        onPress={onPressLocate}
        hitSlop={6}
        style={[styles.wrap, { bottom }]}
      >
        {({ pressed }) => (
          <View style={[styles.shadow, pressed && styles.pressed]}>
            <GlassSurface style={styles.surface}>
              <View style={styles.puckRing}>
                <View style={styles.puckCore} />
              </View>
            </GlassSurface>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Locate or show today's trips"
      onPress={event => {
        const { locationX, locationY } = event.nativeEvent;
        const half = halfFromTouch(locationX, locationY);
        if (half === 'locate') {
          onPressLocate();
        } else {
          onPressFitTrips?.();
        }
      }}
      hitSlop={6}
      style={[styles.wrap, { bottom }]}
      onLayout={onLayout}
    >
      {({ pressed }) => (
        <View style={[styles.shadow, pressed && styles.pressed]}>
          <GlassSurface style={styles.surface}>
            <Svg width={size} height={size} pointerEvents="none">
              {/* White ring around the split puck. */}
              <Circle
                cx={r}
                cy={r}
                r={puckOuterR}
                fill="#FFFFFF"
                stroke="rgba(0,0,0,0.08)"
                strokeWidth={0.5}
              />
              {/* Blue / red only on the center dot. */}
              <Defs>
                <ClipPath id="puckCoreClip">
                  <Circle cx={r} cy={r} r={puckCoreR} />
                </ClipPath>
              </Defs>
              <G clipPath="url(#puckCoreClip)">
                <Path d={puckBluePath} fill={MAP_USER_LOCATION_BLUE} />
                <Path d={puckRedPath} fill={MAP_TRIPS_OVERVIEW_RED} />
              </G>
            </Svg>
          </GlassSurface>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: MAP_STACK_BUTTON_RIGHT,
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
  },
  shadow: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
    borderRadius: MAP_STACK_BUTTON_SIZE / 2,
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
  pressed: {
    opacity: 0.85,
  },
  surface: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
    borderRadius: MAP_STACK_BUTTON_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  puckRing: {
    width: 23,
    height: 23,
    borderRadius: 11.5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  puckCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: MAP_USER_LOCATION_BLUE,
  },
});
