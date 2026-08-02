import { View } from 'react-native';

import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { DevSettings } from '@/components/settings/dev-settings';
import { ExportSettings } from '@/components/settings/export-settings';
import { TripRebuildSettings } from '@/components/settings/trip-rebuild-settings';
import { SettingsGroupLabel } from '@/components/settings/settings-group';
import { Text } from '@/components/ui/text';

export function DeveloperSettingsScreen() {
  return (
    <SettingsScreenLayout>
      <Text variant="muted" className="text-sm leading-5">
        Export data and use internal debugging tools.
      </Text>

      <SettingsGroupLabel title="Export" />
      <ExportSettings />

      <View>
        <SettingsGroupLabel title="Developer tools" />
        <DevSettings />
        <TripRebuildSettings />
      </View>
    </SettingsScreenLayout>
  );
}
