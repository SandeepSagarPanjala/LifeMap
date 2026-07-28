import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { BackupSettings } from '@/components/settings/backup-settings';
import { Text } from '@/components/ui/text';

export function BackupSettingsScreen() {
  return (
    <SettingsScreenLayout>
      <Text variant="muted" className="text-sm leading-5">
        Keep one cloud backup of your map, visits, and memories. Auto backup
        stays off until you enable it.
      </Text>
      <BackupSettings />
    </SettingsScreenLayout>
  );
}
