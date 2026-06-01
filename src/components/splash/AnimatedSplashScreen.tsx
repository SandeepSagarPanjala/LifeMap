import {useEffect, useRef} from 'react';
import {Animated, Easing, useColorScheme, useWindowDimensions, View} from 'react-native';
import LottieView from 'lottie-react-native';

import {AnimatedBrandTitle} from '@/components/splash/AnimatedBrandTitle';
import {SplashBackground} from '@/components/splash/SplashBackground';
import {getSplashNavigateAtMs} from '@/components/splash/splash-timing';
import {Text} from '@/components/ui/text';

type AnimatedSplashScreenProps = {
  onFinish: () => void;
  slowSplash?: boolean;
};

export function AnimatedSplashScreen({onFinish, slowSplash = false}: AnimatedSplashScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const {width, height} = useWindowDimensions();

  const haze = useRef(new Animated.Value(0.6)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const subtitleRise = useRef(new Animated.Value(20)).current;
  const subtitleGlow = useRef(new Animated.Value(0.72)).current;

  useEffect(() => {
    const hazeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(haze, {
          toValue: 0.85,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(haze, {
          toValue: 0.6,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const subtitleIntro = Animated.parallel([
      Animated.timing(subtitleFade, {
        toValue: 1,
        duration: 650,
        delay: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(subtitleRise, {
        toValue: 0,
        duration: 650,
        delay: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const subtitlePulse = Animated.loop(
      Animated.sequence([
        Animated.timing(subtitleGlow, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(subtitleGlow, {
          toValue: 0.72,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    hazeLoop.start();
    subtitleIntro.start(({finished}) => {
      if (finished) {
        subtitlePulse.start();
      }
    });

    const navigateTimeout = setTimeout(() => {
      hazeLoop.stop();
      subtitlePulse.stop();
      onFinish();
    }, getSplashNavigateAtMs(slowSplash));

    return () => {
      clearTimeout(navigateTimeout);
      hazeLoop.stop();
      subtitlePulse.stop();
    };
  }, [haze, onFinish, slowSplash, subtitleFade, subtitleGlow, subtitleRise]);

  const sunSize = Math.min(width * 0.42, 230);
  const girlWidth = Math.min(width * 0.84, 420);
  const girlHeight = Math.min(height * 0.44, 380);

  return (
    <View className="flex-1">
      <SplashBackground width={width} height={height} isDark={isDark} />

      <Animated.View
        className="absolute left-0 right-0 top-[10%] items-center"
        style={{opacity: haze}}>
        <View
          className={`h-36 w-36 rounded-full ${isDark ? 'bg-emerald-300/10' : 'bg-emerald-200/40'}`}
        />
      </Animated.View>

      <View className="absolute left-0 right-0 top-[7%] items-center">
        <LottieView
          source={require('../../../assets/lottie/day-night-sun.json')}
          autoPlay
          loop
          style={{width: sunSize, height: sunSize}}
        />
      </View>

      <View className="absolute bottom-[30%] left-0 right-0 items-center">
        <LottieView
          source={require('../../../assets/lottie/walking-girl.json')}
          autoPlay
          loop
          style={{width: girlWidth, height: girlHeight}}
        />
      </View>

      <View className="absolute bottom-[14%] left-0 right-0 items-center px-6">
        <AnimatedBrandTitle />

        <Animated.View
          style={{
            opacity: Animated.multiply(subtitleFade, subtitleGlow),
            transform: [{translateY: subtitleRise}],
          }}>
          <Text variant="muted" className="text-muted-foreground mt-4 text-center text-xl leading-8">
            Time moves. Memories stay.
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
