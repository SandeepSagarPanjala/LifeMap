import {Shield, LocateFixed} from 'lucide-react-native';
import {ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';

export function SettingsScreen() {
  const colors = useThemeColors();

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <Text variant="h3" className="text-left">
          Settings
        </Text>

        <View className="bg-card border-border mt-6 rounded-2xl border p-4">
          <View className="flex-row items-center gap-3">
            <Icon as={LocateFixed} size={20} color={colors.primary} />
            <View className="flex-1">
              <Text className="font-medium">Tracking interval</Text>
              <Text variant="muted" className="mt-1">
                TransistorSoft integration — Phase 2
              </Text>
            </View>
          </View>
        </View>

        <View className="bg-card border-border mt-3 rounded-2xl border p-4">
          <View className="flex-row items-center gap-3">
            <Icon as={Shield} size={20} color={colors.primary} />
            <View className="flex-1">
              <Text className="font-medium">Privacy & encryption</Text>
              <Text variant="muted" className="mt-1">
                SQLCipher local database — Phase 1
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
