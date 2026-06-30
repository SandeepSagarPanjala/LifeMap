import {ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {BackupSettings} from '@/components/settings/backup-settings';
import {Text} from '@/components/ui/text';

export function BackupSettingsScreen() {
  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <Text variant="muted" className="text-sm leading-5">
          Keep one cloud backup of your map, visits, and memories. Auto backup
          stays off until you enable it.
        </Text>
        <BackupSettings />
      </ScrollView>
    </SafeAreaView>
  );
}
