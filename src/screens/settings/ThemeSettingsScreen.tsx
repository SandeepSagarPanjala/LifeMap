import {Check} from 'lucide-react-native';
import {Pressable, ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {ACCENT_THEME_ORDER, ACCENT_THEMES} from '@/lib/color-themes';
import {cn} from '@/lib/utils';
import {useAppStore} from '@/stores/app-store';

export function ThemeSettingsScreen() {
  const colors = useThemeColors();
  const accentTheme = useAppStore(state => state.accentTheme);
  const setAccentTheme = useAppStore(state => state.setAccentTheme);

  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <Text variant="muted" className="text-sm leading-5">
          App accent for tabs, icons, and highlights. Verdant Path is the default.
        </Text>

        <View className="mt-4 gap-2">
          {ACCENT_THEME_ORDER.map(themeId => {
            const theme = ACCENT_THEMES[themeId];
            const isSelected = accentTheme === themeId;
            const preview = `hsl(${theme.light.primary})`;

            return (
              <Pressable
                key={themeId}
                accessibilityRole="radio"
                accessibilityState={{selected: isSelected}}
                accessibilityLabel={theme.name}
                onPress={() => setAccentTheme(themeId)}
                className={cn(
                  'bg-card border-border flex-row items-center gap-3 rounded-xl border p-3',
                  isSelected ? 'border-primary bg-accent/40' : '',
                )}>
                <View
                  className="h-10 w-10 rounded-full"
                  style={{backgroundColor: preview}}
                />
                <View className="flex-1">
                  <Text className="font-medium">{theme.name}</Text>
                  <Text variant="muted" className="mt-0.5 text-sm">
                    {theme.description}
                  </Text>
                </View>
                {isSelected ? (
                  <Check size={20} color={colors.primary} strokeWidth={2.5} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
