import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StorageSettings } from '@/components/settings/storage-settings';
import { Text } from '@/components/ui/text';

export function StorageSettingsScreen() {
  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="muted" className="text-sm leading-5">
          Where space is used on this device. DB is the encrypted database file;
          moments are photo, voice, and note files on disk.
        </Text>
        <StorageSettings />
      </ScrollView>
    </SafeAreaView>
  );
}
