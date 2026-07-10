import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DevSettings } from '@/components/settings/dev-settings';
import { ExportSettings } from '@/components/settings/export-settings';
import { TripRebuildSettings } from '@/components/settings/trip-rebuild-settings';
import { SettingsGroupLabel } from '@/components/settings/settings-group';
import { Text } from '@/components/ui/text';

export function DeveloperSettingsScreen() {
  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="muted" className="text-sm leading-5">
          Export data and use internal debugging tools.
        </Text>

        <SettingsGroupLabel title="Export" />
        <ExportSettings />

        {__DEV__ ? (
          <View>
            <SettingsGroupLabel title="Developer tools" />
            <DevSettings />
            <TripRebuildSettings />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
