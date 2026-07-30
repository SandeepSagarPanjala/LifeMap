import { useEffect, useRef, type ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESS_IN_MS = 55;
const PRESS_OUT_MS = 70;
const PRESS_SCALE = 1.05;

type GlassPressableProps = {
  accessibilityLabel: string;
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  animate?: boolean;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Press target for glass controls. The short action delay lets the release
 * animation render before controls such as Close unmount their screen.
 */
export function GlassPressable({
  accessibilityLabel,
  children,
  onPress,
  disabled = false,
  animate = true,
  hitSlop,
  style,
}: GlassPressableProps) {
  const scale = useSharedValue(1);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (actionTimerRef.current != null) {
        clearTimeout(actionTimerRef.current);
      }
    },
    [],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!animate) {
      return;
    }
    // Reanimated shared values are intentionally mutable UI-thread state.
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withTiming(PRESS_SCALE, {
      duration: PRESS_IN_MS,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.System,
    });
  };

  const handlePressOut = () => {
    if (!animate) {
      return;
    }
    // Reanimated shared values are intentionally mutable UI-thread state.
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withTiming(1, {
      duration: PRESS_OUT_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  };

  const handlePress = (_event: GestureResponderEvent) => {
    if (!animate) {
      onPress();
      return;
    }
    if (actionTimerRef.current != null) {
      return;
    }
    actionTimerRef.current = setTimeout(() => {
      actionTimerRef.current = null;
      onPress();
    }, PRESS_OUT_MS);
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
