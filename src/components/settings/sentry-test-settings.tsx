import {Alert, Pressable, View} from 'react-native';
import {Bug} from 'lucide-react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  isSentryTestCrashNative,
  triggerSentryTestCrash,
} from '@/lib/sentry/trigger-test-crash';

export function SentryTestSettings() {
  const colors = useThemeColors();
  const usesNativeCrash = isSentryTestCrashNative();

  const handlePress = () => {
    Alert.alert(
      'Crash app for Sentry test?',
      usesNativeCrash
        ? 'This will force a native crash so you can confirm crash reports reach Sentry.'
        : 'Native Sentry is not linked yet (run pod install and rebuild). This will throw an unhandled JS error instead — enough to verify the dashboard, but rebuild for real native crash capture.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Crash now',
          style: 'destructive',
          onPress: triggerSentryTestCrash,
        },
      ],
    );
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      className="bg-card border-border mt-2 rounded-2xl border p-4 active:opacity-70">
      <View className="flex-row items-center gap-3">
        <Icon as={Bug} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">Test Sentry crash</Text>
          <Text variant="muted" className="mt-1">
            Dev only.{' '}
            {usesNativeCrash
              ? 'Forces a native crash to verify Sentry.'
              : 'Native SDK not linked — rebuild after pod install. Uses JS crash fallback for now.'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
