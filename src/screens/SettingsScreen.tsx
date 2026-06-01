import {Shield, TimerReset, BookOpen} from 'lucide-react-native';
import {Pressable, ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {AccentThemePicker} from '@/components/settings/accent-theme-picker';
import {TrackingSettings} from '@/components/settings/tracking-settings';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {useAppStore} from '@/stores/app-store';

export function SettingsScreen() {
  const colors = useThemeColors();
  const slowSplashEnabled = useAppStore(state => state.slowSplashEnabled);
  const setSlowSplashEnabled = useAppStore(state => state.setSlowSplashEnabled);
  const devShowOnboarding = useAppStore(state => state.devShowOnboarding);
  const setDevShowOnboarding = useAppStore(state => state.setDevShowOnboarding);

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <Text variant="h3" className="text-left">
          Settings
        </Text>

        <View className="mt-6">
          <AccentThemePicker />
        </View>

        <View className="mt-4">
          <TrackingSettings />
        </View>

        <View className="bg-card border-border mt-3 rounded-2xl border p-4">
          <View className="flex-row items-center gap-3">
            <Icon as={Shield} size={20} color={colors.primary} />
            <View className="flex-1">
              <Text className="font-medium">Privacy & encryption</Text>
              <Text variant="muted" className="mt-1">
                Location history is encrypted on this device with SQLCipher.
              </Text>
            </View>
          </View>
        </View>

        {__DEV__ ? (
          <Pressable
            onPress={() => setSlowSplashEnabled(!slowSplashEnabled)}
            className="bg-card border-border mt-3 rounded-2xl border p-4">
            <View className="flex-row items-center gap-3">
              <Icon as={TimerReset} size={20} color={colors.primary} />
              <View className="flex-1">
                <Text className="font-medium">Slow splash mode (dev)</Text>
                <Text variant="muted" className="mt-1">
                  Keep splash for 45 seconds to review animation.
                </Text>
              </View>
              <View
                className={`h-6 w-11 rounded-full px-0.5 ${
                  slowSplashEnabled ? 'bg-primary' : 'bg-muted'
                }`}>
                <View
                  className={`mt-0.5 h-5 w-5 rounded-full bg-white ${
                    slowSplashEnabled ? 'ml-auto' : 'ml-0'
                  }`}
                />
              </View>
            </View>
          </Pressable>
        ) : null}

        {__DEV__ ? (
          <Pressable
            onPress={() => setDevShowOnboarding(!devShowOnboarding)}
            className="bg-card border-border mt-3 rounded-2xl border p-4">
            <View className="flex-row items-center gap-3">
              <Icon as={BookOpen} size={20} color={colors.primary} />
              <View className="flex-1">
                <Text className="font-medium">Show onboarding every launch (dev)</Text>
                <Text variant="muted" className="mt-1">
                  After splash, onboarding appears each launch for review. Get Started still
                  opens the main app — turn off for install-only behavior.
                </Text>
              </View>
              <View
                className={`h-6 w-11 rounded-full px-0.5 ${
                  devShowOnboarding ? 'bg-primary' : 'bg-muted'
                }`}>
                <View
                  className={`mt-0.5 h-5 w-5 rounded-full bg-white ${
                    devShowOnboarding ? 'ml-auto' : 'ml-0'
                  }`}
                />
              </View>
            </View>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
