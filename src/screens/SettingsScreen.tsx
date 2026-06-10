import {Shield} from 'lucide-react-native';
import {ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {AccentThemePicker} from '@/components/settings/accent-theme-picker';
import {DevSettings} from '@/components/settings/dev-settings';
import {ExportSettings} from '@/components/settings/export-settings';
import {HistoryDetectionSettings} from '@/components/settings/history-detection-settings';
import {HistoryRepairSettings} from '@/components/settings/history-repair-settings';
import {PreferencesSettings} from '@/components/settings/preferences-settings';
import {SettingsSection} from '@/components/settings/settings-section';
import {StorageSettings} from '@/components/settings/storage-settings';
import {TrackingSettings} from '@/components/settings/tracking-settings';
import {useThemeColors} from '@/hooks/use-theme-colors';

export function SettingsScreen() {
  const colors = useThemeColors();

  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <SettingsSection
          isFirst
          title="User settings"
          subtitle="Customize how LifeMap looks and records your day.">
          <AccentThemePicker />
          <PreferencesSettings />
          <TrackingSettings />
        </SettingsSection>

        <SettingsSection
          title="Information"
          subtitle="Storage and how visits and drives are detected.">
          <StorageSettings />
          <HistoryDetectionSettings />
          <HistoryRepairSettings />
          <View className="bg-card border-border rounded-2xl border p-4">
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
        </SettingsSection>

        <SettingsSection
          title="Developer"
          subtitle="Export data and internal debugging tools.">
          <ExportSettings />
          <DevSettings />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}
