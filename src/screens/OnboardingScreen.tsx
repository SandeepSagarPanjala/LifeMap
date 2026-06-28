import {useRef, useState} from 'react';
import {
  FlatList,
  Pressable,
  useColorScheme,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import LottieView from 'lottie-react-native';
import {Camera, LocateFixed, Lock, Shield} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {SplashBackground} from '@/components/splash/SplashBackground';
import {Button} from '@/components/ui/button';
import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {ONBOARDING_SLIDES, type OnboardingSlideConfig} from '@/lib/onboarding-slides';

const FALLBACK_ICONS = {
  'capture-moments': Camera,
  'private-by-design': Shield,
  'permissions-preview': LocateFixed,
} as const;

type OnboardingScreenProps = {
  onComplete: () => void;
};

export function OnboardingScreen({onComplete}: OnboardingScreenProps) {
  const {width, height} = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = useThemeColors();
  const listRef = useRef<FlatList<OnboardingSlideConfig>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLastSlide = activeIndex === ONBOARDING_SLIDES.length - 1;

  const goToSlide = (index: number) => {
    const next = Math.min(Math.max(index, 0), ONBOARDING_SLIDES.length - 1);
    setActiveIndex(next);
    listRef.current?.scrollToIndex({index: next, animated: true});
  };

  const handleNext = () => {
    if (isLastSlide) {
      onComplete();
      return;
    }
    goToSlide(activeIndex + 1);
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(Math.min(Math.max(next, 0), ONBOARDING_SLIDES.length - 1));
  };

  const renderSlide = ({item}: {item: OnboardingSlideConfig}) => {
    const FallbackIcon = FALLBACK_ICONS[item.id as keyof typeof FALLBACK_ICONS] ?? Lock;
    const lottieSize = Math.min(width * 0.72, height * 0.32, 300);

    return (
      <View style={{width}} className="flex-1 justify-end px-6 pb-3">
        <View
          className="items-center"
          style={item.id === 'capture-moments' ? {marginBottom: 42} : undefined}>
          {item.lottie ? (
            <LottieView
              source={item.lottie}
              autoPlay
              loop
              style={{width: lottieSize, height: lottieSize}}
            />
          ) : (
            <View className="bg-card border-border h-52 w-52 items-center justify-center rounded-[40px] border">
              <View className="bg-accent h-24 w-24 items-center justify-center rounded-3xl">
                <Icon as={FallbackIcon} size={42} color={colors.accentForeground} />
              </View>
            </View>
          )}
        </View>

        <View className="mt-5">
          <Text variant="h2" className="text-foreground border-0 pb-0 text-center">
            {item.title}
          </Text>
          <Text variant="muted" className="text-muted-foreground mt-3 text-center text-lg leading-7">
            {item.description}
          </Text>
          {item.bullets ? (
            <View className="mt-4 gap-3">
              {item.bullets.map(bullet => (
                <View key={bullet} className="flex-row gap-3">
                  <Text className="text-primary mt-0.5 text-lg leading-6">•</Text>
                  <Text variant="muted" className="text-muted-foreground flex-1 text-base leading-6">
                    {bullet}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1">
      <SplashBackground width={width} height={height} isDark={isDark} />

      <SafeAreaView className="flex-1">
        <View className="flex-row items-center justify-between px-6 pt-2">
          <Text className="text-muted-foreground text-sm font-medium">
            {activeIndex + 1} / {ONBOARDING_SLIDES.length}
          </Text>
          {!isLastSlide ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
              onPress={onComplete}
              hitSlop={12}>
              <Text className="text-muted-foreground text-sm font-medium">Skip</Text>
            </Pressable>
          ) : (
            <View className="w-10" />
          )}
        </View>

        <FlatList
          ref={listRef}
          data={ONBOARDING_SLIDES}
          keyExtractor={item => item.id}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          className="flex-1"
          onMomentumScrollEnd={onMomentumScrollEnd}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
        />

        <View className="px-6 pb-16 pt-2">
          <View className="mb-4 flex-row items-center justify-center gap-2">
            {ONBOARDING_SLIDES.map((slide, index) => (
              <Pressable
                key={slide.id}
                accessibilityRole="button"
                accessibilityLabel={`Go to slide ${index + 1}`}
                onPress={() => goToSlide(index)}
                className={`h-2 rounded-full ${
                  index === activeIndex ? 'bg-primary w-8' : 'bg-muted w-2'
                }`}
              />
            ))}
          </View>

          <Button
            className="w-full"
            accessibilityLabel={
              isLastSlide ? 'Finish onboarding' : 'Continue onboarding'
            }
            onPress={handleNext}>
            <Text>{isLastSlide ? 'Get started' : 'Next'}</Text>
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}
