import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';

export type AppScreenKey = 'onboarding' | 'main';

type AppScreenTransitionProps = {
  screenKey: AppScreenKey;
  children: React.ReactNode;
};

/**
 * Soft enter for onboarding ↔ main.
 *
 * Do NOT animate `opacity` here. Liquid Glass (`UIGlassEffect`) caches a broken
 * backdrop when any ancestor mounts near opacity 0 / fades up — map chrome then
 * stays flat until a full-screen navigation remounts it. Example apps without
 * this wrapper get correct glass on cold start over MKMapView.
 */
export function AppScreenTransition({
  screenKey,
  children,
}: AppScreenTransitionProps) {
  const { width } = useWindowDimensions();
  const slideFromRight = Math.min(width * 0.28, 140);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    translateX.setValue(slideFromRight);

    Animated.timing(translateX, {
      toValue: 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenKey, slideFromRight, translateX]);

  return (
    <Animated.View
      style={[
        styles.fill,
        {
          transform: [{ translateX }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
