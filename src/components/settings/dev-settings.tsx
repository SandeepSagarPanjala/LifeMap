import {Pressable, View} from 'react-native';
import {BookOpen, TimerReset} from 'lucide-react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {useAppStore} from '@/stores/app-store';

function DevToggle({
  icon,
  title,
  description,
  enabled,
  onToggle,
}: {
  icon: typeof TimerReset;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onToggle}
      className="bg-card border-border rounded-2xl border p-4">
      <View className="flex-row items-center gap-3">
        <Icon as={icon} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">{title}</Text>
          <Text variant="muted" className="mt-1">
            {description}
          </Text>
        </View>
        <View
          className={`h-6 w-11 rounded-full px-0.5 ${
            enabled ? 'bg-primary' : 'bg-muted'
          }`}>
          <View
            className={`mt-0.5 h-5 w-5 rounded-full bg-white ${
              enabled ? 'ml-auto' : 'ml-0'
            }`}
          />
        </View>
      </View>
    </Pressable>
  );
}

export function DevSettings() {
  const slowSplashEnabled = useAppStore(state => state.slowSplashEnabled);
  const setSlowSplashEnabled = useAppStore(state => state.setSlowSplashEnabled);
  const devShowOnboarding = useAppStore(state => state.devShowOnboarding);
  const setDevShowOnboarding = useAppStore(state => state.setDevShowOnboarding);

  if (!__DEV__) {
    return null;
  }

  return (
    <View className="gap-4">
      <DevToggle
        icon={TimerReset}
        title="Slow splash mode"
        description="Keep splash for 45 seconds to review animation."
        enabled={slowSplashEnabled}
        onToggle={() => setSlowSplashEnabled(!slowSplashEnabled)}
      />
      <DevToggle
        icon={BookOpen}
        title="Show onboarding every launch"
        description="After splash, onboarding appears each launch for review. Get Started still opens the main app."
        enabled={devShowOnboarding}
        onToggle={() => setDevShowOnboarding(!devShowOnboarding)}
      />
    </View>
  );
}
