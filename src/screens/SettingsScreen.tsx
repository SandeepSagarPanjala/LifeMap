import {ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {AppVersionFooter} from '@/components/settings/app-version-footer';
import {AccentThemePicker} from '@/components/settings/accent-theme-picker';
import {DevSettings} from '@/components/settings/dev-settings';
import {ExportSettings} from '@/components/settings/export-settings';
import {TripRebuildSettings} from '@/components/settings/trip-rebuild-settings';
import {PreferencesSettings} from '@/components/settings/preferences-settings';
import {SettingsSection} from '@/components/settings/settings-section';
import {StorageSettings} from '@/components/settings/storage-settings';
import {TrackingSettings} from '@/components/settings/tracking-settings';

export function SettingsScreen() {
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
          <TripRebuildSettings />
        </SettingsSection>

        <SettingsSection title="Information" subtitle="Storage on this device.">
          <StorageSettings />
        </SettingsSection>

        <SettingsSection
          title="Developer"
          subtitle="Export data and internal debugging tools.">
          <ExportSettings />
          <DevSettings />
        </SettingsSection>

        <AppVersionFooter />
      </ScrollView>
    </SafeAreaView>
  );
}
