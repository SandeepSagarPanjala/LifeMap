import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { StorageSettings } from '@/components/settings/storage-settings';
import { Text } from '@/components/ui/text';

export function StorageSettingsScreen() {
  return (
    <SettingsScreenLayout>
      <Text variant="muted" className="text-sm leading-5">
        Where space is used on this device. DB is the encrypted database file;
        moments are photo, voice, and note files on disk.
      </Text>
      <StorageSettings />
    </SettingsScreenLayout>
  );
}
