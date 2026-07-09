import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';

import { SplashBrandTitle } from '@/components/splash/SplashBrandTitle';
import { SplashBackground } from '@/components/splash/SplashBackground';
import { splashAnimationDurationMs } from '@/components/splash/splash-timing';
import { Text } from '@/components/ui/text';
import { ensureDatabaseReady } from '@/location/bootstrap';

type AnimatedSplashScreenProps = {
  onFinish: () => void;
};

export function AnimatedSplashScreen({ onFinish }: AnimatedSplashScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width, height } = useWindowDimensions();
  const underlineScale = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    Animated.timing(subtitleOpacity, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    void (async () => {
      const startedAt = Date.now();
      try {
        await ensureDatabaseReady();
      } catch {
        // Error boundary / next screen will surface DB failures.
      }
      if (cancelled) {
        return;
      }

      const duration = splashAnimationDurationMs(Date.now() - startedAt);
      await new Promise<void>(resolve => {
        Animated.timing(underlineScale, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            resolve();
          }
        });
      });

      if (!cancelled) {
        onFinish();
      }
    })();

    return () => {
      cancelled = true;
      underlineScale.stopAnimation();
      subtitleOpacity.stopAnimation();
    };
  }, [onFinish, subtitleOpacity, underlineScale]);

  return (
    <View className="flex-1">
      <SplashBackground width={width} height={height} isDark={isDark} />

      <View className="flex-1 items-center justify-center px-6">
        <View className="items-center">
          <SplashBrandTitle />

          <Animated.View
            className="bg-primary mt-1 h-1 rounded-full"
            style={{
              width: 148,
              transform: [{ scaleX: underlineScale }],
            }}
          />

          <Animated.View style={{ opacity: subtitleOpacity }}>
            <Text
              variant="muted"
              className="text-muted-foreground mt-4 text-center text-xl leading-8"
            >
              Time moves. Memories stay.
            </Text>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
