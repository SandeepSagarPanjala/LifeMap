import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

const RING_SIZE = 76;
const RING_COLOR = '#FFD60A';

export type CameraFocusPoint = {
  x: number;
  y: number;
  /** Bumped on every tap so a repeat tap at the same spot replays the ring. */
  id: number;
};

type CameraFocusIndicatorProps = {
  point: CameraFocusPoint | null;
};

export function CameraFocusIndicator({ point }: CameraFocusIndicatorProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (point == null) {
      opacity.setValue(0);
      return;
    }
    progress.setValue(0);
    opacity.setValue(1);
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [opacity, point, progress]);

  if (point == null) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          left: point.x - RING_SIZE / 2,
          top: point.y - RING_SIZE / 2,
          opacity,
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1.25, 1],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: RING_COLOR,
  },
});
