import {useEffect} from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {Circle, Defs, LinearGradient, Stop} from 'react-native-svg';
import {StyleSheet, View} from 'react-native';

import {useMaterializationBusy} from '@/hooks/use-materialization-busy';

type MaterializationActivityDotProps = {
  top: number;
};

export function MaterializationActivityDot({top}: MaterializationActivityDotProps) {
  const busy = useMaterializationBusy();
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (busy) {
      opacity.value = withRepeat(
        withTiming(0.5, {
          duration: 900,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      );
      return;
    }
    opacity.value = withTiming(0, {duration: 180});
  }, [busy, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!busy) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLabel="Saving trip history"
      style={[styles.dot, {top}, animatedStyle]}>
      <View style={styles.inner}>
        <Svg width={10} height={10}>
          <Defs>
            <LinearGradient id="materializationRainbow" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#ff6b6b" />
              <Stop offset="0.35" stopColor="#ffd93d" />
              <Stop offset="0.65" stopColor="#6bcb77" />
              <Stop offset="1" stopColor="#4d96ff" />
            </LinearGradient>
          </Defs>
          <Circle cx={5} cy={5} r={4.5} fill="url(#materializationRainbow)" />
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    right: 16,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
