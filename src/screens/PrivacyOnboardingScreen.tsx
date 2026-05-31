import {Lock, Shield, Smartphone} from 'lucide-react-native';
import {ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {Button} from '@/components/ui/button';
import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {useAppStore} from '@/stores/app-store';

const PRIVACY_POINTS = [
  {
    icon: Smartphone,
    title: 'Your memories stay on your phone',
    description: 'LifeMap stores your location history locally on this device — encrypted.',
  },
  {
    icon: Lock,
    title: 'We cannot read your data',
    description: 'No account required for MVP. Your timeline is yours alone.',
  },
  {
    icon: Shield,
    title: 'You control what is tracked',
    description: 'Pause tracking anytime. Export or delete all data from Settings.',
  },
] as const;

export function PrivacyOnboardingScreen() {
  const colors = useThemeColors();
  const completePrivacyOnboarding = useAppStore(state => state.completePrivacyOnboarding);

  return (
    <SafeAreaView className="bg-background flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-8 pt-10"
        showsVerticalScrollIndicator={false}>
        <Text variant="h2" className="border-0 pb-0 text-left">
          LifeMap
        </Text>
        <Text variant="lead" className="mt-2 text-left">
          Remember where life happened — privately.
        </Text>

        <View className="mt-10 gap-6">
          {PRIVACY_POINTS.map(point => (
            <View key={point.title} className="flex-row gap-4">
              <View className="bg-accent mt-0.5 h-10 w-10 items-center justify-center rounded-full">
                <Icon as={point.icon} size={20} color={colors.accentForeground} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold">{point.title}</Text>
                <Text variant="muted" className="mt-1 leading-5">
                  {point.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View className="bg-muted mt-10 rounded-xl p-4">
          <Text className="text-sm font-medium">Why always-on location?</Text>
          <Text variant="muted" className="mt-2 leading-5">
            To answer &quot;Where was I last year today?&quot; LifeMap needs to record your path
            in the background — even when the app is closed. You choose how often.
          </Text>
        </View>

        <Button className="mt-8 w-full" onPress={completePrivacyOnboarding}>
          <Text>I understand — continue</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
