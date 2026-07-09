import { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type SkeletonPulseProps = {
  style?: StyleProp<ViewStyle>;
};

export function SkeletonPulse({ style }: SkeletonPulseProps) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.base, style, { opacity }]} />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#E5E5EA',
    borderRadius: 8,
  },
});
