import {useEffect, useRef} from 'react';
import {Animated, Easing, View} from 'react-native';

import {Text} from '@/components/ui/text';
import {cn} from '@/lib/utils';

const BRAND_LETTERS = [
  {char: 'L', accent: false},
  {char: 'i', accent: false},
  {char: 'f', accent: false},
  {char: 'e', accent: false},
  {char: 'M', accent: true},
  {char: 'a', accent: true},
  {char: 'p', accent: true},
] as const;

export function AnimatedBrandTitle() {
  const letterAnims = useRef(
    BRAND_LETTERS.map(() => ({
      opacity: new Animated.Value(0),
      y: new Animated.Value(20),
      scale: new Animated.Value(0.72),
    }))
  ).current;
  const underlineScale = useRef(new Animated.Value(0)).current;
  const mapGlow = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const letterIntro = Animated.stagger(
      75,
      letterAnims.map(anim =>
        Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 520,
            delay: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(anim.y, {
            toValue: 0,
            duration: 520,
            delay: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(anim.scale, {
            toValue: 1,
            duration: 520,
            delay: 320,
            easing: Easing.out(Easing.back(1.35)),
            useNativeDriver: true,
          }),
        ])
      )
    );

    const underlineIntro = Animated.timing(underlineScale, {
      toValue: 1,
      duration: 480,
      delay: 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const mapGlowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(mapGlow, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(mapGlow, {
          toValue: 0.85,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    letterIntro.start();
    underlineIntro.start(({finished: underlineDone}) => {
      if (underlineDone) {
        mapGlowLoop.start();
      }
    });

    return () => {
      mapGlowLoop.stop();
    };
  }, [letterAnims, mapGlow, underlineScale]);

  return (
    <View className="items-center">
      <View className="flex-row items-end">
        {BRAND_LETTERS.map((letter, index) => {
          const anim = letterAnims[index]!;
          const isAccent = letter.accent;

          return (
            <Animated.View
              key={`${letter.char}-${index}`}
              style={{
                opacity: isAccent ? Animated.multiply(anim.opacity, mapGlow) : anim.opacity,
                transform: [{translateY: anim.y}, {scale: anim.scale}],
              }}>
              <Text
                className={cn(
                  'border-0 pb-0 text-[2.9rem] font-extrabold tracking-tight',
                  isAccent ? 'text-primary' : 'text-foreground'
                )}>
                {letter.char}
              </Text>
            </Animated.View>
          );
        })}
      </View>

      <Animated.View
        className="bg-primary mt-1 h-1 rounded-full"
        style={{
          width: 148,
          opacity: mapGlow,
          transform: [{scaleX: underlineScale}],
        }}
      />
    </View>
  );
}
