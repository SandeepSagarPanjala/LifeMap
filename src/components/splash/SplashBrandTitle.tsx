import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const BRAND_LETTERS = [
  { char: 'L', accent: false },
  { char: 'i', accent: false },
  { char: 'f', accent: false },
  { char: 'e', accent: false },
  { char: 'M', accent: true },
  { char: 'a', accent: true },
  { char: 'p', accent: true },
] as const;

export function SplashBrandTitle() {
  return (
    <View className="flex-row items-end">
      {BRAND_LETTERS.map((letter, index) => (
        <Text
          key={`${letter.char}-${index}`}
          className={cn(
            'border-0 pb-0 text-[2.9rem] font-extrabold tracking-tight',
            letter.accent ? 'text-primary' : 'text-foreground',
          )}
          style={
            letter.accent
              ? {
                  textShadowColor: 'rgba(0,0,0,0.15)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }
              : undefined
          }
        >
          {letter.char}
        </Text>
      ))}
    </View>
  );
}
