import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import { CachedPlacesSettings } from '@/components/settings/cached-places-settings';
import { Text } from '@/components/ui/text';

export function CachedPlacesSettingsScreen() {
  return (
    <SettingsScreenLayout>
      <Text variant="muted" className="text-sm leading-5">
        Reverse-geocoded addresses and nearby POIs stored on this device. These
        are reused when labeling visits and saved places.
      </Text>
      <CachedPlacesSettings />
    </SettingsScreenLayout>
  );
}
