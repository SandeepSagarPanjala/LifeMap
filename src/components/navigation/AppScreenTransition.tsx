import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';

export type AppScreenKey = 'splash' | 'onboarding' | 'main';

type AppScreenTransitionProps = {
  screenKey: AppScreenKey;
  children: React.ReactNode;
};

export function AppScreenTransition({
  screenKey,
  children,
}: AppScreenTransitionProps) {
  const { width } = useWindowDimensions();
  const slideFromRight = Math.min(width * 0.28, 140);
  const opacity = useRef(
    new Animated.Value(screenKey === 'splash' ? 1 : 0),
  ).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (screenKey === 'splash') {
      opacity.setValue(1);
      translateX.setValue(0);
      return;
    }

    opacity.setValue(0.92);
    translateX.setValue(slideFromRight);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, screenKey, slideFromRight, translateX]);

  return (
    <Animated.View
      style={[
        styles.fill,
        {
          opacity,
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
